import { PreparationError } from "./case";
import type { ExplanationRequest, ExplanationResponse } from "../ai/explanationPayload";

export type Source = { id: string; title: string; url: string; heading?: string; retrieved?: string | null };
export type HenryAnswer = { text: string; sources: Source[] };
export type AdvisementResponse = ExplanationResponse | { responseId: string; status: string };
export type PreparationServices = {
  askHenry: (message: string, audience: "student" | "professional", signal: AbortSignal) => Promise<HenryAnswer>;
  startAdvisement: (request: ExplanationRequest, signal: AbortSignal) => Promise<AdvisementResponse>;
  pollAdvisement: (responseId: string, signal: AbortSignal) => Promise<AdvisementResponse>;
};

export async function readHenryStream(response: Response): Promise<HenryAnswer> {
  if (!response.ok || !response.headers.get("content-type")?.includes("text/event-stream") || !response.body) {
    const body = await response.json().catch(() => ({}));
    throw new PreparationError(body.gated ? "access_required" : "service_unavailable", body.gated ? "Henry access is required in this browser. Your case is preserved." : "Henry could not answer. Check the connection and backend configuration; no answer was generated.");
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "", answer = "", complete = false;
  let sources: Source[] = [];
  const consume = (line: string) => {
    if (!line.startsWith("data:")) return;
    const item = JSON.parse(line.slice(5).trim());
    if (item.t === "delta") answer += item.text;
    if (item.t === "error") throw new PreparationError("failed", "Henry's answer was interrupted. The partial response cannot be used as completed evidence.");
    if (item.t === "done") {
      if (item.stopReason && !["end_turn", "stop_sequence"].includes(item.stopReason)) throw new PreparationError("incomplete", "Henry did not complete this answer. Clarify the request before trying again.");
      complete = true;
      sources = Array.isArray(item.sources) ? item.sources.filter((source: Source) => typeof source.title === "string" && /^https?:\/\//.test(source.url)) : [];
    }
    if (answer.length > 60000) throw new PreparationError("invalid_output", "Henry's response exceeded the preparation limit.");
  };
  try {
    while (true) {
      const chunk = await reader.read();
      buffer += decoder.decode(chunk.value, { stream: !chunk.done });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) consume(line);
      if (chunk.done) { if (buffer.trim()) consume(buffer); break; }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  if (!complete || !answer.trim()) throw new PreparationError("incomplete", "No complete Henry answer was received.");
  return { text: answer, sources };
}

export function browserServices(headers: () => HeadersInit = () => ({}), request: typeof fetch = fetch): PreparationServices {
  const report = async (url: string, init: RequestInit): Promise<AdvisementResponse> => {
    const response = await request(url, init);
    if (!response.ok) throw new PreparationError([400, 404, 410, 502].includes(response.status) ? "report_failed" : "service_unavailable", "The mapper advisement service is unavailable. Calculated findings remain available; no narrative has been generated.");
    const body = await response.json();
    if (typeof body.responseId === "string" && /^resp_[A-Za-z0-9_-]+$/.test(body.responseId)) return body;
    if (typeof body.title !== "string" || !Array.isArray(body.sections) || !body.sections.length || body.sections.some((section: { heading: unknown; body: unknown }) => typeof section.heading !== "string" || typeof section.body !== "string") || JSON.stringify(body).length > 30000) throw new PreparationError("invalid_output", "The mapper returned an incomplete advisement.");
    return body;
  };
  return {
    askHenry: async (message, audience, signal) => readHenryStream(await request("/.netlify/functions/chat-proxy-v2", {
      method: "POST", headers: { ...Object.fromEntries(new Headers(headers()).entries()), "content-type": "application/json" },
      body: JSON.stringify({ message, mode: audience, purpose: "preparation" }), signal,
    })),
    startAdvisement: (payload, signal) => report("/api/explain", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), signal }),
    pollAdvisement: (id, signal) => report(`/api/explain?responseId=${encodeURIComponent(id)}`, { signal }),
  };
}
