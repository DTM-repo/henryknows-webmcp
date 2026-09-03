import { describe, expect, it, vi } from "vitest";
import { FICTIONAL_EXAMPLE } from "./case";
import { PreparationController } from "./controller";
import { createTools, registerPreparationTools } from "./webmcp";
import type { ModelContext } from "./webmcp";

describe("bounded native site tools", () => {
  it("registers the conversational collection and mapper operations", async () => {
    const controller = new PreparationController();
    const registerTool = vi.fn<ModelContext["registerTool"]>();
    const registration = await registerPreparationTools(controller, { registerTool });
    expect(registration).toMatchObject({ supported: true, count: 6 });
    expect(registerTool.mock.calls.map(([tool]) => tool.name)).toEqual([
      "get_preparation_case", "propose_case_update", "confirm_preparation_case",
      "screen_duration_topics", "compare_duration_plans", "check_duration_plan",
    ]);
    const signal = registerTool.mock.calls[0][1]?.signal;
    expect(signal?.aborted).toBe(false);
    registration.dispose();
    expect(signal?.aborted).toBe(true);
  });

  it("does not claim support without the native API", async () => {
    expect(await registerPreparationTools(new PreparationController())).toMatchObject({ supported: false, count: 0 });
  });

  it("unregisters a partially installed tool set when registration fails", async () => {
    const registerTool = vi.fn<ModelContext["registerTool"]>().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("Unavailable"));
    expect(await registerPreparationTools(new PreparationController(), { registerTool })).toMatchObject({ supported: false, count: 0 });
    expect(registerTool.mock.calls[0][1]?.signal.aborted).toBe(true);
  });

  it("collects silently, screens drafts, and confirms only from a clear student response", () => {
    const controller = new PreparationController();
    const tools = createTools(controller);
    const tool = (name: string) => tools.find((item) => item.name === name)!;
    expect(tool("propose_case_update").execute({
      expectedRevision: 1,
      ...FICTIONAL_EXAMPLE,
      reportedFacts: ["The student plans to finish the current program in May 2027."],
      assumptions: ["February 15 is a student-chosen modeling date for the OPT filing."],
    })).toMatchObject({ status: "collecting", case: { revision: 2 } });
    expect(controller.getSnapshot()).toMatchObject({ open: true, activity: [{ actor: "agent", revision: 2 }] });
    expect(tool("screen_duration_topics").execute({ expectedRevision: 2 })).toMatchObject({ status: "screened" });
    expect(tool("compare_duration_plans").execute({ expectedRevision: 2 })).toMatchObject({ status: "review_required" });
    expect(tool("confirm_preparation_case").execute({ expectedRevision: 2, summary: "You plan to finish in May 2027 and model a February OPT filing.", studentResponse: "Actually, the filing month is March." })).toMatchObject({ status: "not_confirmed" });
    expect(tool("confirm_preparation_case").execute({ expectedRevision: 2, summary: "You plan to finish in May 2027 and model a February OPT filing.", studentResponse: "Yes, but actually I meant March." })).toMatchObject({ status: "not_confirmed" });
    expect(controller.getCase().status).toBe("collecting");
    expect(tool("confirm_preparation_case").execute({ expectedRevision: 2, summary: "You plan to finish in May 2027 and model a February OPT filing.", studentResponse: "Yes, that's right." })).toMatchObject({ status: "confirmed", case: { confirmation: { channel: "agent_chat" } } });
    expect(tool("compare_duration_plans").execute({ expectedRevision: 2 })).toMatchObject({ status: "ready", revision: 2 });
  });

  it("signals the shared page on the first case read without requiring a case update", () => {
    const controller = new PreparationController();
    const getCase = createTools(controller).find((tool) => tool.name === "get_preparation_case")!;
    expect(getCase.execute({})).toMatchObject({ status: "collecting" });
    expect(controller.getSnapshot()).toMatchObject({ open: true, activity: [{ name: "Assistant connected", actor: "agent" }] });
    getCase.execute({});
    expect(controller.getSnapshot().activity).toHaveLength(1);
  });

  it("tells the assistant to collaborate on undecided dates and keep recovery private", () => {
    const { guide } = new PreparationController().getCase();
    const tools = createTools(new PreparationController(), {} as never);
    expect(guide.context).toContain("offer one or two concrete dates or sequences");
    expect(guide.tools.calculations).toContain("offer to show both");
    expect(guide.tools.handoff).toContain("Correct rejected arguments");
    expect(tools.find((tool) => tool.name === "save_preparation_documents")?.description).toContain("Correct rejected arguments silently");
    expect(tools.find((tool) => tool.name === "save_preparation_documents")?.description).toContain("routine professional instruction of every kind");
  });

  it("invalidates affected work after an edit without creating another approval stage", () => {
    const controller = new PreparationController();
    controller.propose({ expectedRevision: 1, ...FICTIONAL_EXAMPLE });
    controller.confirmConversation(2, "You want to compare a January return with no travel.", "Yes, correct.");
    expect(controller.compare(2)).toMatchObject({ status: "ready" });
    controller.propose({ expectedRevision: 2, facts: { cptPlan: "none" } });
    expect(controller.getCase()).toMatchObject({ status: "collecting", analysisStatus: "outdated" });
    expect(controller.getSnapshot().case.confirmation).toBeNull();
  });

  it("returns errors for malformed calls and does not expose caller-supplied content", () => {
    const controller = new PreparationController();
    const tools = createTools(controller);
    const tool = (name: string) => tools.find((item) => item.name === name)!;
    expect(tool("get_preparation_case").execute({ secret: "do-not-echo" })).toMatchObject({ status: "invalid_input" });
    expect(tool("propose_case_update").execute(null)).toMatchObject({ status: "invalid_input" });
    expect(tool("propose_case_update").execute({ expectedRevision: 1, inquiry: "My SEVIS ID is N1234567890" })).toMatchObject({ status: "sensitive_input" });
    expect(tool("confirm_preparation_case").execute({ expectedRevision: 1, summary: "A recap", studentResponse: "No" })).toMatchObject({ status: "not_confirmed" });
    expect(tool("screen_duration_topics").execute({ expectedRevision: "1" })).toMatchObject({ status: "invalid_input" });
    expect(JSON.stringify(controller.getCase())).not.toContain("N1234567890");
  });

  it("returns copies and does not let a tool consumer mutate live state", () => {
    const controller = new PreparationController();
    const response = controller.getCase();
    response.case.confirmedRevision = 1;
    expect(controller.getSnapshot().case.confirmedRevision).toBeNull();
  });

  it("restores bounded facts without preserving confirmation or unrelated storage", () => {
    const values = new Map<string, string>([["henry_token", "do-not-share"]]);
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const controller = new PreparationController(storage);
    controller.propose({ expectedRevision: 1, ...FICTIONAL_EXAMPLE, reportedFacts: ["May 2027 program completion is reported."] });
    controller.confirmConversation(2, "You report a May 2027 program completion.", "Yes, correct.");
    controller.compare(2);
    const restored = new PreparationController(storage);
    expect(restored.getCase()).toMatchObject({ status: "collecting", analysisStatus: "not_run", case: { category: "F-1", revision: 3, reportedFacts: ["May 2027 program completion is reported."] } });
    expect(JSON.stringify(restored.getCase())).not.toContain("do-not-share");
    expect(restored.getSnapshot().case.confirmation).toBeNull();
  });

  it("starts a different inquiry without inheriting the previous scenario", () => {
    const controller = new PreparationController();
    controller.propose({ expectedRevision: 1, ...FICTIONAL_EXAMPLE });
    controller.open("How does on-campus employment work?");
    expect(controller.getSnapshot().case).toMatchObject({ inquiry: "How does on-campus employment work?", scenario: {}, reportedFacts: [], assumptions: [] });
    expect(controller.getSnapshot().case.id).not.toBe("");
  });

  it("remains usable if storage is blocked", () => {
    const controller = new PreparationController({ getItem() { throw new Error("denied"); }, setItem() { throw new Error("denied"); } });
    expect(() => controller.propose({ expectedRevision: 1, ...FICTIONAL_EXAMPLE })).not.toThrow();
    expect(controller.getSnapshot().case.revision).toBe(2);
  });

  it("keeps draft updates in collection without opening a review stage", () => {
    const controller = new PreparationController();
    controller.propose({ expectedRevision: 1, ...FICTIONAL_EXAMPLE }, "student");
    controller.propose({ expectedRevision: 2, facts: { cptPlan: "none" } });
    expect(controller.getCase()).toMatchObject({ status: "collecting", case: { revision: 3 } });
  });

  it("exposes a ready single-plan check without a fake comparison", () => {
    const controller = new PreparationController();
    controller.propose({ expectedRevision: 1, ...FICTIONAL_EXAMPLE, alternative: undefined });
    const tools = createTools(controller);
    const check = tools.find((tool) => tool.name === "check_duration_plan")!;
    const compare = tools.find((tool) => tool.name === "compare_duration_plans")!;
    expect(check.execute({ expectedRevision: 2 })).toMatchObject({ status: "review_required" });
    controller.confirmConversation(2, "You want one plan checked.", "Yes.");
    expect(compare.execute({ expectedRevision: 2 })).toMatchObject({ status: "needs_alternative" });
    expect(check.execute({ expectedRevision: 2 })).toMatchObject({ status: "ready", alternative: null });
  });
});
