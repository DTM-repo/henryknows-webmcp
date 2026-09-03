import { alternativeFacts, FIELDS } from "./case";
import type { PreparationCase, ScenarioFacts, ScenarioField } from "./case";
import type { PlanAnalysis } from "./mapper";

const LABELS: Record<string, string> = {
  unknown: "Unknown", yes: "Yes", no: "No", none: "None", planned: "Planned", completed: "Completed",
  current_ds_inside_us: "Current D/S student in the U.S.", prospective_outside_us: "Prospective student outside the U.S.",
  change_status_inside_us: "Changing status inside the U.S.", readmitted_fixed_period: "Readmitted for a fixed period", transfer_or_program_change: "Transfer or program change",
  duration_of_status: "Duration of status (D/S)", fixed_period: "Fixed period",
  pre_completion: "Pre-completion OPT", post_completion_not_filed: "Post-completion OPT, not filed", post_completion_pending: "Post-completion OPT, pending", post_completion_approved: "Post-completion OPT, approved",
  stem_not_filed: "STEM OPT, not filed", stem_pending: "STEM OPT, pending", stem_approved: "STEM OPT, approved",
  automatic_visa_revalidation: "Automatic visa revalidation", same_i20_balance: "Same I-20, remaining program", new_f1_admission: "New F-1 admission", longer_program_i20: "I-20 for a longer program",
  undergraduate: "Undergraduate", graduate: "Graduate", other: "Other", college_or_university: "College or university", english_language_training: "English-language training", public_high_school: "Public high school", private_high_school: "Private high school",
  not_planning: "Not planning another program", higher: "Higher education level", same_or_lower: "Same or lower education level", completed_early: "Completed early", authorized_withdrawal: "Authorized withdrawal", status_violation: "Status violation",
};

export function displayValue(value: string | undefined): string {
  if (!value || value === "unknown") return "Unknown";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"));
  return LABELS[value] ?? value;
}

export const QUESTIONS: Partial<Record<ScenarioField, string>> = {
  startingPosition: "Which situation describes you?",
  admissionBasis: "Does your I-94 show D/S or a fixed end date?",
  inUsOnEffectiveDate: "Will you be in the U.S. on September 15, 2026?",
  maintainingStatusOnEffectiveDate: "Will you be maintaining F-1 status on that date?",
  currentProgramEndDate: "When does your current I-20 program end?",
  programEndOnEffectiveDate: "What I-20 end date will be in place on September 15, 2026?",
  optIntent: "Are you planning to apply for OPT?",
  optStage: "Where are you in the OPT process?",
  optFilingDate: "When would you file your OPT application?",
  dsoRecommendedOpt: "Has your DSO recommended OPT yet?",
  cptPlan: "Are you planning CPT during your program?",
  travelPosture: "Are you planning international travel?",
  reentryDate: "When would you return to the U.S.?",
  reentryBasis: "Which I-20 or admission basis would you use to return?",
  optFiledBeforeDeparture: "Would you file for OPT before leaving the U.S.?",
};

export const SITUATION_FIELDS: ScenarioField[] = ["startingPosition", "admissionBasis", "inUsOnEffectiveDate", "maintainingStatusOnEffectiveDate", "programStartDate", "currentProgramEndDate", "programEndOnEffectiveDate"];
export const PLAN_FIELDS: ScenarioField[] = ["optIntent", "optStage", "optFilingDate", "dsoRecommendedOpt", "cptPlan", "travelPosture", "reentryDate", "reentryBasis", "optFiledBeforeDeparture", "returnProgramStartDate", "returnProgramEndDate"];
export const EXTRA_FIELDS = (Object.keys(FIELDS) as ScenarioField[]).filter((field) => !SITUATION_FIELDS.includes(field) && !PLAN_FIELDS.includes(field));

export function planFields(facts: ScenarioFacts): ScenarioField[] {
  const fields: ScenarioField[] = ["optIntent"];
  if (facts.optIntent === "yes" || (facts.optStage && !["none", "unknown"].includes(facts.optStage))) fields.push("optStage", "optFilingDate", "dsoRecommendedOpt");
  fields.push("cptPlan", "travelPosture");
  if (facts.travelPosture && !["none", "unknown"].includes(facts.travelPosture)) {
    fields.push("reentryDate", "reentryBasis");
    if (facts.optIntent === "yes" || facts.optStage?.includes("not_filed")) fields.push("optFiledBeforeDeparture");
    if (facts.reentryBasis === "longer_program_i20") fields.push("returnProgramStartDate", "returnProgramEndDate");
  }
  return fields;
}

export function planTitle(facts: ScenarioFacts): string {
  if (facts.travelPosture === "none") return "No international travel";
  if (["planned", "completed"].includes(facts.travelPosture ?? "")) return facts.reentryDate ? "Return on " + displayValue(facts.reentryDate) : "International travel; return date unknown";
  if (facts.travelPosture === "automatic_visa_revalidation") return "Travel using automatic visa revalidation";
  return "Travel plans not yet specified";
}

export function planRows(facts: ScenarioFacts): Array<{ field: ScenarioField; label: string; value: string }> {
  const fields = planFields(facts).filter((field) => field !== "travelPosture" && !(field === "optIntent" && facts.optIntent === "yes"));
  return fields.map((field) => ({ field, label: FIELDS[field].label, value: displayValue(facts[field]) }));
}

export function changeValue(facts: ScenarioFacts, field: ScenarioField): string {
  if (facts.travelPosture === "none" && ["reentryDate", "reentryBasis", "optFiledBeforeDeparture"].includes(field)) return "Not applicable (no trip)";
  if (field === "travelPosture" && facts[field] === "none") return "No international travel";
  return displayValue(facts[field]);
}

export function sharedFacts(current: PreparationCase): ScenarioField[] {
  const other = alternativeFacts(current);
  return (Object.keys(FIELDS) as ScenarioField[]).filter((field) => !PLAN_FIELDS.includes(field) &&
    Boolean(current.scenario[field]) && current.scenario[field] !== "unknown" && (!other || current.scenario[field] === other[field]));
}

export function keyFindings(analysis: PlanAnalysis) {
  const findings = analysis.result.findings;
  const important = findings.filter((finding) => finding.tone === "danger");
  const opt = ["opt-filing-in-window", "fixed-opt-separate-period", "opt-dso-recommendation-needed"].map((id) => findings.find((finding) => finding.id === id)).find(Boolean);
  return [...important, ...(opt && !important.includes(opt) ? [opt] : [])];
}

export function questionsToVerify(plans: PlanAnalysis[]): Array<{ title: string; detail?: string }> {
  const questions = plans.flatMap(({ result }) => [
    ...result.findings.filter((finding) => finding.tone === "question").map((finding) => ({ title: finding.title, detail: finding.detail })),
    ...result.followUpQuestions.map((title) => ({ title })),
  ]);
  return [...new Map(questions.map((question) => [question.title, question])).values()];
}
