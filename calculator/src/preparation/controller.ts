import { caseIssues, confirmCaseFromConversation, createCase, PreparationError, requireConfirmation, restoreCase, reviseCase, serializeCase } from "./case";
import type { PreparationCase } from "./case";
import { comparePlans, screenCase } from "./mapper";
import type { MapperComparison, Screening } from "./mapper";
import { EXPEDITOR_GUIDE } from "./capabilities";

export type PreparationSnapshot = {
  case: PreparationCase;
  open: boolean;
  screening: Screening | null;
  analysis: MapperComparison | null;
  activity: Array<{ name: string; actor: "student" | "agent"; revision: number; time: string }>;
};

export class PreparationController {
  private state: PreparationSnapshot;
  private listeners = new Set<() => void>();

  constructor(private storage?: Pick<Storage, "getItem" | "setItem">, initialCase?: PreparationCase) {
    let restored: PreparationCase | null = initialCase ?? null;
    try { restored ??= restoreCase(storage?.getItem("henry_preparation_v2") ?? ""); } catch { /* Storage is optional. */ }
    this.state = { case: restored ?? createCase(), open: false, screening: null, analysis: null, activity: [] };
  }

  getSnapshot = (): PreparationSnapshot => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };

  private update(patch: Partial<PreparationSnapshot>) {
    this.state = { ...this.state, ...patch };
    try { this.storage?.setItem("henry_preparation_v2", serializeCase(this.state.case)); } catch { /* Keep the live case usable. */ }
    for (const listener of this.listeners) listener();
  }

  private record(name: string, actor: "student" | "agent", revision = this.state.case.revision) {
    return [...this.state.activity, { name, actor, revision, time: new Date().toISOString() }].slice(-15);
  }

  open(inquiry?: string) {
    if (inquiry && inquiry.trim() && inquiry.trim() !== this.state.case.inquiry.trim()) {
      const fresh = createCase();
      const next = reviseCase(fresh, { expectedRevision: fresh.revision, inquiry: inquiry.trim() });
      this.update({ case: next, screening: null, analysis: null, activity: [] });
    }
    this.update({ open: true });
  }
  close() { this.update({ open: false }); }
  reset() { this.update({ case: createCase(), screening: null, analysis: null, activity: [] }); }

  connect() {
    const alreadyConnected = this.state.activity.some((item) => item.name === "Assistant connected" && item.revision === this.state.case.revision);
    this.update({ open: true, ...(alreadyConnected ? {} : { activity: this.record("Assistant connected", "agent") }) });
  }

  restore(raw: string) {
    const restored = restoreCase(raw);
    if (!restored) throw new PreparationError("invalid_input", "This transferred case could not be restored.");
    this.update({ case: restored, screening: null, analysis: null, activity: [], open: true });
  }

  getCase() {
    return structuredClone({
      status: this.state.case.confirmedRevision === this.state.case.revision ? "confirmed" : "collecting",
      case: this.state.case,
      guide: EXPEDITOR_GUIDE,
      issues: caseIssues(this.state.case),
      analysisStatus: !this.state.analysis ? "not_run" : this.state.analysis.revision === this.state.case.revision ? "current" : "outdated",
    });
  }

  propose(input: unknown, actor: "student" | "agent" = "agent") {
    const next = reviseCase(this.state.case, input);
    if (next === this.state.case) { if (actor === "agent") this.update({ open: true }); return this.getCase(); }
    this.update({ case: next, screening: null, open: true, activity: this.record("Case updated", actor, next.revision) });
    return this.getCase();
  }

  confirmConversation(expectedRevision: number, summary: unknown, studentResponse: unknown) {
    const next = confirmCaseFromConversation(this.state.case, expectedRevision, summary, studentResponse);
    this.update({ case: next, open: true, activity: this.record("Situation confirmed in conversation", "student") });
    return this.getCase();
  }

  screen(expectedRevision: number, actor: "student" | "agent" = "agent") {
    const screening = screenCase(this.state.case, expectedRevision);
    this.update({ screening, open: true, activity: this.record("Duration topics checked", actor) });
    return structuredClone(screening);
  }

  compare(expectedRevision: number, actor: "student" | "agent" = "agent") {
    return this.calculate(expectedRevision, actor, "comparison");
  }

  checkPlan(expectedRevision: number, actor: "student" | "agent" = "agent") {
    return this.calculate(expectedRevision, actor, "single");
  }

  private calculate(expectedRevision: number, actor: "student" | "agent", mode: "comparison" | "single") {
    requireConfirmation(this.state.case, expectedRevision);
    // Validate the requested operation even if this revision was calculated before.
    const checked = comparePlans(this.state.case, expectedRevision, mode);
    const analysis = this.state.analysis?.revision === expectedRevision ? this.state.analysis : checked;
    this.update({ analysis, open: true, activity: this.record(mode === "comparison" ? "Plans compared" : "Plan checked", actor) });
    return structuredClone({
      status: "ready", ...analysis,
      note: "These are current canonical new-duration-rule findings for the confirmed case. The agent should evaluate them, consult Henry as needed, and author the final documents without asking the student to approve the regulatory analysis.",
    });
  }
}
