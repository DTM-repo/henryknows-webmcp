import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PreparationController } from "./controller";
import { Expeditor } from "./expeditor";
import { documentText, ExpeditorPanel } from "./ExpeditorPanel";
import { FICTIONAL_EXAMPLE } from "./case";

function workFor(controller: PreparationController) {
  return new Expeditor(controller, { askHenry: vi.fn(), startAdvisement: vi.fn(), pollAdvisement: vi.fn() });
}
function page(controller = new PreparationController(), supported = true, assistantSession = false) {
  return renderToStaticMarkup(<ExpeditorPanel controller={controller} work={workFor(controller)} getInquiry={() => ""} toolStatus={supported ? "supported" : "unavailable"} assistantSession={assistantSession} />);
}

describe("conversational expeditor surface", () => {
  it("offers the concrete assistant benefit without another wizard", () => {
    const html = page();
    expect(html).toContain("Use HenryKnows with ChatGPT");
    expect(html).toContain("detailed regulatory explanation");
    expect(html).toContain("summary to bring to your adviser or DSO");
    expect(html).toContain("Open ChatGPT");
    expect(html).not.toContain("Copy request");
    expect(html).not.toContain("Rules calculator");
    expect(html).not.toContain("Start with a new question");
    expect(html).not.toContain("Site tools are not available");
    expect(html).not.toContain("Comparison progress");
    expect(html).not.toContain("Confirm these facts");
    expect(html).not.toContain("Fictional scenarios only");
  });

  it("opens an assistant handoff as a connected workspace instead of repeating the launch invitation", () => {
    const html = page(new PreparationController(), true, true);
    expect(html).toContain("Connected to your assistant");
    expect(html).toContain("Your facts, timeline, and documents will appear here");
    expect(html).toContain("ChatGPT and HenryKnows are connected");
    expect(html).toContain("hk-live-connected");
    expect(html).not.toContain("Open ChatGPT");
  });

  it("keeps browser compatibility details out of the launch and shows a concise real failure in an assistant session", () => {
    const launch = page(new PreparationController(), false);
    const assistant = page(new PreparationController(), false, true);
    expect(launch).not.toContain("Site tools are not available");
    expect(assistant).toContain("ChatGPT could not connect to HenryKnows on this page");
    expect(assistant).toContain("Connection unavailable");
    expect(assistant).not.toContain("hk-live-connected");
    expect(assistant).not.toContain("assistant is signed in");
  });

  it("shows only relevant reported facts and assumptions during conversation", () => {
    const controller = new PreparationController();
    controller.propose({ expectedRevision: 1, inquiry: "How does travel fit my OPT plan?", facts: { currentProgramEndDate: "2027-05-15" }, reportedFacts: ["Student reports the program completion is planned for May 2027."], assumptions: ["No exact OPT filing date has been reported yet.", "January travel is tentative."] });
    const html = page(controller);
    expect(html).toContain("Building your preparation");
    expect(html).toContain("Current I-20 program end date");
    expect(html.match(/May 15, 2027/g)).toHaveLength(1);
    expect(html).toContain("January travel is tentative");
    expect(html).not.toContain("No exact OPT filing date");
    expect(html).not.toContain("Student reports");
    expect(html).not.toContain("Confirm these facts");
  });

  it("renders the conversational recap after confirmation", () => {
    const controller = new PreparationController();
    controller.propose({ expectedRevision: 1, inquiry: "How does travel affect OPT?", reportedFacts: ["Program completion is planned for May 2027."], assumptions: ["January travel is tentative."] });
    controller.confirmConversation(2, "You plan to finish in May 2027 and are considering January travel before applying for OPT.", "Yes, that's right.");
    const html = page(controller);
    expect(html).toContain("Case confirmed");
    expect(html).toContain("considering January travel before applying for OPT");
    expect(html).not.toContain("These facts and unknowns accurately reflect");
  });

  it("shows mapper evidence without making the student approve it", () => {
    const controller = new PreparationController();
    controller.propose({ expectedRevision: 1, ...FICTIONAL_EXAMPLE });
    controller.confirmConversation(2, "You want to compare no travel with a January return before the modeled OPT filing.", "Yes, correct.");
    controller.compare(2);
    const html = page(controller);
    expect(html).toContain("Your new-rule timeline");
    expect(html).toContain("new-rule timeline");
    expect(html).not.toContain("specialized Duration Mapper");
    expect(html).not.toContain("Use these findings with Henry");
    expect(html).not.toContain("I reviewed these new-rule findings");
    expect(html).not.toContain("Modeled latest departure");
  });

  it("keeps student citations out of prose while professional sources remain visible", async () => {
    const controller = new PreparationController();
    controller.propose({ expectedRevision: 1, inquiry: "What should I ask my adviser?" });
    controller.confirmConversation(2, "You want questions for your adviser.", "Yes.");
    const answer = { text: "Reference answer.", sources: [{ id: "one", title: "USCIS policy", url: "https://www.uscis.gov/" }] };
    const work = new Expeditor(controller, { askHenry: vi.fn(async () => answer), startAdvisement: vi.fn(), pollAdvisement: vi.fn() });
    const student = work.askHenry({ expectedRevision: 2, question: "Explain this plainly.", audience: "student", includeMapper: false });
    const professional = work.askHenry({ expectedRevision: 2, question: "Give the professional reference.", audience: "professional", includeMapper: false });
    await vi.waitFor(() => expect(work.getSnapshot().operations.filter((operation) => operation.status === "ready")).toHaveLength(2));
    const studentSource = work.getSnapshot().operations.find((operation) => operation.id === student.id)!.answer!.sources[0].id;
    const professionalSource = work.getSnapshot().operations.find((operation) => operation.id === professional.id)!.answer!.sources[0].id;
    const studentDoc = work.saveDocument({ expectedRevision: 2, audience: "student", title: "My advising preparation", answerIds: [student.id], includeTimeline: false, sections: [{ heading: "What this means", body: "Bring the dates you know and ask which school process applies.", sourceIds: [studentSource] }] }).document;
    work.saveDocument({ expectedRevision: 2, audience: "professional", title: "Adviser discussion summary", answerIds: [professional.id], includeTimeline: false, sections: [{ heading: "Regulatory issue", body: "The student requests review of the applicable institutional process.", sourceIds: [professionalSource] }] });
    const html = renderToStaticMarkup(<ExpeditorPanel controller={controller} work={work} getInquiry={() => ""} toolStatus="supported" />);
    expect(html).toContain("Bring the dates you know");
    expect(documentText(studentDoc, work)).not.toContain("https://www.uscis.gov/");
    expect(html).toContain("For my adviser or DSO");
    expect(html).toContain('aria-label="Download PDF"');
    expect(html).not.toContain(".md");
    expect(html.indexOf("Your advising preparation")).toBeLessThan(html.indexOf("Shared case"));
    expect(documentText(studentDoc, work)).toContain("General information only, not legal advice");
  });

  it("deduplicates adviser links that resolve to the same source URL", async () => {
    const controller = new PreparationController();
    controller.propose({ expectedRevision: 1, inquiry: "What should I ask my adviser?" });
    controller.confirmConversation(2, "You want questions for your adviser.", "Yes.");
    const answer = { text: "Professional reference.", sources: [
      { id: "one", title: "USCIS policy", url: "https://www.uscis.gov/" },
      { id: "two", title: "USCIS policy duplicate", url: "https://www.uscis.gov/" },
    ] };
    const work = new Expeditor(controller, { askHenry: vi.fn(async () => answer), startAdvisement: vi.fn(), pollAdvisement: vi.fn() });
    const operation = work.askHenry({ expectedRevision: 2, question: "Give the professional reference.", audience: "professional", includeMapper: false });
    await vi.waitFor(() => expect(work.getSnapshot().operations[0].status).toBe("ready"));
    const sourceIds = work.getSnapshot().operations[0].answer!.sources.map((source) => source.id);
    work.saveDocument({ expectedRevision: 2, audience: "professional", title: "Adviser discussion summary", answerIds: [operation.id], includeTimeline: false, sections: [{ heading: "Regulatory issue", body: "The student requests review of the applicable institutional process.", sourceIds }] });
    const html = renderToStaticMarkup(<ExpeditorPanel controller={controller} work={work} getInquiry={() => ""} toolStatus="supported" />);
    expect(html.match(/href="https:\/\/www\.uscis\.gov\/"/g)).toHaveLength(1);
    expect(html).toContain("Primary sources");
  });

  it("labels primary authority without exposing an internal corpus title", async () => {
    const controller = new PreparationController();
    controller.propose({ expectedRevision: 1, inquiry: "What should I ask my adviser?" });
    controller.confirmConversation(2, "You want questions for your adviser.", "Yes.");
    const answer = { text: "Professional reference.", sources: [{ id: "one", title: "Duration rule supersessions quick reference", heading: "Internal retrieval heading", url: "https://www.federalregister.gov/d/2026-14439" }] };
    const work = new Expeditor(controller, { askHenry: vi.fn(async () => answer), startAdvisement: vi.fn(), pollAdvisement: vi.fn() });
    const operation = work.askHenry({ expectedRevision: 2, question: "Give the professional reference.", audience: "professional", includeMapper: false });
    await vi.waitFor(() => expect(work.getSnapshot().operations[0].status).toBe("ready"));
    const sourceId = work.getSnapshot().operations[0].answer!.sources[0].id;
    work.saveDocument({ expectedRevision: 2, audience: "professional", title: "Adviser summary", answerIds: [operation.id], includeTimeline: false, sections: [{ heading: "Issue", body: "The student requests review of the case-specific issue.", sourceIds: [sourceId] }] });
    const html = renderToStaticMarkup(<ExpeditorPanel controller={controller} work={work} getInquiry={() => ""} toolStatus="supported" />);
    expect(html).toContain("Federal Register final rule (July 17, 2026)");
    expect(html).not.toContain("supersessions quick reference");
    expect(html).not.toContain("Internal retrieval heading");
  });

  it("does not carry an old document into a genuinely new inquiry", async () => {
    const controller = new PreparationController();
    controller.propose({ expectedRevision: 1, inquiry: "My first question" });
    controller.confirmConversation(2, "You want help with your first question.", "Yes.");
    const work = new Expeditor(controller, { askHenry: vi.fn(async () => ({ text: "Reference answer.", sources: [] })), startAdvisement: vi.fn(), pollAdvisement: vi.fn() });
    const operation = work.askHenry({ expectedRevision: 2, question: "Explain the first question.", audience: "student", includeMapper: false });
    await vi.waitFor(() => expect(work.getSnapshot().operations[0].status).toBe("ready"));
    work.saveDocument({ expectedRevision: 2, audience: "student", title: "Old preparation", answerIds: [operation.id], includeTimeline: false, sections: [{ heading: "Old result", body: "This belongs only to the first case.", sourceIds: [] }] });
    controller.open("A completely different question");
    const html = renderToStaticMarkup(<ExpeditorPanel controller={controller} work={work} getInquiry={() => ""} toolStatus="supported" />);
    expect(html).toContain("Use HenryKnows with ChatGPT");
    expect(html).not.toContain("Old preparation");
    expect(html).not.toContain("This belongs only to the first case");
  });

  it("keeps a saved document readable after a page reload while marking it for refresh", async () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    const controller = new PreparationController(storage);
    controller.propose({ expectedRevision: 1, inquiry: "What should I ask my adviser?" });
    controller.confirmConversation(2, "You want questions for your adviser.", "Yes.");
    const services = { askHenry: vi.fn(async () => ({ text: "Reference answer.", sources: [] })), startAdvisement: vi.fn(), pollAdvisement: vi.fn() };
    const work = new Expeditor(controller, services, storage);
    const operation = work.askHenry({ expectedRevision: 2, question: "Explain this plainly.", audience: "student", includeMapper: false });
    await vi.waitFor(() => expect(work.getSnapshot().operations[0].status).toBe("ready"));
    work.saveDocument({ expectedRevision: 2, audience: "student", title: "Saved preparation", answerIds: [operation.id], includeTimeline: false, sections: [{ heading: "Next step", body: "Bring your dates to the meeting.", sourceIds: [] }] });
    const reloadedController = new PreparationController(storage);
    const restoredWork = new Expeditor(reloadedController, services, storage);
    const html = renderToStaticMarkup(<ExpeditorPanel controller={reloadedController} work={restoredWork} getInquiry={() => ""} toolStatus="supported" assistantSession />);
    expect(html).toContain("Saved preparation");
    expect(html).toContain("Bring your dates to the meeting");
    expect(html).toContain("earlier version of your case");
    expect(html).toContain("Saved documents need refresh");
    expect(html).toContain("Saved documents");
    expect(html).not.toContain("Your documents are ready");
    expect(html).not.toContain("Documents ready");
  });
});
