import { PreparationError, serializeCase } from "./case";
import type { PreparationCase } from "./case";

export function assistantPrompt(url: string) {
  return `Open ${url} in your built-in browser, keep the HenryKnows page visible beside this chat, and use its site tools. Read get_preparation_case silently and follow its capability guide.

Help me work through my situation. Speak directly to me as "you." If no question is already present, ask: "What would you like to figure out?" Ask one necessary question at a time. Record each clear answer in the shared page immediately, without asking permission or repeating it. Never ask for a fact I already gave you or a duplicate you can safely derive. Reuse this page and tool connection throughout instead of reopening or reinitializing it. Do not rerun the same screening after every answer or narrate each tool call.

Use plain language. First notice whether I have chosen a date or am asking you to help me choose one. If I want guidance, do not make me invent a date for the calculation. Ask about my practical constraint, consult HenryKnows, and offer one or two concrete dates or sequences with their consequences. I may choose one, ask you to compare both in my guide, or keep the uncertainty visible. Treat every working date as changeable. Before the new-rule calculation, explain that HenryKnows will put my plan on a timeline and show how the rules taking effect September 15, 2026 affect my dates and choices.

Consult HenryKnows whenever regulatory guidance or clarification is useful. After one concise, settled recap and my confirmation, calculate any relevant timeline and evaluate the evidence. Then author two documents: a practical plain-language guide for me, with the page's canonical timeline, and a concise, primary-source-cited summary for my adviser or DSO. Let the page append the timeline; do not write a second timeline section. Write the professional summary in short, straightforward sentences and lead directly with the case-specific review question. Omit routine professional instruction of every kind unless it is disputed or explains a case-specific departure from normal practice. Handle tool validation, retries, stale references, and operation IDs silently unless I must act. Save both together, read get_preparation_outputs, and say they are ready only if it reports completion.status as "ready". Do not send, file, authorize, or make an immigration determination.`;
}

export function desktopLink(prompt: string) {
  return `codex://new?${new URLSearchParams({ prompt }).toString()}`;
}

export async function createHandoff(current: PreparationCase, base: string, request: typeof fetch = fetch) {
  const url = new URL(base);
  if (!/^https?:$/.test(url.protocol)) throw new PreparationError("unsupported", "Open HenryKnows from its website or local server before continuing.");
  url.search = "";
  url.hash = "assist=start";
  let expiresAt: number | undefined;
  if (current.inquiry || current.context || current.reportedFacts.length || current.assumptions.length || Object.keys(current.scenario).length) {
    const response = await request("/.netlify/functions/preparation-handoff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "create", case: serializeCase(current) }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok || !/^[a-f0-9]{64}$/.test(body.token) || !Number.isFinite(body.expiresAt)) throw new PreparationError("service_unavailable", "The continuation service is unavailable. Nothing was lost. Keep working in this tab or start the assistant with an empty case.");
    url.hash = `assist=${body.token}`;
    expiresAt = body.expiresAt;
  }
  const prompt = assistantPrompt(url.href);
  return { url: url.href, prompt, desktopUrl: desktopLink(prompt), expiresAt };
}

export async function readHandoff(token: string, request: typeof fetch = fetch): Promise<string> {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new PreparationError("invalid_input", "This continuation link is invalid.");
  const response = await request("/.netlify/functions/preparation-handoff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "read", token }) });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || typeof body.case !== "string") throw new PreparationError("expired", "This continuation could not be loaded or has expired. Your original tab is unchanged.");
  return body.case;
}
