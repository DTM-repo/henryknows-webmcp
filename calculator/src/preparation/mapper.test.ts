import { describe, expect, it } from "vitest";
import { DEFAULT_SCENARIO } from "../content/demoScenarios";
import { calculateScenario, scenarioForFixedReentry } from "../engine/calculateScenario";
import { alternativeFacts, confirmCase, createCase, FICTIONAL_EXAMPLE, reviseCase } from "./case";
import { comparePlans, screenCase } from "./mapper";

function example() {
  const current = reviseCase(createCase(), { expectedRevision: 1, ...FICTIONAL_EXAMPLE });
  return confirmCase(current, current.revision);
}

describe("canonical mapper preparation adapter", () => {
  it("allows draft screening but requires confirmation for calculation", () => {
    const current = reviseCase(createCase(), { expectedRevision: 1, inquiry: "How do the new rules affect my plan?", category: "F-1" });
    expect(screenCase(current, 2).status).toBe("needs_facts");
    expect(() => comparePlans(current, 2)).toThrow(/student must clearly confirm/);
  });

  it("uses the canonical baseline and separate fixed-return calculations", () => {
    const current = example();
    const comparison = comparePlans(current, current.revision);
    const baseline = { ...DEFAULT_SCENARIO, ...FICTIONAL_EXAMPLE.facts };
    expect(comparison.baseline.result).toEqual(calculateScenario(baseline as typeof DEFAULT_SCENARIO));
    const alternative = { ...baseline, ...alternativeFacts(current), returningAfterEffectiveDate: "yes" };
    expect(comparison.alternative?.result).toEqual(calculateScenario(scenarioForFixedReentry(alternative as typeof DEFAULT_SCENARIO)));
    expect(comparison.baseline.posture).toBe("reported_plan");
    expect(comparison.alternative?.posture).toBe("projected_after_return");
    expect(comparison.baseline.result.classification).toBe("transition_ds");
    expect(comparison.alternative?.result.classification).toBe("fixed_period_reentry");
    expect(comparison.baseline.result.latestDepartureDate).toBe("2027-07-14");
    expect(comparison.alternative?.result.latestDepartureDate).toBe("2027-06-14");
    expect(comparison.baseline.result.i765TransitionDeadline).toBe("2027-03-18");
    expect(current.scenario.travelPosture).toBe("none");
    expect(comparison.changes.map((item) => item.field)).toContain("reentryDate");
    expect(comparison.baseline.result.citations.length).toBeGreaterThan(0);
  });

  it("screens CPT and OPT without narrowing the inquiry to travel", () => {
    const current = example();
    const screen = screenCase(current, current.revision);
    expect(screen.status).toBe("screened");
    expect(screen.topics.find((topic) => topic.topic === "opt")?.applicability).toBe("applies");
    expect(screen.topics.find((topic) => topic.topic === "cpt")?.applicability).toBe("could_apply");
    expect(screen.alternativeTopics.length).toBeGreaterThan(0);
    expect(current.inquiry).toContain("CPT");
  });

  it.each(["J-1", "M-1", "general", "unspecified"] as const)("retains a broader %s question without a false F-1 result", (category) => {
    const current = confirmCase(reviseCase(createCase(), { expectedRevision: 1, inquiry: "What should I discuss with my adviser?", category }), 2);
    const screen = screenCase(current, 2);
    expect(screen.topics).toEqual([]);
    expect(screen.status).toBe(category === "unspecified" ? "needs_facts" : "outside_mapper_scope");
    expect(() => comparePlans(current, 2)).toThrow();
    expect(current.inquiry).toContain("adviser");
  });

  it("lists missing inputs by plan and does not invent dates or OPT stage", () => {
    let current = reviseCase(example(), { expectedRevision: 2, facts: { optStage: "unknown", optFilingDate: "" } });
    current = confirmCase(current, current.revision);
    const screen = screenCase(current, current.revision);
    expect(screen.status).toBe("needs_facts");
    expect(screen.missingFacts).toContainEqual(expect.objectContaining({ plan: "baseline", field: "optFilingDate", label: "OPT application filing date", reason: expect.stringContaining("OPT filing") }));
    expect(screen.missingFacts.some((fact) => fact.field === "optStage")).toBe(true);
    expect(screen.missingFacts.some((fact) => fact.plan === "alternative")).toBe(true);
    expect(() => comparePlans(current, current.revision)).toThrow(/inputs are still unknown/);
    expect(current.scenario.optStage).toBe("unknown");
  });

  it("asks for the I-20 start date before a post-effective-date return calculation", () => {
    let current = reviseCase(example(), { expectedRevision: 2, facts: { programStartDate: "" } });
    current = confirmCase(current, current.revision);
    const screen = screenCase(current, current.revision);
    expect(screen.missingFacts).toContainEqual(expect.objectContaining({ plan: "alternative", field: "programStartDate" }));
    expect(() => comparePlans(current, current.revision)).toThrow(/inputs are still unknown/);
  });

  it("uses the current I-20 end date on September 15 unless a different date is supplied", () => {
    let current = reviseCase(example(), { expectedRevision: 2, facts: { programEndOnEffectiveDate: "" } });
    current = confirmCase(current, current.revision);
    const screen = screenCase(current, current.revision);
    expect(screen.missingFacts.some((fact) => fact.field === "programEndOnEffectiveDate")).toBe(false);
    expect(comparePlans(current, current.revision).baseline.result.classification).toBe("transition_ds");
  });

  it("changes the snapshot identity and rejects an older revision", () => {
    const current = example();
    const before = comparePlans(current, current.revision);
    let next = reviseCase(current, { expectedRevision: 2, alternative: { label: "February return", changes: { travelPosture: "planned", reentryDate: "2027-02-10", reentryBasis: "same_i20_balance", optFiledBeforeDeparture: "no" } } });
    next = confirmCase(next, next.revision);
    const after = comparePlans(next, next.revision);
    expect(after.fingerprint).not.toBe(before.fingerprint);
    expect(() => comparePlans(next, before.revision)).toThrow(/case changed/);
    expect(before.alternative?.facts.reentryDate).toBe("2027-01-10");
  });

  it("keeps the single-plan path usable", () => {
    let current = reviseCase(example(), { expectedRevision: 2, removeAlternative: true });
    current = confirmCase(current, current.revision);
    expect(comparePlans(current, current.revision, "single").alternative).toBeNull();
    expect(() => comparePlans(current, current.revision)).toThrow(/different Plan B/);
  });

  it.each([{}, { travelPosture: "none" as const }, { optFilingDate: "2027-02-15" }])("rejects an empty or identical alternative: %j", (changes) => {
    let current = reviseCase(example(), { expectedRevision: 2, alternative: { label: "Renaming is not a new plan", changes } });
    current = confirmCase(current, current.revision);
    expect(() => comparePlans(current, current.revision)).toThrow(/different Plan B/);
  });

  it("does not silently drop Plan B when a single-plan operation is requested", () => {
    expect(() => comparePlans(example(), 2, "single")).toThrow(/case has two plans/);
  });

  it("rejects contradictory travel facts sent together instead of hiding them", () => {
    expect(() => reviseCase(example(), { expectedRevision: 2, facts: { travelPosture: "none", reentryDate: "2027-01-10" } })).toThrow(/conflicts with a return date/);
  });
});
