import { describe, expect, it } from "vitest";
import type { PreparationDocument } from "./expeditor";
import { createPreparationPdf, preparationPdfFilename } from "./pdf";

const baseDocument: PreparationDocument = {
  audience: "student",
  title: "My F-1 OPT planning questions",
  sections: [
    { heading: "What this means", body: "Your travel date can change which new-rule process applies.\n\n- Compare the two dates.\n- Confirm the return plan with your DSO.", sourceIds: [] },
  ],
  answerIds: ["answer-1"],
  includeTimeline: true,
  sources: [],
  timeline: [{ label: "Your plan", events: [
    { date: "2026-09-15", title: "New rules take effect", detail: "Your existing D/S admission may receive transition treatment if the other requirements are met.", tone: "neutral" },
    { date: "2027-01-10", title: "Possible return to the United States", detail: "Ask your DSO how this return would affect the transition analysis while OPT is pending.", tone: "warning" },
  ] }],
  caseId: "11111111-1111-4111-8111-111111111111",
  revision: 2,
  savedAt: "2026-09-02T12:00:00.000Z",
};

describe("preparation PDF export", () => {
  it("creates a real student PDF with a stable PDF filename", async () => {
    const blob = await createPreparationPdf(baseDocument, [], "General information only, not legal advice.");
    const bytes = new Uint8Array(await blob.arrayBuffer());
    expect(blob.type).toBe("application/pdf");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    expect(bytes.length).toBeGreaterThan(2_000);
    expect(preparationPdfFilename("student")).toBe("henryknows-student-preparation.pdf");
  }, 60_000);

  it("retains a clickable primary-source URL in an adviser PDF", async () => {
    const professional = { ...baseDocument, audience: "professional" as const, title: "OPT travel question for DSO review" };
    const url = "https://www.federalregister.gov/documents/2026/07/17/example";
    const blob = await createPreparationPdf(professional, [{ label: "Federal Register final rule", url }], "Preparation summary only.");
    const raw = new TextDecoder("latin1").decode(await blob.arrayBuffer());
    expect(raw).toContain(url);
    expect(preparationPdfFilename("professional")).toBe("henryknows-adviser-preparation.pdf");
  }, 60_000);
});
