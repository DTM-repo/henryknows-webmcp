import {
  json,
  emailFromAuth,
  getUsage,
  bumpUsage,
  isPaid,
  REGISTERED_MONTHLY_LIMIT,
} from "./_shared/lib.js";
import {
  createConversationId,
  isSafeConversationId,
  saveConversation,
} from "./_shared/history.js";

// Forwards to the Chatbase agent, but enforces quota/paid status SERVER-SIDE
// keyed to a verified session — not the client's self-reported email/anonymous.
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const body = await req.json().catch(() => ({}));
  const userMsg = body.message;
  if (!userMsg) return json({ error: "Empty message" }, 400);
  // Attachment text is capped at 12k chars client-side; anything past this is abuse.
  if (typeof userMsg !== "string" || userMsg.length > 16000)
    return json({ error: "Message too long" }, 400);

  // Henry is a regulatory reference, not a case-file tool. The frontend screens
  // and offers redaction; this is the hard stop for the one unambiguous student
  // identifier, so a SEVIS ID never reaches the upstream model from any caller.
  if (/\bN\d{10}\b/.test(userMsg))
    return json(
      {
        error:
          "That message appears to include a SEVIS ID. Henry isn't for student case files — please remove student identifiers and try again.",
      },
      400
    );

  const email = emailFromAuth(req); // null => anonymous (soft-gated by frontend)

  // Quota check for registered, non-paid users.
  let paid = false;
  if (email) {
    paid = await isPaid(email);
    if (!paid) {
      const used = await getUsage(email);
      if (used >= REGISTERED_MONTHLY_LIMIT) return json({ gated: true });
    }
  }

  const conversationId =
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

  try {
    const r = await fetch("https://www.chatbase.co/api/v1/chat", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CHATBASE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chatbotId: process.env.CHATBASE_BOT_ID,
        stream: false,
        temperature: 0,
        messages,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || !data.text) return json({ error: "Upstream error" }, 502);

    if (email && !paid) await bumpUsage(email);

    if (email && conversationId) {
      await saveConversation(email, conversationId, [
        ...messages,
        { role: "assistant", content: data.text },
      ]).catch(() => {});
    }

    return json({
      response: data.text,
      conversationId,
      gated: false,
    });
  } catch {
    return json({ error: "Request failed" }, 502);
  }
};
