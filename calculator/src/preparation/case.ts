import { isValidDateString } from "../engine/dateMath";
import type { StudentScenario } from "../engine/types";

const YES_NO = ["unknown", "yes", "no"];
type Field = { label: string; options?: readonly string[]; date?: true };

export const FIELDS = {
  startingPosition: { label: "Starting situation", options: ["unknown", "current_ds_inside_us", "prospective_outside_us", "change_status_inside_us", "readmitted_fixed_period", "transfer_or_program_change"] },
  admissionBasis: { label: "Admission basis", options: ["unknown", "duration_of_status", "fixed_period"] },
  inUsOnEffectiveDate: { label: "In the U.S. on September 15, 2026", options: YES_NO },
  maintainingStatusOnEffectiveDate: { label: "Maintaining status on September 15, 2026", options: YES_NO },
  programStartDate: { label: "Program start date", date: true },
  currentProgramEndDate: { label: "Current I-20 program end date", date: true },
  programEndOnEffectiveDate: { label: "I-20 end date in place on September 15, 2026", date: true },
  optIntent: { label: "Planning OPT", options: YES_NO },
  optStage: { label: "OPT stage", options: ["unknown", "none", "pre_completion", "post_completion_not_filed", "post_completion_pending", "post_completion_approved", "stem_not_filed", "stem_pending", "stem_approved"] },
  optFilingDate: { label: "OPT application filing date", date: true },
  dsoRecommendedOpt: { label: "DSO recommendation received", options: YES_NO },
  cptPlan: { label: "CPT during the program", options: ["unknown", "none", "planned"] },
  travelPosture: { label: "International travel", options: ["unknown", "none", "planned", "completed", "automatic_visa_revalidation"] },
  reentryDate: { label: "Return date", date: true },
  reentryBasis: { label: "Basis for return", options: ["unknown", "same_i20_balance", "new_f1_admission", "longer_program_i20", "automatic_visa_revalidation"] },
  optFiledBeforeDeparture: { label: "OPT filing before departure", options: YES_NO },
  pendingExtensionOnDeparture: { label: "Extension pending at departure", options: YES_NO },
  educationLevel: { label: "Education level", options: ["unknown", "undergraduate", "graduate", "other"] },
  programType: { label: "Program type", options: ["unknown", "college_or_university", "english_language_training", "public_high_school", "private_high_school", "other"] },
  firstAcademicYearCompleted: { label: "First academic year completed", options: YES_NO },
  i94AdmitUntilDate: { label: "Actual I-94 admit-until date", date: true },
  currentEadEndDate: { label: "Current EAD end date", date: true },
  eadEndOnEffectiveDate: { label: "EAD end date in place on September 15, 2026", date: true },
  schoolTransferPlan: { label: "School transfer planned", options: YES_NO },
  academicProgramChangePlan: { label: "Program change planned", options: YES_NO },
  nextProgramLevelPlan: { label: "Later program", options: ["unknown", "not_planning", "higher", "same_or_lower"] },
  nextProgramStartDate: { label: "Later program start date", date: true },
  nextProgramEndDate: { label: "Later program end date", date: true },
  returnProgramStartDate: { label: "Return I-20 program start date", date: true },
  returnProgramEndDate: { label: "Return I-20 program end date", date: true },
  hasF2Dependents: { label: "F-2 dependents", options: YES_NO },
  earlyEndSituation: { label: "Early program ending", options: ["unknown", "none", "completed_early", "authorized_withdrawal", "status_violation"] },
  earlyEndDate: { label: "Early ending date", date: true },
  pendingEmploymentImmigrantPetition: { label: "Employment immigrant petition pending", options: YES_NO },
} as const satisfies Record<string, Field>;

export type ScenarioField = keyof typeof FIELDS;
export type ScenarioFacts = Omit<Partial<Pick<StudentScenario, ScenarioField>>, "optStage"> & { optStage?: StudentScenario["optStage"] | "unknown" };
export type Category = "unspecified" | "F-1" | "J-1" | "M-1" | "general";
export type Alternative = { label: string; changes: ScenarioFacts };
export type ConversationConfirmation = {
  revision: number;
  summary: string;
  studentResponse: string;
  channel: "agent_chat";
  confirmedAt: string;
};
export type PreparationCase = {
  schemaVersion: 1;
  id: string;
  revision: number;
  inquiry: string;
  context: string;
  reportedFacts: string[];
  assumptions: string[];
  category: Category;
  scenario: ScenarioFacts;
  alternative: Alternative | null;
  confirmedRevision: number | null;
  confirmedAt: string | null;
  confirmation: ConversationConfirmation | null;
};
export type CaseUpdate = {
  expectedRevision: number;
  inquiry?: string;
  context?: string;
  reportedFacts?: string[];
  assumptions?: string[];
  category?: Category;
  facts?: ScenarioFacts;
  alternative?: Alternative;
  removeAlternative?: boolean;
};
export type CaseIssue = { plan: "baseline" | "alternative"; field: string; message: string };

export class PreparationError extends Error {
  constructor(public code: string, message: string) { super(message); }
}

function object(value: unknown, keys: readonly string[]): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new PreparationError("invalid_input", "Expected an object.");
  }
  if (Object.keys(value).some((key) => !keys.includes(key))) {
    throw new PreparationError("invalid_input", "The request includes an unsupported field.");
  }
}

export function assertSafeInquiry(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.length > 4000) {
    throw new PreparationError("invalid_input", "The question must be text, up to 4,000 characters.");
  }
  if (/\bN\d{10}\b|\b\d{3}-\d{2}-\d{4}\b|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:passport|student\s+id|emplid|i-?94\s+(?:number|no\.?))\s*[:#]?\s*[A-Z0-9-]*\d[A-Z0-9-]{4,}/i.test(value)) {
    throw new PreparationError("sensitive_input", "Remove personal identifiers and email addresses. Share only the circumstances needed for this question.");
  }
  if (/--- Attached document|<sources>|BEGIN (?:RSA |OPENSSH )?PRIVATE KEY|\b(?:sk-ant-|sk-proj-)/i.test(value)) {
    throw new PreparationError("sensitive_input", "Attachments, credentials, and source payloads cannot be added as case facts.");
  }
}

function validateSummaryList(value: unknown, label: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length > 12 || value.some((item) => typeof item !== "string" || !item.trim() || item.length > 240)) {
    throw new PreparationError("invalid_input", `${label} must be a short list of up to 12 relevant items.`);
  }
  for (const item of value) assertSafeInquiry(item);
}

function validateFacts(value: unknown): asserts value is ScenarioFacts {
  object(value, Object.keys(FIELDS));
  for (const [key, answer] of Object.entries(value)) {
    const field: Field = FIELDS[key as ScenarioField];
    if (typeof answer !== "string") throw new PreparationError("invalid_input", `${field.label} must be text.`);
    if (field.date ? answer !== "" && !isValidDateString(answer) : !field.options?.includes(answer)) {
      throw new PreparationError("invalid_input", `Check ${field.label.toLowerCase()}. Dates must be complete YYYY-MM-DD dates, or blank when unknown.`);
    }
  }
  if (value.travelPosture === "none" && value.reentryDate) {
    throw new PreparationError("needs_correction", "No international travel conflicts with a return date in the same proposal.");
  }
}

export function validateUpdate(value: unknown): asserts value is CaseUpdate {
  object(value, ["expectedRevision", "inquiry", "context", "reportedFacts", "assumptions", "category", "facts", "alternative", "removeAlternative"]);
  if (!Number.isSafeInteger(value.expectedRevision) || Number(value.expectedRevision) < 1) {
    throw new PreparationError("invalid_input", "A valid expectedRevision is required.");
  }
  if (value.inquiry !== undefined) assertSafeInquiry(value.inquiry);
  if (value.context !== undefined) assertSafeInquiry(value.context);
  if (value.reportedFacts !== undefined) validateSummaryList(value.reportedFacts, "Reported facts");
  if (value.assumptions !== undefined) validateSummaryList(value.assumptions, "Assumptions");
  if (value.category !== undefined && (typeof value.category !== "string" || !["unspecified", "F-1", "J-1", "M-1", "general"].includes(value.category))) {
    throw new PreparationError("invalid_input", "Choose a supported category or leave it unspecified.");
  }
  if (value.facts !== undefined) validateFacts(value.facts);
  if (value.removeAlternative !== undefined && typeof value.removeAlternative !== "boolean") {
    throw new PreparationError("invalid_input", "removeAlternative must be a boolean.");
  }
  if (value.alternative !== undefined) {
    object(value.alternative, ["label", "changes"]);
    if (typeof value.alternative.label !== "string" || !value.alternative.label.trim() || value.alternative.label.length > 80) {
      throw new PreparationError("invalid_input", "Give the alternative a short label.");
    }
    assertSafeInquiry(value.alternative.label);
    validateFacts(value.alternative.changes);
  }
  if (value.alternative && value.removeAlternative) throw new PreparationError("invalid_input", "An alternative cannot be added and removed in the same request.");
}

export function createCase(): PreparationCase {
  return { schemaVersion: 1, id: crypto.randomUUID(), revision: 1, inquiry: "", context: "", reportedFacts: [], assumptions: [], category: "unspecified", scenario: {}, alternative: null, confirmedRevision: null, confirmedAt: null, confirmation: null };
}

export function assertRevision(current: PreparationCase, expected: number): void {
  if (expected !== current.revision) throw new PreparationError("stale_revision", "The case changed. Read its current revision before continuing.");
}

function patchFacts(current: ScenarioFacts, changes: ScenarioFacts): ScenarioFacts {
  const next: ScenarioFacts = { ...current, ...changes };
  if (changes.travelPosture === "none") {
    next.reentryDate = "";
    next.reentryBasis = "unknown";
    next.optFiledBeforeDeparture = "unknown";
  } else if ((changes.reentryDate !== undefined && changes.reentryDate !== current.reentryDate) ||
             (changes.optFilingDate !== undefined && changes.optFilingDate !== current.optFilingDate)) {
    if (changes.optFiledBeforeDeparture === undefined) next.optFiledBeforeDeparture = "unknown";
  }
  return next;
}

export function alternativeFacts(current: PreparationCase): ScenarioFacts | null {
  return current.alternative ? patchFacts(current.scenario, current.alternative.changes) : null;
}

export function changedFields(current: PreparationCase): ScenarioField[] {
  const other = alternativeFacts(current);
  return other ? (Object.keys(FIELDS) as ScenarioField[]).filter((field) =>
    (current.scenario[field] || "unknown") !== (other[field] || "unknown")) : [];
}

export function reviseCase(current: PreparationCase, input: unknown): PreparationCase {
  validateUpdate(input);
  assertRevision(current, input.expectedRevision);
  const next = structuredClone(current);
  if (input.inquiry !== undefined) next.inquiry = input.inquiry;
  if (input.context !== undefined) next.context = input.context;
  if (input.reportedFacts !== undefined) next.reportedFacts = [...input.reportedFacts];
  if (input.assumptions !== undefined) next.assumptions = [...input.assumptions];
  if (input.category !== undefined) next.category = input.category;
  if (input.facts) next.scenario = patchFacts(current.scenario, input.facts);
  if (input.alternative) next.alternative = structuredClone(input.alternative);
  if (input.removeAlternative) next.alternative = null;
  if (next.alternative && !input.alternative && input.facts?.optFilingDate !== undefined && input.facts.optFilingDate !== current.scenario.optFilingDate) {
    next.alternative.changes.optFiledBeforeDeparture = "unknown";
  }
  const identity = (c: PreparationCase) => JSON.stringify([c.inquiry, c.context, c.reportedFacts, c.assumptions, c.category, c.scenario, c.alternative]);
  if (identity(next) === identity(current)) return current;
  next.revision++;
  next.confirmedRevision = null;
  next.confirmedAt = null;
  next.confirmation = null;
  return next;
}

export function caseIssues(current: PreparationCase): CaseIssue[] {
  const issues: CaseIssue[] = [];
  const check = (facts: ScenarioFacts, plan: CaseIssue["plan"]) => {
    const issue = (field: string, message: string) => issues.push({ plan, field, message });
    if (facts.programStartDate && facts.currentProgramEndDate && facts.programStartDate > facts.currentProgramEndDate) {
      issue("currentProgramEndDate", "The program end date precedes its start date.");
    }
    if (facts.startingPosition === "current_ds_inside_us" && (facts.inUsOnEffectiveDate === "no" || facts.admissionBasis === "fixed_period")) {
      issue("startingPosition", "A current D/S transition situation conflicts with the reported presence or admission basis.");
    }
    if (facts.admissionBasis === "duration_of_status" && facts.i94AdmitUntilDate) {
      issue("i94AdmitUntilDate", "A fixed I-94 admit-until date conflicts with the reported D/S admission basis.");
    }
    if (facts.optFiledBeforeDeparture === "yes" && facts.optFilingDate && facts.reentryDate && facts.optFilingDate >= facts.reentryDate) {
      issue("optFiledBeforeDeparture", "Filing cannot be before departure when it is on or after the reported return date.");
    }
    if (facts.travelPosture === "none" && facts.reentryDate) issue("reentryDate", "A return date conflicts with no international travel.");
    if (facts.nextProgramStartDate && facts.nextProgramEndDate && facts.nextProgramStartDate > facts.nextProgramEndDate) {
      issue("nextProgramEndDate", "The later program ends before it starts.");
    }
  };
  check(current.scenario, "baseline");
  const alternative = alternativeFacts(current);
  if (alternative) check(alternative, "alternative");
  return issues;
}

export function confirmCase(current: PreparationCase, expected: number): PreparationCase {
  assertRevision(current, expected);
  if (!current.inquiry.trim()) throw new PreparationError("needs_facts", "Add the question you want to bring to advising.");
  if (caseIssues(current).length) throw new PreparationError("needs_correction", "Resolve the conflicting facts before confirming.");
  return { ...current, confirmedRevision: current.revision, confirmedAt: new Date().toISOString(), confirmation: null };
}

export function confirmCaseFromConversation(current: PreparationCase, expected: number, summary: unknown, studentResponse: unknown): PreparationCase {
  assertRevision(current, expected);
  const safeSummary = typeof summary === "string" ? summary.trim() : "";
  const safeResponse = typeof studentResponse === "string" ? studentResponse.trim() : "";
  assertSafeInquiry(safeSummary);
  assertSafeInquiry(safeResponse);
  if (!safeSummary || safeSummary.length > 1800) throw new PreparationError("invalid_input", "Provide the concise case recap shown to the student.");
  if (!safeResponse || safeResponse.length > 500) throw new PreparationError("invalid_input", "Provide the student's direct response to that recap.");
  const affirmative = /^(?:yes|yep|yeah|correct|right|that(?:'s| is) (?:right|correct)|looks (?:right|correct)|sounds (?:right|correct)|confirmed|exactly|you(?:'ve| have) got it)\b[\s\S]*$/i;
  const correction = /\b(?:but|except|however|actually|instead|correction|change|not|no)\b/i;
  if (!affirmative.test(safeResponse) || correction.test(safeResponse)) {
    throw new PreparationError("not_confirmed", "The student's response does not clearly confirm the recap. Resolve the correction or ask again; do not record confirmation yet.");
  }
  const confirmed = confirmCase(current, expected);
  const confirmedAt = new Date().toISOString();
  return { ...confirmed, confirmedAt, confirmation: { revision: current.revision, summary: safeSummary, studentResponse: safeResponse, channel: "agent_chat", confirmedAt } };
}

export function requireConfirmation(current: PreparationCase, expected: number): void {
  assertRevision(current, expected);
  if (current.confirmedRevision !== current.revision) {
    throw new PreparationError("review_required", "The student must clearly confirm the settled recap in conversation before analysis. Do not confirm on the student's behalf.");
  }
}

export function serializeCase(current: PreparationCase): string {
  const { schemaVersion, id, revision, inquiry, context, reportedFacts, assumptions, category, scenario, alternative } = current;
  return JSON.stringify({ schemaVersion, id, revision, inquiry, context, reportedFacts, assumptions, category, scenario, alternative });
}

export function restoreCase(raw: string): PreparationCase | null {
  try {
    if (raw.length > 20000) return null;
    const saved = JSON.parse(raw);
    object(saved, ["schemaVersion", "id", "revision", "inquiry", "context", "reportedFacts", "assumptions", "category", "scenario", "alternative"]);
    if (saved.schemaVersion !== 1 || typeof saved.id !== "string" || !/^[a-f0-9-]{36}$/.test(saved.id) || !Number.isSafeInteger(saved.revision) || Number(saved.revision) < 1) return null;
    const fresh = createCase();
    const restored = reviseCase(fresh, { expectedRevision: 1, inquiry: saved.inquiry, context: saved.context ?? "", reportedFacts: saved.reportedFacts ?? [], assumptions: saved.assumptions ?? [], category: saved.category, facts: saved.scenario, ...(saved.alternative ? { alternative: saved.alternative } : {}) });
    return { ...restored, id: saved.id, revision: Number(saved.revision) + 1 };
  } catch { return null; }
}

export const FICTIONAL_EXAMPLE: Omit<CaseUpdate, "expectedRevision"> = {
  inquiry: "I graduate in May 2027, am considering CPT during my program, and plan to apply for OPT in February. How would a January trip change my plans, and what should I ask my adviser?",
  category: "F-1",
  facts: {
    startingPosition: "current_ds_inside_us",
    admissionBasis: "duration_of_status", inUsOnEffectiveDate: "yes", maintainingStatusOnEffectiveDate: "yes",
    programStartDate: "2025-08-25", currentProgramEndDate: "2027-05-15", programEndOnEffectiveDate: "2027-05-15",
    optIntent: "yes", optStage: "post_completion_not_filed", optFilingDate: "2027-02-15", dsoRecommendedOpt: "no",
    cptPlan: "planned", travelPosture: "none", pendingExtensionOnDeparture: "no", educationLevel: "graduate",
    programType: "college_or_university", firstAcademicYearCompleted: "yes", schoolTransferPlan: "no",
    academicProgramChangePlan: "no", nextProgramLevelPlan: "not_planning", hasF2Dependents: "no", earlyEndSituation: "none",
  },
  alternative: { label: "Return in January before filing", changes: { travelPosture: "planned", reentryDate: "2027-01-10", reentryBasis: "same_i20_balance", optFiledBeforeDeparture: "no" } },
};
