import Anthropic from "@anthropic-ai/sdk";

// Claude effort levels. "none" (an OpenAI value that may linger in old env
// settings) is mapped to "low" rather than rejected.
export type ClaudeEffort = "low" | "medium" | "high" | "xhigh" | "max";

const EFFORTS = new Set<ClaudeEffort>(["low", "medium", "high", "xhigh", "max"]);

export function claudeEffort(value: string | undefined, fallback: ClaudeEffort): ClaudeEffort {
  if (value === "none") return "low";
  return value && EFFORTS.has(value as ClaudeEffort) ? (value as ClaudeEffort) : fallback;
}

export const DEFAULT_CLAUDE_MODEL = "claude-opus-5";

export function anthropicClient(): Anthropic | null {
  const apiKey = Netlify.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) return null;
  return new Anthropic({ apiKey });
}

// Structured outputs reject size/length constraints (minItems, maxItems,
// minLength, maxLength). Strip them for the API call — each function's own
// normalize step re-validates the parsed result anyway.
const UNSUPPORTED_SCHEMA_KEYS = new Set(["minItems", "maxItems", "minLength", "maxLength"]);

export function sanitizeSchema<T>(node: T): T {
  if (Array.isArray(node)) return node.map(sanitizeSchema) as T;
  if (node && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node as Record<string, unknown>)
        .filter(([key]) => !UNSUPPORTED_SCHEMA_KEYS.has(key))
        .map(([key, value]) => [key, sanitizeSchema(value)])
    ) as T;
  }
  return node;
}

export interface StructuredCallOptions {
  client: Anthropic;
  model: string;
  effort: ClaudeEffort;
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens: number;
}

// One structured-output call. Streams internally so long generations never hit
// HTTP timeouts, applies the server-side refusal fallback (declined requests
// re-run on claude-opus-4-8 instead of failing), and returns the raw JSON text
// for the caller to parse/normalize.
export async function structuredClaudeCall(options: StructuredCallOptions): Promise<string> {
  const stream = options.client.beta.messages.stream({
    model: options.model,
    max_tokens: options.maxTokens,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: options.system,
    output_config: {
      effort: options.effort,
      format: { type: "json_schema", schema: sanitizeSchema(options.schema) }
    },
    messages: [{ role: "user", content: options.prompt }]
  } as never);
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new Error("The model declined this request");
  }
  if (message.stop_reason === "max_tokens") {
    throw new Error("The model ran out of room before finishing");
  }

  const text = message.content
    .filter((block): block is { type: "text"; text: string } & typeof block => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  if (!text) throw new Error("The model returned no text output");
  return text;
}
