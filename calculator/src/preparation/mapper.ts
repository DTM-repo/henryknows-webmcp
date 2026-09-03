import { buildStudentCase } from "../case/studentCase";
import type { CaseTopicEvaluation } from "../case/studentCase";
import { DEFAULT_SCENARIO } from "../content/demoScenarios";
import { calculateScenario, DEFAULT_EFFECTIVE_DATE, scenarioForFixedReentry } from "../engine/calculateScenario";
import type { PlannerResult, StudentScenario } from "../engine/types";
import { alternativeFacts, caseIssues, changedFields, FIELDS, PreparationError, requireConfirmation } from "./case";
import type { PreparationCase, ScenarioFacts, ScenarioField } from "./case";
import { MAPPER_PURPOSE } from "./capabilities";

export type MissingFact = { plan: "baseline" | "alternative"; field: ScenarioField; label: string; reason: string };
export type Screening = {
  revision: number;
  status: "screened" | "needs_facts" | "outside_mapper_scope";
  topics: CaseTopicEvaluation[];
  alternativeTopics: CaseTopicEvaluation[];
  missingFacts: MissingFact[];
  note: string;
};
export type PlanAnalysis = { label: string; posture: "reported_plan" | "projected_after_return"; facts: ScenarioFacts; result: PlannerResult };
export type MapperComparison = {
  caseId: string;
  revision: number;
  fingerprint: string;
  generatedAt: string;
  elapsedMs: number;
  baseline: PlanAnalysis;
  alternative: PlanAnalysis | null;
  changes: Array<{ field: ScenarioField; label: string; before: string; after: string }>;
};

function scenarioFromFacts(facts: ScenarioFacts): StudentScenario {
  // The legacy engine uses "none" as its neutral OPT stage. Preserve the
  // student's explicit unknown in the case and block OPT calculation below.
  const values = Object.fromEntries(Object.entries(facts).filter(([key, value]) => value !== "" && !(key === "optStage" && value === "unknown")));
  return {
    ...DEFAULT_SCENARIO,
    cptPlan: "unknown",
    earlyEndSituation: "unknown",
    ...values,
    programEndOnEffectiveDate: facts.programEndOnEffectiveDate || facts.currentProgramEndDate,
    returningAfterEffectiveDate: facts.reentryDate ? (facts.reentryDate > DEFAULT_EFFECTIVE_DATE ? "yes" : "no") : "unknown",
  };
}

function missingFor(facts: ScenarioFacts, plan: MissingFact["plan"]): MissingFact[] {
  const required: ScenarioField[] = ["startingPosition", "admissionBasis", "inUsOnEffectiveDate"];
  if (facts.inUsOnEffectiveDate === "yes" && facts.admissionBasis === "duration_of_status") {
    required.push("maintainingStatusOnEffectiveDate");
    if (!facts.currentProgramEndDate) required.push("programEndOnEffectiveDate");
  }
  if (!facts.currentEadEndDate) required.push("currentProgramEndDate");
  if (facts.optIntent === "yes" || facts.optStage?.includes("not_filed")) required.push("optStage", "optFilingDate");
  if (["planned", "completed"].includes(facts.travelPosture ?? "")) {
    required.push("reentryDate", "reentryBasis");
    if (facts.reentryDate && facts.reentryDate > DEFAULT_EFFECTIVE_DATE && ["same_i20_balance", "longer_program_i20"].includes(facts.reentryBasis ?? "")) required.push("programStartDate");
    if (facts.optIntent === "yes" || facts.optStage?.includes("not_filed")) required.push("optFiledBeforeDeparture");
    if (facts.reentryBasis === "longer_program_i20") required.push("returnProgramStartDate", "returnProgramEndDate");
  }
  const reasons: Partial<Record<ScenarioField, string>> = {
    startingPosition: "Needed to identify which transition path the new rules apply to.",
    admissionBasis: "Needed to distinguish duration-of-status treatment from a fixed admission period.",
    inUsOnEffectiveDate: "Needed to assess the September 15, 2026 transition rules.",
    maintainingStatusOnEffectiveDate: "Needed for the transition analysis; it is a student report, not an independent status determination.",
    programEndOnEffectiveDate: "Needed to calculate the transition period from the I-20 in effect on September 15, 2026.",
    currentProgramEndDate: "Needed to calculate program and filing timelines.",
    optStage: "Needed to select the applicable OPT timing path.",
    optFilingDate: "Needed to calculate how the planned OPT filing date interacts with the new duration rules.",
    reentryDate: "Needed to calculate the effect of the proposed return under the new rules.",
    reentryBasis: "Needed because different return documents can produce different mapper paths.",
    programStartDate: "Needed to place a post-September 15, 2026 return on the new fixed-period timeline.",
    optFiledBeforeDeparture: "Needed to place the OPT filing relative to the proposed travel.",
    returnProgramStartDate: "Needed to calculate the I-20 period used for the proposed return.",
    returnProgramEndDate: "Needed to calculate the I-20 period used for the proposed return.",
  };
  return [...new Set(required)].filter((field) => !facts[field] || facts[field] === "unknown")
    .map((field) => ({ plan, field, label: FIELDS[field].label, reason: reasons[field] || "Needed for the applicable new-duration-rule calculation." }));
}

export function missingCaseFacts(current: PreparationCase): MissingFact[] {
  if (current.category !== "F-1") return [];
  const alternative = alternativeFacts(current);
  return [...missingFor(current.scenario, "baseline"), ...(alternative ? missingFor(alternative, "alternative") : [])];
}

export function screenCase(current: PreparationCase, expectedRevision: number): Screening {
  if (expectedRevision !== current.revision) throw new PreparationError("stale_revision", "The case changed. Read its current revision before continuing.");
  if (current.category !== "F-1") return {
    revision: current.revision,
    status: current.category === "unspecified" ? "needs_facts" : "outside_mapper_scope",
    topics: [], alternativeTopics: [], missingFacts: [],
    note: current.category === "unspecified" ? "The category is unconfirmed. No F-1 rule analysis was run." : "This F-1 duration mapper is not the appropriate rules module for the selected category. Keep the broader question with HenryKnows.",
  };
  const alternative = alternativeFacts(current);
  const missingFacts = missingCaseFacts(current);
  return {
    revision: current.revision,
    status: missingFacts.length ? "needs_facts" : "screened",
    topics: buildStudentCase(scenarioFromFacts(current.scenario)).topicEvaluations,
    alternativeTopics: alternative ? buildStudentCase(scenarioFromFacts(alternative)).topicEvaluations : [],
    missingFacts,
    note: `${MAPPER_PURPOSE} Unknown facts remain unverified.`,
  };
}

export function calculationScenario(facts: ScenarioFacts): StudentScenario {
  const scenario = scenarioFromFacts(facts);
  // Match the canonical mapper's separate, explicitly hypothetical return result.
  const projectReturn = scenario.startingPosition === "current_ds_inside_us" &&
    ["planned", "completed"].includes(scenario.travelPosture) && scenario.returningAfterEffectiveDate === "yes" &&
    ["same_i20_balance", "longer_program_i20"].includes(scenario.reentryBasis);
  return projectReturn ? scenarioForFixedReentry(scenario) : scenario;
}

function analyze(facts: ScenarioFacts, label: string): PlanAnalysis {
  const scenario = calculationScenario(facts);
  return { label, posture: scenario.startingPosition !== facts.startingPosition ? "projected_after_return" : "reported_plan", facts, result: calculateScenario(scenario) };
}

export function comparePlans(current: PreparationCase, expectedRevision: number, mode: "comparison" | "single" = "comparison"): MapperComparison {
  requireConfirmation(current, expectedRevision);
  const screening = screenCase(current, expectedRevision);
  if (current.category !== "F-1") throw new PreparationError("outside_mapper_scope", screening.note);
  if (mode === "comparison" && (!current.alternative || !changedFields(current).length)) {
    throw new PreparationError("needs_alternative", "Add a different Plan B before comparing. To review only Plan A, choose the single-plan check.");
  }
  if (mode === "single" && current.alternative) throw new PreparationError("needs_correction", "This case has two plans. Compare them, or remove Plan B for a single-plan check.");
  if (caseIssues(current).length) throw new PreparationError("needs_correction", "Resolve the conflicting facts before calculation.");
  if (screening.missingFacts.length) throw new PreparationError("needs_facts", "Some scenario inputs are still unknown. Review the listed missing facts before calculation.");
  const start = performance.now();
  const otherFacts = alternativeFacts(current);
  const baseline = analyze(current.scenario, "Plan A");
  const alternative = otherFacts ? analyze(otherFacts, current.alternative!.label) : null;
  const changes = otherFacts ? changedFields(current)
    .map((field) => ({ field, label: FIELDS[field].label, before: current.scenario[field] || "unknown", after: otherFacts[field] || "unknown" })) : [];
  return {
    caseId: current.id, revision: current.revision,
    fingerprint: JSON.stringify([current.id, current.revision, current.scenario, current.alternative]),
    generatedAt: new Date().toISOString(), elapsedMs: performance.now() - start,
    baseline, alternative, changes,
  };
}
