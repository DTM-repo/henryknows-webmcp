import { describe, expect, it, vi } from "vitest";
import { PreparationController } from "./controller";
import { FICTIONAL_EXAMPLE } from "./case";
import { Expeditor } from "./expeditor";
import { createTools } from "./webmcp";
import type { HenryAnswer, PreparationServices } from "./services";

const answer: HenryAnswer = { text: "A reference answer with an unresolved institutional question.", sources: [{ id: "1", title: "USCIS reference", url: "https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors" }] };
const report = { title: "New duration-rule impacts", sections: [{ heading: "Your timeline", body: "Review the calculated findings with your adviser." }] };
function setup(full = false, confirmed = true) {
  const controller = new PreparationController();
  controller.propose({ expectedRevision: 1, ...(full ? FICTIONAL_EXAMPLE : { inquiry: "What should I ask about on-campus employment?", category: "F-1", context: "Hours and eligibility still need clarification.", reportedFacts: ["The student is asking about on-campus employment."], assumptions: ["Proposed weekly hours are not yet known."] }) });
  if (confirmed) controller.confirmConversation(2, "You are asking about on-campus employment; the proposed hours are still unknown.", "Yes, that's right.");
  const services: PreparationServices = { askHenry: vi.fn(async () => structuredClone(answer)), startAdvisement: vi.fn(async () => report), pollAdvisement: vi.fn(async () => report) };
  const work = new Expeditor(controller, services);
  return { controller, services, work };
}
const request = { expectedRevision: 2, question: "What should be confirmed?", audience: "student", includeMapper: false };
async function ready(work: Expeditor, id: string) {
  await vi.waitFor(() => expect(work.getSnapshot().operations.find((operation) => operation.id === id)?.status).toBe("ready"));
}
function docInput(id: string, sourceIds: string[] = []) {
  return { expectedRevision: 2, audience: "student", title: "Questions for advising", answerIds: [id], includeTimeline: false, sections: [{ heading: "Still to confirm", body: "Ask your adviser about the open institutional questions.", sourceIds }] };
}

describe("external agent as expeditor", () => {
  it("makes the iterative role, conversational confirmation, and mapper boundary discoverable", () => {
    const { controller, work } = setup();
    const tools = createTools(controller, work);
    expect(tools).toHaveLength(11);
    for (const tool of tools.filter((tool) => /duration/.test(tool.name))) {
      expect(tool.description).toContain("new duration-of-status rules");
      expect(tool.description).toContain("NOT a general");
    }
    expect(controller.getCase().guide.tools.henry).toContain("repeatedly");
    expect(controller.getCase().guide.context).toContain("do not make them invent a date");
    expect(controller.getCase().guide.context).toContain("never ask 'may I add/record that?'");
    expect(controller.getCase().guide.context).toContain("currentProgramEndDate also supplies programEndOnEffectiveDate");
    expect(controller.getCase().guide.start).toContain("Ask one question per turn");
    expect(controller.getCase().guide.start).toContain("do not reopen or reinitialize it");
    expect(controller.getCase().guide.role).toContain("validation failures");
    expect(controller.getCase().guide.tools.documents).toContain("expert to expert");
    expect(controller.getCase().guide.tools.documents).toContain("short, straightforward sentences");
    expect(controller.getCase().guide.tools.documents).toContain("routine professional instruction of every kind");
    expect(tools.some((tool) => tool.name === "save_preparation_documents")).toBe(true);
    expect(tools.some((tool) => tool.name === "save_preparation_document")).toBe(false);
    expect(tools.some((tool) => tool.name === "confirm_preparation_case")).toBe(true);
  });

  it("uses Henry on a draft to identify material follow-ups", async () => {
    const { work, services, controller } = setup(false, false);
    const op = work.askHenry(request);
    await ready(work, op.id);
    expect(controller.getCase().status).toBe("collecting");
    expect(services.askHenry).toHaveBeenCalledTimes(1);
    expect(vi.mocked(services.askHenry).mock.calls[0][0]).toContain("draft collected from the student");
    expect(vi.mocked(services.askHenry).mock.calls[0][0]).toContain("Proposed weekly hours are not yet known");
  });

  it("allows broad repeated Henry answers without forcing the mapper", async () => {
    const { work, services } = setup();
    const first = work.askHenry(request);
    const second = work.askHenry({ ...request, question: "Which institutional policy should the student ask about?", audience: "professional" });
    await ready(work, first.id); await ready(work, second.id);
    expect(first.includesCurrentMapper).toBe(false);
    expect(services.askHenry).toHaveBeenCalledTimes(2);
    expect(vi.mocked(services.askHenry).mock.calls[0][0]).toContain("No current duration-rule analysis");
    expect(work.saveDocument(docInput(first.id)).author).toBe("external_agent");
  });

  it("does not generate documents itself and requires a matching Henry audience", async () => {
    const { work, services } = setup();
    expect(() => work.saveDocument(docInput("invented-answer"))).toThrow("completed current Henry answers");
    const operation = work.askHenry(request); await ready(work, operation.id);
    expect(() => work.saveDocument({ ...docInput(operation.id), audience: "professional" })).toThrow("audience mode");
    work.saveDocument(docInput(operation.id));
    expect(services.askHenry).toHaveBeenCalledTimes(1);
  });

  it("rejects invented and visibly leaked citation IDs", async () => {
    const { work } = setup(); const operation = work.askHenry(request); await ready(work, operation.id);
    expect(() => work.saveDocument(docInput(operation.id, ["fake-source"]))).toThrow("source IDs");
    expect(() => work.saveDocument({ ...docInput(operation.id), sections: [{ heading: "Result", body: "Use [henry:internal:1] as directed by this prototype.", sourceIds: [] }] })).toThrow("source IDs");
    expect(() => work.saveDocument({ ...docInput(operation.id), sections: [{ heading: "Result", body: "HenryKnows says the mapper classifies this as projected_after_return.", sourceIds: [] }] })).toThrow("product/tool attribution");
    expect(() => work.saveDocument({ ...docInput(operation.id), sections: [{ heading: "Questions for your DSO", body: "- Ask whether this is right.\n- Ask whether another date applies.", sourceIds: [] }] })).toThrow("direct question bullets");
    expect(work.saveDocument(docInput(operation.id, [work.sources()[0].id])).status).toBe("saved");
  });

  it("deduplicates an identical Henry request but permits new clarifying questions", async () => {
    const { work, services } = setup();
    const first = work.askHenry(request); expect(work.askHenry(request).id).toBe(first.id);
    const clarification = work.askHenry({ ...request, question: "What ambiguity remains?" });
    await ready(work, first.id); await ready(work, clarification.id);
    expect(services.askHenry).toHaveBeenCalledTimes(2);
  });

  it("keeps late answers out of a revised case and allows another draft consultation", async () => {
    const { work, controller, services } = setup();
    let finish!: (value: HenryAnswer) => void;
    vi.mocked(services.askHenry).mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const operation = work.askHenry(request);
    controller.propose({ expectedRevision: 2, context: "A new unconfirmed circumstance." });
    finish(answer); await Promise.resolve(); await Promise.resolve();
    const result = await work.getOperation({ operationId: operation.id });
    expect(result.status).toBe("outdated"); expect(result.answer).toBeUndefined();
    expect(() => work.askHenry({ ...request, expectedRevision: 3 })).not.toThrow();
  });

  it("marks documents outdated after a case edit", async () => {
    const { work, controller } = setup(); const operation = work.askHenry(request); await ready(work, operation.id);
    const saved = work.saveDocument(docInput(operation.id)).document;
    controller.propose({ expectedRevision: 2, inquiry: "A different question" });
    expect(work.documentCurrent(saved)).toBe(false);
  });

  it("binds canonical advisement to the actual projected scenario without student evidence approval", async () => {
    const { work, controller, services } = setup(true);
    controller.compare(2);
    const advisement = work.requestAdvisement({ expectedRevision: 2, plan: "alternative" }); await ready(work, advisement.id);
    expect(vi.mocked(services.startAdvisement).mock.calls[0][0].scenario.startingPosition).toBe("readmitted_fixed_period");
    const henry = work.askHenry({ ...request, includeMapper: true }); await ready(work, henry.id);
    expect(vi.mocked(services.askHenry).mock.calls.at(-1)?.[0]).toContain(report.title);
    expect(work.saveDocument({ ...docInput(henry.id), includeTimeline: true }).status).toBe("saved");
    expect(henry.includesCurrentMapper).toBe(true);
  });

  it("does not invalidate canonical evidence when an optional narrative finishes later", async () => {
    const { work, controller } = setup(true); controller.compare(2);
    const firstHenry = work.askHenry({ ...request, includeMapper: true }); await ready(work, firstHenry.id);
    const document = work.saveDocument({ ...docInput(firstHenry.id), includeTimeline: true }).document;
    const narrative = work.requestAdvisement({ expectedRevision: 2, plan: "baseline" }); await ready(work, narrative.id);
    expect(controller.getCase().status).toBe("confirmed");
    expect(work.documentCurrent(document)).toBe(true);
    const savedWithNarrative = work.saveDocument({ ...docInput(firstHenry.id), answerIds: [firstHenry.id, narrative.id], includeTimeline: true });
    expect(savedWithNarrative.status).toBe("saved");
    expect(savedWithNarrative.document.answerIds).toEqual([firstHenry.id]);
  });

  it("prevents an authored timeline from duplicating the canonical timeline", async () => {
    const { work, controller } = setup(true); controller.compare(2);
    const henry = work.askHenry({ ...request, includeMapper: true }); await ready(work, henry.id);
    expect(() => work.saveDocument({ ...docInput(henry.id), includeTimeline: true, sections: [{ heading: "Your useful timeline", body: "September 15 begins the new rules.", sourceIds: [] }] })).toThrow("appends the canonical timeline");
  });

  it("saves the final pair atomically and exposes an explicit completion gate", async () => {
    const { work } = setup();
    const student = work.askHenry(request);
    const professional = work.askHenry({ ...request, audience: "professional", question: "What nonroutine issue needs review?" });
    await ready(work, student.id); await ready(work, professional.id);
    const studentInput = { title: "My advising preparation", answerIds: [student.id], includeTimeline: false, sections: [{ heading: "What to know", body: "Bring your dates and ask which school process applies.", sourceIds: [] }] };
    const professionalInput = { title: "Adviser summary", answerIds: [professional.id], includeTimeline: false, sections: [{ heading: "Issue for review", body: "Please review the case-specific institutional question.", sourceIds: [work.sources().find((source) => source.id.includes(professional.id))!.id] }] };
    expect(work.getWork().completion.status).toBe("incomplete");
    expect(() => work.saveDocuments({ expectedRevision: 2, student: studentInput, professional: { ...professionalInput, sections: [{ ...professionalInput.sections[0], body: "The nonroutine issue is not ordinary post-completion OPT filing. The 30-day DSO-recommendation clock also applies." }] } })).toThrow("routine OPT");
    expect(work.getSnapshot().documents).toEqual({});
    expect(() => work.saveDocuments({ expectedRevision: 2, student: studentInput, professional: { ...professionalInput, sections: [{ ...professionalInput.sections[0], sourceIds: ["invented"] }] } })).toThrow("source IDs");
    expect(work.getSnapshot().documents).toEqual({});
    expect(work.saveDocuments({ expectedRevision: 2, student: studentInput, professional: professionalInput })).toMatchObject({ status: "ready", completion: { status: "ready" } });
    expect(work.getWork()).toMatchObject({ completion: { status: "ready", missingAudiences: [] } });
  });

  it("can ground the pair with one current timeline interpretation instead of regenerating both audiences", async () => {
    const { work, controller } = setup(true);
    const student = work.askHenry({ ...request, includeMapper: false, question: "Explain the student's broader OPT question plainly." });
    await ready(work, student.id);
    controller.compare(2);
    const professional = work.askHenry({ ...request, audience: "professional", includeMapper: true, question: "Interpret the current timeline for adviser review." });
    await ready(work, professional.id);
    const professionalSource = work.getSnapshot().operations.find((operation) => operation.id === professional.id)!.answer!.sources[0].id;
    expect(work.saveDocuments({ expectedRevision: 2,
      student: { title: "My OPT plan", answerIds: [student.id], includeTimeline: true, sections: [{ heading: "What this means", body: "File early and check any travel change with your adviser.", sourceIds: [] }] },
      professional: { title: "OPT review summary", answerIds: [professional.id], includeTimeline: true, sections: [{ heading: "Issue", body: "Please review the case-specific transition issue.", sourceIds: [professionalSource] }] },
    })).toMatchObject({ status: "ready", completion: { status: "ready" } });
  });

  it("restores saved documents from page storage without losing their readable snapshot", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const controller = new PreparationController(storage);
    controller.propose({ expectedRevision: 1, inquiry: "What should I ask about employment?", category: "F-1" });
    controller.confirmConversation(2, "You want employment questions for your adviser.", "Yes.");
    const services: PreparationServices = { askHenry: vi.fn(async () => structuredClone(answer)), startAdvisement: vi.fn(async () => report), pollAdvisement: vi.fn(async () => report) };
    const work = new Expeditor(controller, services, storage);
    const student = work.askHenry({ ...request, question: "Explain it plainly." });
    const professional = work.askHenry({ ...request, question: "Summarize the issue.", audience: "professional" });
    await ready(work, student.id); await ready(work, professional.id);
    const sourceId = work.getSnapshot().operations.find((operation) => operation.id === professional.id)!.answer!.sources[0].id;
    work.saveDocuments({ expectedRevision: 2,
      student: { title: "My preparation", answerIds: [student.id], includeTimeline: false, sections: [{ heading: "Next step", body: "Bring the relevant dates.", sourceIds: [] }] },
      professional: { title: "Adviser summary", answerIds: [professional.id], includeTimeline: false, sections: [{ heading: "Review", body: "Please review the institution-specific question.", sourceIds: [sourceId] }] },
    });
    const restored = new Expeditor(controller, services, storage);
    expect(restored.getSnapshot().documents.student).toMatchObject({ title: "My preparation", sections: [{ body: "Bring the relevant dates." }] });
    expect(restored.getWork().completion.status).toBe("ready");
    const reloadedController = new PreparationController(storage);
    const afterPageReload = new Expeditor(reloadedController, services, storage);
    expect(afterPageReload.getSnapshot().documents.student).toMatchObject({ title: "My preparation", sections: [{ body: "Bring the relevant dates." }] });
    expect(afterPageReload.getWork()).toMatchObject({ completion: { status: "incomplete" }, documents: expect.arrayContaining([expect.objectContaining({ audience: "student", status: "outdated" })]) });
  });

  it("polls an existing narrative job instead of starting another generation", async () => {
    const { work, controller, services } = setup(true); controller.compare(2);
    vi.mocked(services.startAdvisement).mockResolvedValue({ responseId: "resp_test", status: "queued" });
    const operation = work.requestAdvisement({ expectedRevision: 2, plan: "baseline" });
    await vi.waitFor(() => expect(work.getSnapshot().operations[0].responseId).toBe("resp_test"));
    expect(work.requestAdvisement({ expectedRevision: 2, plan: "baseline" }).id).toBe(operation.id);
    expect((await work.getOperation({ operationId: operation.id })).status).toBe("ready");
    expect(services.startAdvisement).toHaveBeenCalledTimes(1);
  });

  it("reports failures instead of fabricated answers", async () => {
    const { work, services } = setup(); vi.mocked(services.askHenry).mockRejectedValue(new Error("Offline"));
    const operation = work.askHenry(request);
    await vi.waitFor(() => expect(work.getSnapshot().operations[0].status).toBe("failed"));
    expect((await work.getOperation({ operationId: operation.id })).answer).toBeUndefined();
  });

  it("catches async failures at the native tool boundary", async () => {
    const { controller, work } = setup();
    const tool = createTools(controller, work).find((item) => item.name === "get_preparation_operation")!;
    expect(await tool.execute({ operationId: "not-there" })).toMatchObject({ status: "not_found" });
  });
});
