import { json, getCodeRecord, setCodeRecord, clearCode, signSession } from "./_shared/lib.js";

export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const { email, code } = await req.json().catch(() => ({}));
  if (!email || !code) return json({ valid: false, error: "Email and code required." });

  const rec = await getCodeRecord(email);
  if (!rec || rec.exp < Date.now()) {
    return json({ valid: false, error: "That code has expired — request a new one." });
  }
  if ((rec.attempts || 0) >= 5) {
    await clearCode(email);
    return json({ valid: false, error: "Too many attempts — request a new code." });
  }
  if (String(rec.code) !== String(code).trim()) {
    rec.attempts = (rec.attempts || 0) + 1;
    await setCodeRecord(email, rec);
    return json({ valid: false, error: "Incorrect code. Please try again." });
  }

  await clearCode(email);
  return json({ valid: true, email: email.toLowerCase(), session: signSession(email) });
};
