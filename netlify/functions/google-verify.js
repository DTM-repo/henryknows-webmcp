import { json, signSession, GOOGLE_CLIENT_ID } from "./_shared/lib.js";

// Verifies the Google ID token SERVER-SIDE (the old frontend trusted a
// client-decoded JWT, which is spoofable). Only then do we mint a session.
export default async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const { credential } = await req.json().catch(() => ({}));
  if (!credential) return json({ error: "Missing credential" }, 400);

  try {
    const r = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
    );
    const info = await r.json();
    if (!r.ok || info.aud !== GOOGLE_CLIENT_ID || !info.email) {
      return json({ error: "Invalid Google token" }, 401);
    }
    if (info.email_verified === "false" || info.email_verified === false) {
      return json({ error: "Google email not verified" }, 401);
    }
    const email = info.email.toLowerCase();
    return json({ email, session: signSession(email) });
  } catch {
    return json({ error: "Verification failed" }, 502);
  }
};
