import { json, getCodeRecord, setCodeRecord } from "./_shared/lib.js";

// Emails a 6-digit sign-in code (typed in the same tab — no link, no tab-switch,
// so an in-progress conversation is never lost).
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const { email } = await req.json().catch(() => ({}));
  if (
    !email ||
    typeof email !== "string" ||
    !email.includes("@") ||
    email.length > 254
  )
    return json({ error: "Valid email required" }, 400);

  // Cooldown: one code per address per minute, so this endpoint can't be used
  // to email-bomb an address or drain the Resend quota.
  const prev = await getCodeRecord(email);
  if (prev?.issuedAt && Date.now() - prev.issuedAt < 60 * 1000) {
    return json({
      success: true,
      note: "A code was just sent — check your inbox (and spam).",
    });
  }

  const code = String(Math.floor(100000 + Math.random() * 900000)); // 6 digits
  await setCodeRecord(email, {
    code,
    exp: Date.now() + 15 * 60 * 1000,
    issuedAt: Date.now(),
    attempts: 0,
  });

  const from = process.env.MAGIC_FROM || "Henry <henry@henryknows.info>";
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: email,
        subject: `Your HenryKnows sign-in code: ${code}`,
        html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#2c3e50">
          <h2 style="color:#1e3a5f">Your HenryKnows sign-in code</h2>
          <p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#1e3a5f">${code}</p>
          <p>Enter this code in the tab where you were chatting. It expires in 15 minutes.</p>
          <p style="font-size:12px;color:#6b7a8d">If you didn't request this, you can ignore it.</p>
        </div>`,
      }),
    });
    if (!r.ok) {
      const detail = await r.text();
      return json({ error: "Could not send code", detail: detail.slice(0, 200) }, 502);
    }
    return json({ success: true });
  } catch {
    return json({ error: "Could not send code" }, 502);
  }
};
