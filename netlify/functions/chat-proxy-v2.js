import Anthropic from "@anthropic-ai/sdk";
import {
  json,
  emailFromAuth,
  getUsage,
  bumpUsage,
  isPaid,
  REGISTERED_MONTHLY_LIMIT,
  STUDENT_MONTHLY_LIMIT,
  paidTier,
} from "./_shared/lib.js";
import {
  createConversationId,
  isSafeConversationId,
  saveConversation,
} from "./_shared/history.js";
import { retrieve, renderSources } from "./_shared/retrieval.js";
import { HENRY_SYSTEM, HENRY_STUDENT_MODE } from "./_shared/henry-prompt.js";
import { judgeDemoEnabled } from "./_shared/preparation-access.js";

// Henry's owned answer engine: BM25 retrieval over the repo knowledge base +
// the Claude API, streamed. Answers are delivered as SSE (data: {t,...})
// because synchronous Netlify functions cap out around 10-26s and frontier
// answers routinely run past that; streaming starts the response immediately.
// Input errors and the quota gate still return plain JSON — the frontend
// branches on Content-Type. Quota/paid/history enforcement matches
// chat-proxy.js (the retired Chatbase path).

const MODEL = process.env.HENRY_MODEL || "claude-fable-5";
// "low" is deliberate: on this model it matched medium's answers and
// citations in testing while avoiding 25s+ first-token thinking stalls.
const EFFORT = process.env.HENRY_EFFORT || "low";

let anthropic = null; // lazy: constructor throws without ANTHROPIC_API_KEY
function client() {
  if (!anthropic) anthropic = new Anthropic();
  return anthropic;
}

const REFUSAL_MSG =
  "I can't help with that request. Henry answers regulatory reference questions for international student advisors — try rephrasing your question in those terms.";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  const userMsg = body.message;
  if (!userMsg) return json({ error: "Empty message" }, 400);
  if (typeof userMsg !== "string" || userMsg.length > (body.purpose === "preparation" ? 32000 : 16000))
    return json({ error: "Message too long" }, 400);

  // Same hard stop as the old chat-proxy: a SEVIS ID never reaches the model.
  if (/\bN\d{10}\b/.test(userMsg))
    return json(
      {
        error:
          "That message appears to include a SEVIS ID. Henry isn't for student case files — please remove student identifiers and try again.",
      },
      400
    );

  const email = emailFromAuth(req);

  const judgeDemo = judgeDemoEnabled();
  let paid = judgeDemo; // Demo is deployment-owned, never a request parameter.
  if (email && !judgeDemo) {
    const tier = await paidTier(email);
    paid = tier === "basic";
    if (!paid) {
      const limit = tier === "student" ? STUDENT_MONTHLY_LIMIT : REGISTERED_MONTHLY_LIMIT;
      const used = await getUsage(email);
      if (used >= limit) return json({ gated: true, tier: tier || "registered" });
    }
  }

  const conversationId = body.purpose === "preparation" ? null :
    email && isSafeConversationId(body.conversationId)
      ? body.conversationId
      : email
        ? createConversationId()
        : null;

  const messages = (
    Array.isArray(body.messages) && body.messages.length
      ? body.messages
      : [{ role: "user", content: userMsg }]
  )
    .filter(
      (m) =>
        m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string"
    )
    .slice(-80)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 16000) }));
  if (!messages.length) return json({ error: "Empty message" }, 400);

  // Retrieve on the current question plus a slice of the previous assistant
  // turn, so short follow-ups ("what about part-time?") still find the
  // right documents.
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
  const query = lastAssistant
    ? `${userMsg}\n${lastAssistant.content.slice(0, 600)}`
    : userMsg;

  let apiStream;
  let sourceMetadata = [];
  try {
    const hits = await retrieve(query, 10);
    const sources = renderSources(hits);
    sourceMetadata = hits.map((hit, index) => ({ id: String(index + 1), title: hit.title, url: hit.url || "", heading: hit.heading || "", retrieved: hit.fetched || null }));
    const apiMessages = messages.slice(0, -1).concat({
      role: "user",
      content: `<sources>\n${sources}\n</sources>\n\n${userMsg}`,
    });

    apiStream = await client().beta.messages.create({
      model: MODEL,
      max_tokens: 8000,
      stream: true,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: EFFORT },
      system: [
        { type: "text", text: HENRY_SYSTEM, cache_control: { type: "ephemeral" } },
        // Mode block sits AFTER the cached prefix so toggling never re-bills it.
        ...(body.mode === "student" ? [{ type: "text", text: HENRY_STUDENT_MODE }] : []),
        { type: "text", text: `Today's date is ${new Date().toISOString().slice(0, 10)}.` },
      ],
      messages: apiMessages,
    });
  } catch (err) {
    console.error("henry-v2 setup error:", err?.status || "", err?.message || err);
    return json({ error: "Request failed" }, 502);
  }

  const encoder = new TextEncoder();
  const sse = (obj) => encoder.encode(`data: ${JSON.stringify(obj)}\n\n`);

  const stream = new ReadableStream({
    async start(controller) {
      let full = "";
      let stopReason = null;
      let served = MODEL;
      try {
        for await (const ev of apiStream) {
          if (ev.type === "message_start") {
            served = ev.message?.model || served;
          } else if (
            ev.type === "content_block_delta" &&
            ev.delta?.type === "text_delta"
          ) {
            full += ev.delta.text;
            controller.enqueue(sse({ t: "delta", text: ev.delta.text }));
          } else if (ev.type === "message_delta") {
            stopReason = ev.delta?.stop_reason || stopReason;
          }
        }

        if (stopReason === "refusal" && !full.trim()) {
          full = REFUSAL_MSG;
          controller.enqueue(sse({ t: "delta", text: REFUSAL_MSG }));
        }

        console.log(`henry-v2 model=${served} stop=${stopReason} chars=${full.length}`);

        if (full.trim()) {
          if (email && !paid) await bumpUsage(email);
          if (email && conversationId) {
            await saveConversation(email, conversationId, [
              ...messages,
              { role: "assistant", content: full },
            ]).catch(() => {});
          }
          controller.enqueue(sse({ t: "done", conversationId, ...(body.purpose === "preparation" ? { sources: sourceMetadata, stopReason } : {}) }));
        } else {
          controller.enqueue(sse({ t: "error" }));
        }
      } catch (err) {
        console.error("henry-v2 stream error:", err?.message || err);
        controller.enqueue(sse({ t: "error" }));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    },
  });
};

export const config = { rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] } };
