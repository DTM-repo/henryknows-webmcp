// Direct engine call — same retrieval + prompt + model as chat-proxy-v2, but
// without the Netlify function wrapper (and its execution timeout). Used by
// bench.mjs and for ad-hoc testing. Run from the repo root.

import { readFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { retrieve, renderSources } from "../../netlify/functions/_shared/retrieval.js";
import { HENRY_SYSTEM } from "../../netlify/functions/_shared/henry-prompt.js";

// load .env before the SDK client is constructed
const root = new URL("../..", import.meta.url).pathname;
for (const line of readFileSync(`${root}/.env`, "utf8").split("\n")) {
  const i = line.indexOf("=");
  if (i > 0 && !line.startsWith("#")) {
    const k = line.slice(0, i).trim();
    if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
  }
}

const anthropic = new Anthropic();

export async function ask(question, opts = {}) {
  const model = opts.model || process.env.HENRY_MODEL || "claude-fable-5";
  const effort = opts.effort || process.env.HENRY_EFFORT || "medium";
  const t0 = Date.now();
  const hits = await retrieve(question, 10);
  const sources = renderSources(hits);
  const response = await anthropic.beta.messages.create({
    model,
    max_tokens: 8000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort },
    system: [
      { type: "text", text: HENRY_SYSTEM, cache_control: { type: "ephemeral" } },
      { type: "text", text: `Today's date is ${new Date().toISOString().slice(0, 10)}.` },
    ],
    messages: [
      { role: "user", content: `<sources>\n${sources}\n</sources>\n\n${question}` },
    ],
  });
  const text =
    response.stop_reason === "refusal"
      ? "[REFUSAL]"
      : response.content
          .filter((b) => b.type === "text")
          .map((b) => b.text)
          .join("\n")
          .trim();
  return {
    text,
    ms: Date.now() - t0,
    model: response.model,
    stop_reason: response.stop_reason,
    usage: response.usage,
  };
}

// CLI: node kb/tools/ask-direct.mjs "question"
if (process.argv[1] && process.argv[1].endsWith("ask-direct.mjs") && process.argv[2]) {
  const r = await ask(process.argv[2]);
  console.log(r.text);
  console.error(
    `\n[${r.model} ${r.stop_reason} ${(r.ms / 1000).toFixed(1)}s ` +
      `in=${r.usage.input_tokens} cached=${r.usage.cache_read_input_tokens} out=${r.usage.output_tokens}]`
  );
}
