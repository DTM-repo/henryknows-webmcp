import { getStore } from "@netlify/blobs";
import { restoreCase, serializeCase } from "../../calculator/src/preparation/case";

export const HANDOFF_TTL_MS = 15 * 60 * 1000;
type Transfer = { case: string; expiresAt: number };
type Store = { get: (key: string, options: { type: "json" }) => Promise<unknown>; setJSON: (key: string, value: Transfer) => Promise<unknown>; delete: (key: string) => Promise<unknown> };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store", "referrer-policy": "no-referrer" } });

export function handoffHandler(store: () => Store, now = Date.now) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return json({ error: "Same-origin request required" }, 403);
    const raw = await request.text();
    if (raw.length > 24000) return json({ error: "Transfer too large" }, 413);
    try {
      const body = JSON.parse(raw);
      if (body.action === "create") {
        if (Object.keys(body).some((key) => !["action", "case"].includes(key)) || typeof body.case !== "string") return json({ error: "Invalid transfer" }, 400);
        const restored = restoreCase(body.case);
        if (!restored) return json({ error: "Only a bounded non-identifying case can be transferred" }, 400);
        const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
        const expiresAt = now() + HANDOFF_TTL_MS;
        await store().setJSON(`transfer/${token}`, { case: serializeCase(restored), expiresAt });
        return json({ token, expiresAt });
      }
      if (body.action === "read" && Object.keys(body).every((key) => ["action", "token"].includes(key)) && typeof body.token === "string" && /^[a-f0-9]{64}$/.test(body.token)) {
        const key = `transfer/${body.token}`;
        const transfer = await store().get(key, { type: "json" }) as Transfer | null;
        if (!transfer || transfer.expiresAt <= now()) {
          if (transfer) await store().delete(key);
          return json({ error: "This continuation link expired. Return to the original tab to create another." }, 410);
        }
        return json(transfer);
      }
      return json({ error: "Invalid transfer request" }, 400);
    } catch { return json({ error: "The continuation service is unavailable. Your original case has not changed." }, 503); }
  };
}

export default handoffHandler(() => getStore({ name: "preparation-handoffs", consistency: "strong" }));
export const config = { rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ["ip", "domain"] } };
