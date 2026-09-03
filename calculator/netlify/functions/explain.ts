import type { ExplanationRequest } from "../../src/ai/explanationPayload";
import { reportStore, type ReportJob } from "./_shared/report";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

// The advisor report runs as a Netlify background function (15-minute limit)
// and parks its result in Netlify Blobs. This endpoint starts jobs (POST) and
// reports their state (GET). Job ids keep the legacy "resp_" prefix so the
// client's id validation and polling flow are unchanged from the OpenAI era.

export default async (request: Request): Promise<Response> => {
  if (!Netlify.env.get("ANTHROPIC_API_KEY")) {
    return json({ error: "ANTHROPIC_API_KEY is not configured" }, 503);
  }
  const store = reportStore();

  if (request.method === "GET") {
    const responseId = new URL(request.url).searchParams.get("responseId") ?? "";
    if (!/^resp_[A-Za-z0-9_-]+$/.test(responseId)) return json({ error: "A valid response ID is required" }, 400);

    const job = (await store.get(responseId, { type: "json" })) as ReportJob | null;
    if (!job) return json({ error: "This advisement is no longer available" }, 404);
    if (job.status === "done") return json(job.report);
    if (job.status === "error") return json({ error: job.error }, 502);
    return json({ responseId, status: job.status }, 202);
  }

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let payload: ExplanationRequest;
  try {
    payload = (await request.json()) as ExplanationRequest;
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  if (!payload.scenario || typeof payload.scenario !== "object") return json({ error: "Scenario is required" }, 400);
  if (JSON.stringify(payload.scenario).length > 30000) return json({ error: "Scenario is too large" }, 400);

  const responseId = `resp_${crypto.randomUUID()}`;
  const job: ReportJob = { status: "queued", payload, createdAt: new Date().toISOString() };
  await store.setJSON(responseId, job);

  // Hand the job to the background worker. Background functions acknowledge
  // with a 202 immediately; the actual generation continues after we return.
  const origin = new URL(request.url).origin;
  const enqueue = await fetch(`${origin}/.netlify/functions/calc-explain-run-background`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ responseId })
  });
  if (!enqueue.ok && enqueue.status !== 202) {
    await store.setJSON(responseId, { status: "error", error: "Could not start the advisement job", createdAt: job.createdAt });
    return json({ error: "Could not start the advisement job" }, 502);
  }

  return json({ responseId, status: "queued" }, 202);
};

export const config = { path: "/api/explain" };
