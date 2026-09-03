import type { PreparationDocument } from "./expeditor";

export type PreparationPdfSource = { label: string; url: string };

type PdfColor = [number, number, number];

const PAGE = { width: 612, height: 792, margin: 54, contentBottom: 718 };
const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
const INK: PdfColor = [29, 40, 35];
const MUTED: PdfColor = [91, 104, 98];
const GREEN: PdfColor = [41, 113, 87];
const PALE_GREEN: PdfColor = [239, 246, 242];
const RULE: PdfColor = [213, 222, 217];
const LINK: PdfColor = [42, 91, 125];
const TONES: Record<string, PdfColor> = {
  neutral: [112, 124, 118],
  good: GREEN,
  warning: [166, 115, 39],
  danger: [164, 65, 57],
};

function cleanText(value: string) {
  return value.normalize("NFKC")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2010\u2011\u2012\u2013\u2014\u2212]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00a0/g, " ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)]\(https?:\/\/[^)]+\)/g, "$1")
    .trim();
}

function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? cleanText(value) : new Intl.DateTimeFormat("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function formatPreparedDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : new Intl.DateTimeFormat("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  }).format(date);
}

function shortened(value: string, length: number) {
  const text = cleanText(value);
  return text.length <= length ? text : `${text.slice(0, length - 3).trimEnd()}...`;
}

export function preparationPdfFilename(audience: PreparationDocument["audience"]) {
  return audience === "student" ? "henryknows-student-preparation.pdf" : "henryknows-adviser-preparation.pdf";
}

export async function createPreparationPdf(
  document: PreparationDocument,
  sources: PreparationPdfSource[],
  boundary: string,
) {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter", compress: true, putOnlyUsedFonts: true });
  const title = cleanText(document.title);
  const audienceLabel = document.audience === "student" ? "STUDENT PLANNING BRIEF" : "ADVISER / DSO BRIEF";
  let y = PAGE.margin;

  pdf.setProperties({
    title,
    subject: document.audience === "student" ? "F-1 planning brief" : "F-1 adviser discussion brief",
    author: "HenryKnows",
    creator: "HenryKnows",
  });
  const savedAt = new Date(document.savedAt);
  if (!Number.isNaN(savedAt.getTime())) pdf.setCreationDate(savedAt);
  pdf.setDisplayMode("fullwidth", "continuous");

  const setColor = (color: PdfColor) => pdf.setTextColor(...color);
  const setDrawColor = (color: PdfColor) => pdf.setDrawColor(...color);
  const setFillColor = (color: PdfColor) => pdf.setFillColor(...color);
  const wrap = (text: string, width: number) => pdf.splitTextToSize(cleanText(text), width) as string[];

  const continuationHeader = () => {
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7.5);
    setColor(GREEN);
    pdf.text("HENRYKNOWS", PAGE.margin, 38);
    pdf.setFont("helvetica", "normal");
    setColor(MUTED);
    pdf.text(shortened(title, 68), PAGE.width - PAGE.margin, 38, { align: "right" });
    setDrawColor(RULE);
    pdf.setLineWidth(0.6);
    pdf.line(PAGE.margin, 48, PAGE.width - PAGE.margin, 48);
    y = 72;
  };

  const nextPage = () => {
    pdf.addPage("letter", "portrait");
    continuationHeader();
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > PAGE.contentBottom) nextPage();
  };

  const writeWrapped = (lines: string[], x: number, lineHeight: number) => {
    for (const line of lines) {
      ensureSpace(lineHeight);
      pdf.text(line, x, y);
      y += lineHeight;
    }
  };

  const paragraph = (value: string) => {
    const text = cleanText(value.replace(/\s*\n\s*/g, " "));
    if (!text) return;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10.5);
    setColor(INK);
    writeWrapped(wrap(text, CONTENT_WIDTH), PAGE.margin, 15.5);
    y += 5;
  };

  const bullet = (value: string) => {
    const lines = wrap(value, CONTENT_WIDTH - 20);
    ensureSpace(Math.min(Math.max(lines.length, 1) * 15.5 + 4, 62));
    setFillColor(GREEN);
    pdf.circle(PAGE.margin + 3, y - 3.2, 1.8, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10.5);
    setColor(INK);
    writeWrapped(lines, PAGE.margin + 16, 15.5);
    y += 4;
  };

  const body = (value: string) => {
    for (const block of value.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean)) {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      if (lines.length && lines.every((line) => /^[-*]\s+/.test(line))) {
        for (const line of lines) bullet(line.replace(/^[-*]\s+/, ""));
      } else {
        paragraph(lines.join(" "));
      }
    }
  };

  const heading = (value: string) => {
    const lines = wrap(value, CONTENT_WIDTH - 28);
    const height = Math.max(30, lines.length * 17 + 14);
    ensureSpace(height + 20);
    y += 12;
    setFillColor(GREEN);
    pdf.rect(PAGE.margin, y - 11, 3, 12, "F");
    pdf.setFont("times", "bold");
    pdf.setFontSize(13.5);
    setColor(INK);
    writeWrapped(lines, PAGE.margin + 12, 17);
    y += 7;
  };

  const timeline = (label: string, events: PreparationDocument["timeline"][number]["events"]) => {
    heading(`${label}: new-rule timeline`);
    for (const event of events) {
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      const titleLines = wrap(event.title, CONTENT_WIDTH - 18);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      const detailLines = wrap(event.detail, CONTENT_WIDTH - 18);
      const eventHeight = 16 + titleLines.length * 14 + detailLines.length * 13.5 + 12;
      ensureSpace(Math.min(eventHeight, 150));
      const eventTop = y;
      const tone = TONES[event.tone] || TONES.neutral;
      setFillColor(tone);
      pdf.rect(PAGE.margin, eventTop - 7, 3, 8, "F");
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8.5);
      setColor(tone);
      pdf.text(formatDate(event.date).toUpperCase(), PAGE.margin + 13, y);
      y += 15;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10.5);
      setColor(INK);
      writeWrapped(titleLines, PAGE.margin + 13, 14);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(9.5);
      setColor(MUTED);
      writeWrapped(detailLines, PAGE.margin + 13, 13.5);
      y += 10;
    }
  };

  const source = (item: PreparationPdfSource) => {
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9.5);
    const lines = wrap(item.label, CONTENT_WIDTH - 20);
    ensureSpace(Math.min(lines.length * 14 + 8, 52));
    setFillColor(GREEN);
    pdf.circle(PAGE.margin + 3, y - 3, 1.7, "F");
    setColor(LINK);
    for (const line of lines) {
      ensureSpace(14);
      pdf.textWithLink(line, PAGE.margin + 16, y, { url: item.url });
      y += 14;
    }
    y += 5;
  };

  // First-page masthead.
  setFillColor(INK);
  pdf.roundedRect(PAGE.margin, 42, 28, 28, 3, 3, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(15);
  pdf.setTextColor(255, 255, 255);
  pdf.text("H", PAGE.margin + 14, 61.5, { align: "center" });
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  setColor(INK);
  pdf.text("HENRYKNOWS", PAGE.margin + 40, 52);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);
  setColor(GREEN);
  pdf.text(audienceLabel, PAGE.margin + 40, 66);

  y = 108;
  pdf.setFont("times", "bold");
  pdf.setFontSize(23);
  setColor(INK);
  const titleLines = wrap(title, CONTENT_WIDTH);
  writeWrapped(titleLines, PAGE.margin, 26);
  const preparedDate = formatPreparedDate(document.savedAt);
  if (preparedDate) {
    y += 2;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    setColor(MUTED);
    pdf.text(`Prepared ${preparedDate}`, PAGE.margin, y);
    y += 15;
  }
  setDrawColor(RULE);
  pdf.setLineWidth(0.8);
  pdf.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
  y += 20;

  for (const section of document.sections) {
    heading(section.heading);
    body(section.body);
  }
  for (const plan of document.timeline) timeline(plan.label, plan.events);
  if (document.audience === "professional" && sources.length) {
    heading("Primary sources");
    for (const item of sources) source(item);
  }

  const boundaryLines = wrap(boundary, CONTENT_WIDTH - 28);
  const boundaryHeight = boundaryLines.length * 12.5 + 24;
  ensureSpace(boundaryHeight + 14);
  y += 10;
  setFillColor(PALE_GREEN);
  pdf.rect(PAGE.margin, y - 8, CONTENT_WIDTH, boundaryHeight, "F");
  setFillColor(GREEN);
  pdf.rect(PAGE.margin, y - 8, 3, boundaryHeight, "F");
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8.5);
  setColor(MUTED);
  y += 8;
  writeWrapped(boundaryLines, PAGE.margin + 16, 12.5);

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    pdf.setPage(page);
    setDrawColor(RULE);
    pdf.setLineWidth(0.5);
    pdf.line(PAGE.margin, 744, PAGE.width - PAGE.margin, 744);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7.5);
    setColor(MUTED);
    pdf.text("HenryKnows | Preparation for discussion and review", PAGE.margin, 760);
    pdf.text(`Page ${page} of ${pages}`, PAGE.width - PAGE.margin, 760, { align: "right" });
  }

  return pdf.output("blob");
}
