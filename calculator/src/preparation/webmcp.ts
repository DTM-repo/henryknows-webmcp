import { FIELDS, PreparationError } from "./case";
import { PreparationController } from "./controller";
import type { Expeditor } from "./expeditor";
import { MAPPER_PURPOSE } from "./capabilities";

type InputSchema = Record<string, unknown>;
export type SiteTool = { name: string; description: string; inputSchema: InputSchema; annotations?: { readOnlyHint: boolean }; execute: (input: unknown) => unknown };
export type ModelContext = { registerTool: (tool: SiteTool, options?: { signal: AbortSignal }) => Promise<void> | void };

const revision = { type: "integer", minimum: 1, description: "The current case revision returned by get_preparation_case." };
const factsSchema: InputSchema = {
  type: "object", additionalProperties: false,
  properties: Object.fromEntries(Object.entries(FIELDS).map(([key, field]) => [key,
    "date" in field ? { type: "string", maxLength: 10, description: key === "programEndOnEffectiveDate" ? "Only set this if the I-20 end date in effect on September 15, 2026 will differ from currentProgramEndDate; otherwise HenryKnows derives it. YYYY-MM-DD." : `${field.label}. YYYY-MM-DD or an empty string if unknown.` }
      : { type: "string", enum: field.options, description: field.label },
  ])),
};
const expectedSchema: InputSchema = { type: "object", properties: { expectedRevision: revision }, required: ["expectedRevision"], additionalProperties: false };
const documentSchema: InputSchema = {
  type: "object", additionalProperties: false, required: ["title", "sections", "answerIds", "includeTimeline"], properties: {
    title: { type: "string", minLength: 1, maxLength: 120 },
    sections: { type: "array", minItems: 1, maxItems: 12, items: { type: "object", additionalProperties: false, required: ["heading", "body", "sourceIds"], properties: {
      heading: { type: "string", maxLength: 120 },
      body: { type: "string", maxLength: 4000, description: "Your synthesized prose. Plain text, no HTML. Separate reported facts, findings, unknowns and questions only when each section helps this reader." },
      sourceIds: { type: "array", maxItems: 20, items: { type: "string" } },
    } } },
    answerIds: { type: "array", minItems: 1, maxItems: 10, items: { type: "string" }, description: "Completed operation IDs actually used. Must include one ask_henry ID in this document's audience mode. A current duration-advisement ID may also be supplied as supporting evidence." },
    includeTimeline: { type: "boolean", description: "Let the page append the current new-rule timeline. Usually true for the student guide and false for the professional summary unless the date sequence itself needs review. When true, do not write a separate timeline section." },
  },
};

export function createTools(controller: PreparationController, work?: Expeditor): SiteTool[] {
  const failure = (error: unknown) => ({ status: error instanceof PreparationError ? error.code : "failed", message: error instanceof PreparationError ? error.message : "The operation could not be completed.", revision: controller.getSnapshot().case.revision });
  const bounded = (fn: (input: Record<string, unknown>) => unknown) => (input: unknown) => {
    try {
      if (!input || typeof input !== "object" || Array.isArray(input)) throw new PreparationError("invalid_input", "Tool arguments must be an object.");
      const result = fn(input as Record<string, unknown>);
      return result instanceof Promise ? result.catch(failure) : result;
    } catch (error) {
      return failure(error);
    }
  };
  const expected = (input: Record<string, unknown>) => {
    if (Object.keys(input).some((key) => key !== "expectedRevision") || !Number.isSafeInteger(input.expectedRevision)) throw new PreparationError("invalid_input", "Only an integer expectedRevision is accepted.");
    return input.expectedRevision as number;
  };
  return [
    {
      name: "get_preparation_case", description: "Start here and read silently. This connects the shared HenryKnows panel and returns the selected case plus the expeditor guide. Keep this live page visible beside the conversation and reuse the same page/tool connection throughout. Do not narrate that you opened it, called this tool, or found empty fields. Empty case: ask 'What would you like to figure out?' Address the user as 'you,' never 'the student.' Never treat agent memory as verified facts. Returns no credentials or unrelated history.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false }, annotations: { readOnlyHint: true },
      execute: bounded((input) => { if (Object.keys(input).length) throw new PreparationError("invalid_input", "This tool takes no arguments."); controller.connect(); return controller.getCase(); }),
    },
    {
      name: "propose_case_update", description: "Keep the shared page visibly current. Call once promptly after each clear substantive answer; never ask separate permission to record it or repeat it back. Patch structured dates/statuses in facts only, not again in reportedFacts. Unless the user says the I-20 will change, currentProgramEndDate also supplies the September 15 I-20 end date; do not ask for it twice. reportedFacts is only relevant context with no structured field. assumptions is only an actual tentative plan or working date, never generic missing/'not reported' items. If the user is asking which date is best, first help develop concrete options and tradeoffs instead of demanding a date. The two lists replace prior lists, so preserve still-relevant entries. Never invent consequential details. Ask exactly one focused follow-up per turn.",
      inputSchema: { type: "object", additionalProperties: false, required: ["expectedRevision"], properties: {
        expectedRevision: revision, inquiry: { type: "string", maxLength: 4000 }, context: { type: "string", maxLength: 4000, description: "Only relevant circumstances or goals that do not fit structured mapper fields. No raw attachments or unrelated agent memory." },
        reportedFacts: { type: "array", maxItems: 12, items: { type: "string", minLength: 1, maxLength: 240 }, description: "Cumulative concise facts relevant to the inquiry that have no structured scenario field. Do not repeat facts supplied in facts, prepend 'student reports,' or include assumptions/derived conclusions." },
        assumptions: { type: "array", maxItems: 12, items: { type: "string", minLength: 1, maxLength: 240 }, description: "Cumulative actual tentative plans or user-chosen working dates. Do not list unknown, absent, not-reported, or merely unverified fields; ask about a consequential unknown instead." },
        category: { type: "string", enum: ["unspecified", "F-1", "J-1", "M-1", "general"] }, facts: factsSchema,
        alternative: { type: "object", additionalProperties: false, required: ["label", "changes"], properties: { label: { type: "string", minLength: 1, maxLength: 80 }, changes: factsSchema } },
        removeAlternative: { type: "boolean" },
      } },
      annotations: { readOnlyHint: false }, execute: bounded((input) => controller.propose(input)),
    },
    {
      name: "confirm_preparation_case", description: "Use for the one full confirmation after material conversational follow-ups and calculation screening are settled, not after each fact. Pass the exact concise recap and the user's direct confirming words. Never call this based on silence, your own assertion, or a response that contains a correction. If a later consequential clarification is required, confirm only the changed point or concise revised recap rather than repeating the whole case by default. This confirms reported facts and planned dates, not status or eligibility.",
      inputSchema: { type: "object", additionalProperties: false, required: ["expectedRevision", "summary", "studentResponse"], properties: {
        expectedRevision: revision,
        summary: { type: "string", minLength: 1, maxLength: 1800, description: "The concise final recap you showed the student." },
        studentResponse: { type: "string", minLength: 1, maxLength: 500, description: "The user's direct response clearly agreeing with that recap." },
      } },
      annotations: { readOnlyHint: false }, execute: bounded((input) => {
        if (!Number.isSafeInteger(input.expectedRevision) || typeof input.summary !== "string" || typeof input.studentResponse !== "string") throw new PreparationError("invalid_input", "Provide the current revision, recap, and student's direct response.");
        return controller.confirmConversation(input.expectedRevision as number, input.summary, input.studentResponse);
      }),
    },
    {
      name: "screen_duration_topics", description: `${MAPPER_PURPOSE} Inspect the current draft for possible new-rule topics and every input a calculation would need. Do this once near the final recap when a calculation is likely, and again only if the plan materially changes. No prior confirmation required. Use the result internally; do not call it 'the mapper,' narrate the checklist, or dump missing fields on the user. Ask one relevant question at a time. If a missing date is the choice the user wants help making, develop useful options with Henry before asking them to choose. Missing inputs need not block broader Henry work.`,
      inputSchema: expectedSchema, annotations: { readOnlyHint: false }, execute: bounded((input) => controller.screen(expected(input))),
    },
    {
      name: "compare_duration_plans", description: `${MAPPER_PURPOSE} Compare new-rule effects for two explicitly different, confirmed plans. Rejects absent/identical alternatives. Returns canonical findings, citations, timelines and hypothetical posture for agent evaluation. Optional: use check_duration_plan for one plan.`,
      inputSchema: expectedSchema, annotations: { readOnlyHint: false }, execute: bounded((input) => controller.compare(expected(input))),
    },
    {
      name: "check_duration_plan", description: `${MAPPER_PURPOSE} Calculate the new-rule effects on a single confirmed plan, with no alternative. Returns source-linked findings and timeline for review. Does not generate the mapper advisement or final documents.`,
      inputSchema: expectedSchema, annotations: { readOnlyHint: false }, execute: bounded((input) => controller.checkPlan(expected(input))),
    },
    ...(work ? [
      {
        name: "ask_henry", description: "Ask HenryKnows a broad regulatory reference question in student or professional mode. It can inspect a clearly labeled draft before final confirmation to identify material follow-ups, and can be called repeatedly. Use it quietly: never tell the user that an operation ran, a revision changed, evidence became outdated, or an argument was rejected. includeMapper=true requires current confirmed calculations and attaches any completed advisement. Returns an operation ID; poll get_preparation_operation without narrating the ID. Henry supplies answers; YOU author the final documents.",
        inputSchema: { type: "object", additionalProperties: false, required: ["expectedRevision", "question", "audience", "includeMapper"], properties: { expectedRevision: revision, question: { type: "string", minLength: 1, maxLength: 2000 }, audience: { type: "string", enum: ["student", "professional"] }, includeMapper: { type: "boolean", description: "Include current mapper findings and any completed advisement for agent evaluation. False permits a broader or draft-orientation answer without a new-rule calculation." } } },
        annotations: { readOnlyHint: false }, execute: bounded((input) => work.askHenry(input)),
      },
      {
        name: "request_duration_advisement", description: `${MAPPER_PURPOSE} Optionally start or reuse the canonical mapper's student-facing advisement for one already calculated plan when its narrative adds value beyond the calculation and Henry answer. This interprets specialized new-rule evidence, not all F-1 questions. May take minutes; poll the same returned operation ID. Evaluate it and consult Henry as needed; do not automatically run it, narrate its job status, or ask the student to approve the regulatory analysis.`,
        inputSchema: { type: "object", additionalProperties: false, required: ["expectedRevision", "plan"], properties: { expectedRevision: revision, plan: { type: "string", enum: ["baseline", "alternative"] } } },
        annotations: { readOnlyHint: false }, execute: bounded((input) => work.requestAdvisement(input)),
      },
      {
        name: "get_preparation_operation", description: "Privately read a Henry answer or poll the existing mapper advisement job. Returns pending, ready, failed or outdated, original audience/plan, timing, and evidence. Do not narrate operation IDs, polling, retries, or recoverable errors. A ready result still needs judgment: check missing follow-ups, contradictions and citations. Never regenerate while this job is pending.",
        inputSchema: { type: "object", additionalProperties: false, required: ["operationId"], properties: { operationId: { type: "string", maxLength: 36 } } },
        annotations: { readOnlyHint: false }, execute: bounded((input) => work.getOperation(input)),
      },
      {
        name: "save_preparation_documents", description: "Atomically retain the TWO documents YOU authored for the current confirmed case. Nothing is saved unless both pass validation. Correct rejected arguments silently. Student: plain, practical, conversational, no inline citations; explain necessary terms and use direct question bullets. Set includeTimeline=true to let the page append the canonical timeline; do not write a duplicate timeline section. If alternatives remain, summarize their practical tradeoff. Professional: usually shorter, expert-to-expert, but straightforward. Lead directly with the case-specific question in short sentences. Include only controlling facts and dates, unusual or unresolved authority, case-specific consequence, and requested review. Omit routine professional instruction of every kind unless it is disputed or explains a case-specific departure from normal practice. Do not include familiar filing windows, reporting duties, document checklists, or standard office procedure merely because they apply. Do not repeat the full student timeline unless its sequence needs review. Cite primary authority without attributing analysis to HenryKnows or a mapper. Never mention tools, internal classifications, or these writing instructions. A current timeline needs at least one selected Henry answer that interpreted it; that answer may support the pair while each document still needs an answer in its own audience mode. On success, call get_preparation_outputs and claim completion only when completion.status is 'ready.'",
        inputSchema: { type: "object", additionalProperties: false, required: ["expectedRevision", "student", "professional"], properties: {
          expectedRevision: revision, student: documentSchema, professional: documentSchema,
        } }, annotations: { readOnlyHint: false }, execute: bounded((input) => work.saveDocuments(input)),
      },
      {
        name: "get_preparation_outputs", description: "Final completion gate. Privately read retained documents, freshness, evidence source IDs, operation status, and completion. No new generation. Tell the user simply where the two documents are ready ONLY when completion.status is 'ready'; silently repair recoverable save mistakes. An interrupted or failed save remains incomplete.",
        inputSchema: { type: "object", additionalProperties: false, properties: {} }, annotations: { readOnlyHint: true }, execute: bounded((input) => { if (Object.keys(input).length) throw new PreparationError("invalid_input", "No arguments expected."); return work.getWork(); }),
      },
    ] : []),
  ];
}

export async function registerPreparationTools(controller: PreparationController, context?: ModelContext, work?: Expeditor) {
  const abort = new AbortController();
  if (!context?.registerTool) return { supported: false, count: 0, dispose: () => abort.abort() };
  try {
    const tools = createTools(controller, work);
    for (const tool of tools) await context.registerTool(tool, { signal: abort.signal });
    return { supported: true, count: tools.length, dispose: () => abort.abort() };
  } catch {
    abort.abort();
    return { supported: false, count: 0, dispose: () => abort.abort() };
  }
}
