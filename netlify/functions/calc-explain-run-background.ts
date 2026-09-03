// Background worker for the Duration Mapper advisor report.
// The "-background" suffix makes Netlify run this with the 15-minute
// background-function limit; callers get an immediate 202.
import type { ExplanationRequest } from "../../calculator/src/ai/explanationPayload";
import { generateReport, reportStore, type ReportJob } from "../../calculator/netlify/functions/_shared/report";

export default async (request: Request): Promise<void> => {
  let responseId = "";
  try {
    const body = (await request.json()) as { responseId?: string };
    responseId = body.responseId ?? "";
  } catch {
    return;
  }
  if (!/^resp_[A-Za-z0-9_-]+$/.test(responseId)) return;

  const store = reportStore();
  const job = (await store.get(responseId, { type: "json" })) as ReportJob | null;
  if (!job || job.status !== "queued" || !job.payload) return;

  await store.setJSON(responseId, { status: "in_progress", createdAt: job.createdAt });
  try {
    const report = await generateReport(job.payload as ExplanationRequest);
    await store.setJSON(responseId, { status: "done", report, createdAt: job.createdAt });
  } catch (error) {
    await store.setJSON(responseId, {
      status: "error",
      error: error instanceof Error ? error.message : "The advisement could not be generated",
      createdAt: job.createdAt
    });
  }
};
