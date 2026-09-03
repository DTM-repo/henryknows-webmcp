import { describe, expect, it } from "vitest";
import { confirmCase, createCase, FICTIONAL_EXAMPLE, reviseCase } from "./case";
import { comparePlans } from "./mapper";
import { changeValue, keyFindings, planFields, planRows, planTitle, questionsToVerify } from "./presentation";

describe("student-facing plan descriptions", () => {
  it("names no-travel plans rather than displaying a blank return date", () => {
    expect(planTitle({ travelPosture: "none" })).toBe("No international travel");
    expect(planTitle({ travelPosture: "planned" })).toContain("return date unknown");
    expect(planTitle({ travelPosture: "planned", reentryDate: "2027-01-10" })).toBe("Return on Jan 10, 2027");
    expect(planTitle({})).toBe("Travel plans not yet specified");
    expect(changeValue({ travelPosture: "none" }, "reentryDate")).toBe("Not applicable (no trip)");
  });

  it("only asks travel follow-ups when there is travel, and keeps unknown OPT distinct from no", () => {
    expect(planFields({ travelPosture: "none" })).not.toContain("reentryDate");
    expect(planFields({ travelPosture: "planned", optIntent: "yes" })).toContain("optFiledBeforeDeparture");
    expect(planFields({ travelPosture: "planned", reentryBasis: "longer_program_i20" })).toContain("returnProgramEndDate");
    expect(planRows({}).find((row) => row.field === "optIntent")?.value).toBe("Unknown");
    expect(planRows({ optIntent: "no" }).find((row) => row.field === "optIntent")?.value).toBe("No");
  });

  it("leads with the relevant canonical finding and retains context for review questions", () => {
    const current = confirmCase(reviseCase(createCase(), { expectedRevision: 1, ...FICTIONAL_EXAMPLE }), 2);
    const analysis = comparePlans(current, 2);
    expect(keyFindings(analysis.baseline).some((finding) => finding.id === "opt-filing-in-window")).toBe(true);
    expect(keyFindings(analysis.alternative!).some((finding) => finding.id === "fixed-opt-separate-period")).toBe(true);
    const questions = questionsToVerify([analysis.baseline, analysis.alternative!]);
    expect(questions.find((question) => question.title.includes("DSO"))?.detail).toContain("SEVIS");
    expect(new Set(questions.map((question) => question.title)).size).toBe(questions.length);
  });

  it("never hides a danger finding behind a favorable OPT finding", () => {
    let current = reviseCase(createCase(), { expectedRevision: 1, ...FICTIONAL_EXAMPLE });
    current = confirmCase(reviseCase(current, { expectedRevision: 2, facts: { optFilingDate: "2027-04-01" }, alternative: { ...current.alternative!, changes: { ...current.alternative!.changes, optFiledBeforeDeparture: "no" } } }), 3);
    const analysis = comparePlans(current, 3);
    expect(keyFindings(analysis.baseline)[0].tone).toBe("danger");
    expect(keyFindings(analysis.baseline)[0].id).toBe("opt-after-march-deadline");
  });
});
