import { describe, expect, it } from "vitest";
import { alternativeFacts, caseIssues, confirmCase, confirmCaseFromConversation, createCase, FICTIONAL_EXAMPLE, requireConfirmation, restoreCase, reviseCase, serializeCase } from "./case";

const example = () => reviseCase(createCase(), { expectedRevision: 1, ...FICTIONAL_EXAMPLE });

describe("student-owned preparation case", () => {
  it("does not fill unknown facts with no", () => {
    expect(createCase().scenario).toEqual({});
    const c = reviseCase(createCase(), { expectedRevision: 1, facts: { hasF2Dependents: "unknown" } });
    expect(c.scenario.hasF2Dependents).toBe("unknown");
  });
  it("keeps proposals unconfirmed until the settled recap is confirmed", () => {
    const c = example();
    expect(() => requireConfirmation(c, c.revision)).toThrow(/must clearly confirm/);
    expect(confirmCase(c, c.revision).confirmedRevision).toBe(c.revision);
  });
  it.each(["confirmedRevision", "confirmed", "evidenceApproval", "isPaid", "studentId", "__proto__"])("rejects injected %s", (field) => {
    const input = JSON.parse(`{"expectedRevision":1,"${field}":true}`);
    expect(() => reviseCase(createCase(), input)).toThrow(/unsupported field/);
  });
  it("rejects unknown fields inside facts", () => {
    expect(() => reviseCase(createCase(), { expectedRevision: 1, facts: { passport: "fictional" } })).toThrow(/unsupported/);
  });
  it.each([null, [], "yes", { expectedRevision: "1" }, { expectedRevision: 1, facts: { optIntent: true } }, { expectedRevision: 1, facts: { programStartDate: "2027-02-30" } }])("rejects malformed inputs", (input) => {
    expect(() => reviseCase(createCase(), input)).toThrow();
  });
  it.each(["My SEVIS ID is N1234567890", "email@example.invalid", "Passport: A12345678", "--- Attached document: scan.pdf", "sk-ant-not-a-real-key"])("blocks identifying and raw attachment payloads", (inquiry) => {
    expect(() => reviseCase(createCase(), { expectedRevision: 1, inquiry })).toThrow(/identifiers|Attachments/);
  });
  it("allows ordinary regulatory reference strings", () => {
    expect(() => reviseCase(createCase(), { expectedRevision: 1, inquiry: "What does 8 CFR 214.2(f) mean for my plans?" })).not.toThrow();
  });
  it("invalidates conversational confirmation after an edit", () => {
    const c = example();
    const confirmed = confirmCaseFromConversation(c, c.revision, "You plan to file for OPT in February.", "Yes, that's right.");
    const revised = reviseCase(confirmed, { expectedRevision: c.revision, facts: { optFilingDate: "2027-03-19" } });
    expect(revised.revision).toBe(c.revision + 1);
    expect(revised.confirmedRevision).toBeNull();
    expect(revised.confirmation).toBeNull();
    expect(() => confirmCaseFromConversation(revised, c.revision, "You plan to file in February.", "Yes.")).toThrow(/changed/);
  });
  it("does not record an affirmative response that also contains a correction", () => {
    const c = example();
    expect(() => confirmCaseFromConversation(c, c.revision, "You plan to file for OPT in February.", "Yes, but actually I meant March.")).toThrow(/does not clearly confirm/);
  });
  it("rejects a stale proposal without changing the case", () => {
    const c = example();
    expect(() => reviseCase(c, { expectedRevision: 1, inquiry: "Old question" })).toThrow(/changed/);
    expect(c.inquiry).toContain("CPT");
  });
  it("keeps the same revision for an identical proposal", () => {
    const c = example();
    expect(reviseCase(c, { expectedRevision: c.revision, inquiry: c.inquiry })).toBe(c);
  });
  it("invalidates dependent filing order on a travel-date edit", () => {
    const c = reviseCase(createCase(), { expectedRevision: 1, facts: { travelPosture: "planned", reentryDate: "2027-04-01", optFiledBeforeDeparture: "yes" } });
    const revised = reviseCase(c, { expectedRevision: c.revision, facts: { reentryDate: "2027-01-10" } });
    expect(revised.scenario.optFiledBeforeDeparture).toBe("unknown");
  });
  it("preserves an explicitly supplied filing order for review", () => {
    const c = example();
    expect(alternativeFacts(c)?.optFiledBeforeDeparture).toBe("no");
    expect(c.scenario.travelPosture).toBe("none");
  });
  it("blocks confirmation of date-order contradictions", () => {
    const c = example();
    const bad = reviseCase(c, { expectedRevision: c.revision, alternative: { label: "Conflicting plan", changes: { travelPosture: "planned", reentryDate: "2027-01-10", optFiledBeforeDeparture: "yes" } } });
    expect(caseIssues(bad)[0].field).toBe("optFiledBeforeDeparture");
    expect(() => confirmCase(bad, bad.revision)).toThrow(/conflicting/);
  });
  it("clears stale travel fields when travel is removed", () => {
    const c = reviseCase(example(), { expectedRevision: 2, facts: { travelPosture: "planned", reentryDate: "2027-01-10" } });
    const revised = reviseCase(c, { expectedRevision: c.revision, facts: { travelPosture: "none" } });
    expect(revised.scenario.reentryDate).toBe("");
  });
  it("retains unknowns and plans on restore but requires renewed confirmation", () => {
    const c = example();
    const restored = restoreCase(serializeCase(confirmCase(c, c.revision)))!;
    expect(restored.scenario).toEqual(c.scenario);
    expect(restored.alternative).toEqual(c.alternative);
    expect(restored.confirmedRevision).toBeNull();
    expect(restored.revision).toBeGreaterThan(c.revision);
  });
  it("rejects corrupted or confirmation-injected storage", () => {
    expect(restoreCase("not json")).toBeNull();
    expect(restoreCase(JSON.stringify({ ...JSON.parse(serializeCase(example())), confirmedRevision: 2 }))).toBeNull();
  });
});
