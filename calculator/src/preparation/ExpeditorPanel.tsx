import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Check, Copy, Download, LoaderCircle, MessageSquare, Printer, X } from "./icons";
import { FIELDS } from "./case";
import type { ScenarioField, ScenarioFacts } from "./case";
import { PreparationController } from "./controller";
import { Expeditor } from "./expeditor";
import type { PreparationDocument } from "./expeditor";
import type { Source } from "./services";
import type { PlanAnalysis } from "./mapper";
import { displayValue } from "./presentation";
import { createHandoff } from "./handoff";
import { createPreparationPdf, preparationPdfFilename } from "./pdf";

function FactList({ facts }: { facts: ScenarioFacts }) {
  const entries = visibleFactEntries(facts);
  if (!entries.length) return null;
  return <dl className="hk-fact-list hk-shared-facts">{entries.map(([key, value]) => <div key={key}><dt>{FIELDS[key].label}</dt><dd>{displayValue(value)}</dd></div>)}</dl>;
}

function visibleFactEntries(facts: ScenarioFacts) {
  return (Object.keys(FIELDS) as ScenarioField[])
    .map((key) => [key, facts[key]] as const)
    .filter(([key, value]) => value !== undefined && value !== "" && value !== "unknown" &&
      !(key === "programEndOnEffectiveDate" && value === facts.currentProgramEndDate) &&
      !(key === "optIntent" && value === "yes" && facts.optStage && facts.optStage !== "unknown") &&
      !(key === "travelPosture" && value === "planned" && facts.reentryDate));
}

function conciseContext(item: string) {
  const concise = item.trim().replace(/^(?:the\s+)?student\s+(?:reports?|reported|says?|said)\s+(?:that\s+)?/i, "");
  return concise ? concise[0].toUpperCase() + concise.slice(1) : concise;
}

function duplicatesStructuredFact(item: string, facts: ScenarioFacts) {
  const normalized = item.toLowerCase();
  return Object.values(facts).some((value) => {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const monthYear = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(value + "T00:00:00Z"));
    return normalized.includes(value.toLowerCase()) || normalized.includes(displayValue(value).toLowerCase()) || normalized.includes(monthYear.toLowerCase());
  });
}

function usefulAssumption(item: string) {
  return !/\b(?:unknown|not (?:yet )?(?:known|reported|provided)|has not been (?:reported|provided)|no (?:exact )?[^.]{0,80}(?:reported|provided))\b/i.test(item);
}

function visibleContext(reportedFacts: string[], assumptions: string[], facts: ScenarioFacts) {
  return {
    reported: reportedFacts.map(conciseContext).filter((item) => item && !duplicatesStructuredFact(item, facts)),
    tentative: assumptions.map(conciseContext).filter((item) => item && usefulAssumption(item) && !duplicatesStructuredFact(item, facts)),
  };
}

function ContextLists({ reportedFacts, assumptions, facts }: { reportedFacts: string[]; assumptions: string[]; facts: ScenarioFacts }) {
  const { reported, tentative } = visibleContext(reportedFacts, assumptions, facts);
  if (!reported.length && !tentative.length) return null;
  return <div className="hk-context-lists">
    {!!reported.length && <section><h4>Other relevant facts</h4><ul>{reported.map((fact, index) => <li key={index}>{fact}</li>)}</ul></section>}
    {!!tentative.length && <section><h4>Tentative plans</h4><ul>{tentative.map((assumption, index) => <li key={index}>{assumption}</li>)}</ul></section>}
  </div>;
}

function Timeline({ plan }: { plan: Pick<PlanAnalysis, "label" | "posture" | "result"> }) {
  return <section className="hk-section"><h4>{plan.label}: new-rule timeline</h4>{plan.posture === "projected_after_return" && <p className="hk-muted">This shows what would happen after the proposed return; it is not an admission decision.</p>}<ol className="hk-timeline">{plan.result.timeline.map((event, index) => <li key={index}><time dateTime={event.date}>{displayValue(event.date)}</time><div><strong>{event.title}</strong><p>{event.detail}</p></div></li>)}</ol></section>;
}

function sectionSources(sourceIds: string[], sources: Source[]) {
  const unique = new Map<string, Source>();
  for (const id of sourceIds) {
    const source = sources.find((item) => item.id === id);
    if (source && !unique.has(source.url)) unique.set(source.url, source);
  }
  return [...unique.values()];
}

function documentSources(doc: PreparationDocument, sources: Source[]) {
  return sectionSources(doc.sections.flatMap((section) => section.sourceIds), doc.sources.length ? doc.sources : sources);
}

function sourceDisplay(source: Source) {
  try {
    const host = new URL(source.url).hostname.replace(/^www\./, "");
    if (host === "federalregister.gov") return "Federal Register final rule (July 17, 2026)";
    if (host === "ecfr.gov") return source.heading ? `Electronic Code of Federal Regulations: ${source.heading}` : "Electronic Code of Federal Regulations";
  } catch { /* Fall back to the supplied source title. */ }
  const title = source.title.replace(/^['\"]+|['\"]+$/g, "");
  return `${title}${source.heading ? `: ${source.heading}` : ""}`;
}

function documentBoundary(audience: PreparationDocument["audience"]) {
  return audience === "student"
    ? "General information only, not legal advice. Confirm your plan with your DSO or qualified immigration counsel, and check current primary sources."
    : "Preparation summary only. Verify against current primary authority and institutional policy.";
}

function DocumentBody({ body }: { body: string }) {
  const blocks = body.split(/\n\s*\n/).filter(Boolean);
  return <>{blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    return lines.length && lines.every((line) => /^[-*]\s+/.test(line))
      ? <ul className="hk-document-list" key={index}>{lines.map((line, lineIndex) => <li key={lineIndex}>{line.replace(/^[-*]\s+/, "")}</li>)}</ul>
      : <p className="hk-prose" key={index}>{block}</p>;
  })}</>;
}

export function documentText(doc: PreparationDocument, work: Expeditor) {
  const sources = work.sources();
  const sections = doc.sections.map((section) => `## ${section.heading}\n\n${section.body}`);
  const timelines = doc.timeline.map((plan) => `## ${plan.label}: new-rule timeline\n${plan.events.map((event) => `- ${displayValue(event.date)}: ${event.title}. ${event.detail}`).join("\n")}`);
  const links = doc.audience === "professional" ? documentSources(doc, sources).map((source) => `[${sourceDisplay(source)}](${source.url})`) : [];
  const sourceBlock = links.length ? [`## Primary sources\n\n${links.map((link) => `- ${link}`).join("\n")}`] : [];
  return [`# ${doc.title}`, ...sections, ...timelines, ...sourceBlock, documentBoundary(doc.audience)].join("\n\n");
}

function DocumentView({ doc, work }: { doc: PreparationDocument; work: Expeditor }) {
  const [copied, setCopied] = useState(false);
  const [creatingPdf, setCreatingPdf] = useState(false);
  const [pdfError, setPdfError] = useState(false);
  const sources = work.sources();
  const current = work.documentCurrent(doc);
  const primarySources = doc.audience === "professional" ? documentSources(doc, sources) : [];
  const download = async () => {
    if (creatingPdf) return;
    setCreatingPdf(true);
    setPdfError(false);
    try {
      const blob = await createPreparationPdf(doc, primarySources.map((source) => ({ label: sourceDisplay(source), url: source.url })), documentBoundary(doc.audience));
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = preparationPdfFilename(doc.audience);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setPdfError(true);
    } finally {
      setCreatingPdf(false);
    }
  };
  return <article className="hk-document"><header className="hk-section-heading"><h3>{doc.title}</h3><div className="hk-doc-actions">
    <button className="hk-icon" title={copied ? "Copied" : "Copy document"} aria-label="Copy document" onClick={() => void navigator.clipboard.writeText(documentText(doc, work)).then(() => setCopied(true)).catch(() => setCopied(false))}>{copied ? <Check size={17} /> : <Copy size={17} />}</button>
    <button className="hk-icon" title="Download PDF" aria-label="Download PDF" disabled={creatingPdf} onClick={() => void download()}>{creatingPdf ? <LoaderCircle className="hk-spin" size={17} /> : <Download size={17} />}</button>
    <button className="hk-icon" title="Print document" aria-label="Print document" onClick={() => window.print()}><Printer size={17} /></button>
  </div></header>{pdfError && <p role="alert" className="hk-error">The PDF could not be created. Try again or use Print.</p>}{!current && <p className="hk-warning">This saved copy belongs to an earlier version of your case. Ask ChatGPT to refresh it before relying on it.</p>}
  <>
    {doc.sections.map((section, index) => <section className="hk-section" key={index}><h4>{section.heading}</h4><DocumentBody body={section.body} /></section>)}
    {doc.timeline.map((plan, index) => <section className="hk-section" key={index}><h4>{plan.label}: new-rule timeline</h4><ol className="hk-timeline">{plan.events.map((event, eventIndex) => <li key={eventIndex}><time dateTime={event.date}>{displayValue(event.date)}</time><div><strong>{event.title}</strong><p>{event.detail}</p></div></li>)}</ol></section>)}
    {!!primarySources.length && <section className="hk-section hk-primary-sources"><h4>Primary sources</h4><ul className="hk-source-links">{primarySources.map((source) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{sourceDisplay(source)}</a></li>)}</ul></section>}
  </>
    <p className="hk-boundary">{documentBoundary(doc.audience)}</p>
  </article>;
}

export function ExpeditorPanel({ controller, work, getInquiry, toolStatus, incomingError, assistantSession = false }: {
  controller: PreparationController;
  work: Expeditor;
  getInquiry: () => string;
  toolStatus: "checking" | "supported" | "unavailable";
  incomingError?: string;
  assistantSession?: boolean;
}) {
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  const output = useSyncExternalStore(work.subscribe, work.getSnapshot, work.getSnapshot);
  const current = snapshot.case;
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [launch, setLaunch] = useState<Awaited<ReturnType<typeof createHandoff>> | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<"student" | "professional">("student");
  const documents = {
    student: output.documents.student?.caseId === current.id ? output.documents.student : undefined,
    professional: output.documents.professional?.caseId === current.id ? output.documents.professional : undefined,
  };
  const visibleDoc = documents[selectedDoc] || documents.student || documents.professional;
  const documentsReady = !!documents.student && !!documents.professional && work.documentCurrent(documents.student) && work.documentCurrent(documents.professional);
  const confirmed = current.confirmedRevision === current.revision;
  const analysis = snapshot.analysis?.revision === current.revision ? snapshot.analysis : null;
  const activeOperations = output.operations.filter((operation) => operation.caseId === current.id && operation.revision === current.revision);
  const pendingOperations = activeOperations.filter((operation) => operation.status === "pending");
  const reports = activeOperations.filter((operation) => operation.kind === "advisement" && operation.status === "ready");
  const hasAgentWork = assistantSession || snapshot.activity.some((item) => item.actor === "agent") || activeOperations.length > 0 || confirmed || !!visibleDoc;
  const shownContext = visibleContext(current.reportedFacts, current.assumptions, current.scenario);
  const hasStructuredFacts = Object.values(current.scenario).some((value) => value !== "" && value !== "unknown");
  const hasCollectedDetails = hasStructuredFacts || shownContext.reported.length > 0 || shownContext.tentative.length > 0;
  const detailCount = visibleFactEntries(current.scenario).length + shownContext.reported.length + shownContext.tentative.length;
  const connectionObserved = snapshot.activity.some((item) => item.name === "Assistant connected");
  const agentConnected = toolStatus === "supported" && (assistantSession || connectionObserved);
  const pendingMessage = pendingOperations.some((operation) => operation.kind === "henry")
    ? "Consulting HenryKnows..."
    : "Building your new-rule timeline...";
  const act = (action: () => unknown) => { try { action(); setError(""); } catch (caught) { setError(caught instanceof Error ? caught.message : "That could not be completed."); } };

  useEffect(() => { if (snapshot.open && !dialog.current?.open) dialog.current?.showModal(); if (!snapshot.open && dialog.current?.open) dialog.current?.close(); }, [snapshot.open]);
  useEffect(() => { setLaunch(null); }, [current.id, current.revision]);
  useEffect(() => {
    const pending = activeOperations.filter((operation) => operation.kind === "advisement" && operation.status === "pending" && operation.responseId);
    if (!pending.length) return;
    const interval = setInterval(() => { for (const operation of pending) void work.getOperation({ operationId: operation.id }); }, 5000);
    return () => clearInterval(interval);
  }, [activeOperations, work]);

  const launchAssistant = async () => {
    setTransferring(true);
    setError("");
    try {
      const prepared = launch ?? await createHandoff(current, window.location.href);
      const latest = controller.getSnapshot().case;
      if (latest.id !== current.id || latest.revision !== current.revision) throw new Error("Your question changed while ChatGPT was opening. Try again with the current version.");
      setLaunch(prepared);
      window.location.assign(prepared.desktopUrl);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The assistant continuation could not be prepared."); }
    finally { setTransferring(false); }
  };

  const progressMessage = documentsReady ? "Your documents are ready"
    : visibleDoc ? "Saved documents need refresh"
    : pendingOperations.length ? pendingMessage.replace(/\.\.\.$/, "")
    : analysis ? "Your timeline is ready"
    : confirmed ? "Your details are confirmed"
    : detailCount ? `${detailCount} ${detailCount === 1 ? "detail" : "details"} collected`
    : current.inquiry ? "Your question is ready"
    : "Ready for your question";
  const connectionMessage = toolStatus === "checking" ? "Connecting ChatGPT and HenryKnows"
    : toolStatus === "unavailable" ? "Connection unavailable"
    : agentConnected ? "ChatGPT and HenryKnows are connected"
    : "HenryKnows is ready for ChatGPT";

  return <div className="hk-prep"><button className="hk-invitation" onClick={() => act(() => controller.open(getInquiry()))}><MessageSquare size={16} />Use HenryKnows with ChatGPT<ArrowUpRight size={15} /></button>
    <dialog className={`hk-dialog hk-expeditor${hasAgentWork ? "" : " hk-expeditor-launch"}`} ref={dialog} onCancel={() => controller.close()} onClose={() => controller.close()} aria-labelledby="hk-preparation-title">
      <div className="hk-shell"><header className="hk-header"><img src="/favicon.svg" width="28" height="28" alt="" /><div className="hk-brand"><span>HenryKnows</span><h2 id="hk-preparation-title">{hasAgentWork ? "Advising preparation" : "Use HenryKnows with ChatGPT"}</h2></div><button className="hk-icon" aria-label="Close preparation" title="Close" onClick={() => controller.close()}><X size={20} /></button></header>
      <div className="hk-scroll"><div className="hk-content">{(error || incomingError) && <p role="alert" className="hk-error">{error || incomingError}</p>}
        {!hasAgentWork ? <section className="hk-section hk-connect"><p className="hk-intro">Use ChatGPT with Henry to get a detailed regulatory explanation and prepare a summary to bring to your adviser or DSO.</p>
          <button className="hk-primary" disabled={transferring} onClick={() => void launchAssistant()}>{transferring ? <LoaderCircle className="hk-spin" size={16} /> : <ArrowUpRight size={16} />}{transferring ? "Opening ChatGPT..." : "Open ChatGPT"}</button>
        </section> : <>
          <div className={`hk-live-status${agentConnected ? " hk-live-connected" : ""}${pendingOperations.length ? " hk-live-active" : ""}`} role="status" aria-live="polite"><span className="hk-live-dot" aria-hidden="true" /><strong>{connectionMessage}</strong><span>{progressMessage}</span></div>
          {assistantSession && toolStatus === "unavailable" && <p role="alert" className="hk-error">ChatGPT could not connect to HenryKnows on this page.</p>}
          {visibleDoc && <section className="hk-documents"><div className="hk-documents-heading"><span className="hk-eyebrow">{documentsReady ? "Documents ready" : "Saved documents"}</span><h3>Your advising preparation</h3></div><div className="hk-doc-tabs" role="tablist" aria-label="Preparation documents">{(["student", "professional"] as const).map((mode) => <button role="tab" aria-selected={visibleDoc.audience === mode} key={mode} disabled={!documents[mode]} onClick={() => setSelectedDoc(mode)}>{mode === "student" ? "For me" : "For my adviser or DSO"}</button>)}</div><DocumentView doc={visibleDoc} work={work} /></section>}
          <section className="hk-section hk-case-record"><div className="hk-section-heading"><div><span className="hk-eyebrow">Shared case</span><h3>{confirmed ? "Case confirmed" : hasCollectedDetails ? "Building your preparation" : toolStatus === "checking" ? "Connecting to your assistant" : "Connected to your assistant"}</h3></div>{confirmed && <Check size={20} aria-hidden="true" />}</div>
            {confirmed && current.confirmation ? <><p className="hk-prose">{current.confirmation.summary}</p>{hasCollectedDetails && <details><summary>Case details</summary><FactList facts={current.scenario} /><ContextLists reportedFacts={current.reportedFacts} assumptions={current.assumptions} facts={current.scenario} />{current.alternative && <><h4>{current.alternative.label}</h4><FactList facts={current.alternative.changes} /></>}</details>}</> : <>
              {!hasCollectedDetails && <p className="hk-intro">Your facts, timeline, and documents will appear here as you work with your assistant.</p>}
              {!hasCollectedDetails && current.inquiry && <div className="hk-inquiry-preview"><span className="hk-eyebrow">Starting question</span><p className="hk-prose">{current.inquiry}</p></div>}
              {hasStructuredFacts && <FactList facts={current.scenario} />}
              <ContextLists reportedFacts={current.reportedFacts} assumptions={current.assumptions} facts={current.scenario} />
              {current.alternative && <details><summary>{current.alternative.label}</summary><FactList facts={current.alternative.changes} /></details>}
            </>}
          </section>
          {!!pendingOperations.length && <p className="hk-work-status"><LoaderCircle className="hk-spin" size={16} />{pendingMessage}</p>}
          {analysis && <details className="hk-section hk-review-details"><summary>Your new-rule timeline</summary><p className="hk-muted">This focuses on how the rules taking effect September 15, 2026 affect the dates in this plan. Broader eligibility questions remain with HenryKnows and your adviser.</p>{[analysis.baseline, ...(analysis.alternative ? [analysis.alternative] : [])].map((plan, index) => <section className="hk-section" key={index}><h4>{analysis.alternative ? plan.label : "Your plan"}</h4><strong>{plan.result.headline}</strong><p>{plan.result.summary}</p><Timeline plan={plan} /></section>)}{reports.map((operation) => <section key={operation.id} className="hk-section"><h4>{operation.advisement!.title}</h4>{operation.advisement!.sections.map((section, index) => <div key={index}><strong>{section.heading}</strong><p>{section.body}</p></div>)}</section>)}</details>}
          {!!activeOperations.length && <details className="hk-section hk-reference-work"><summary>Reference work</summary>{activeOperations.map((operation) => <div className="hk-operation" key={operation.id}><div>{operation.status === "pending" ? <LoaderCircle className="hk-spin" size={16} /> : operation.status === "ready" ? <Check size={16} /> : null}<span>{operation.kind === "henry" ? `HenryKnows: ${operation.audience === "student" ? "student explanation" : "professional reference"}` : "Duration-rule advisement"}</span><span className="hk-muted">{operation.status === "pending" ? "In progress" : operation.status === "ready" ? "Ready" : operation.status === "outdated" ? "Superseded" : "Unavailable"}</span></div>{operation.error && <p role="alert" className="hk-error">{operation.error}</p>}</div>)}</details>}
        </>}
      </div></div>{hasAgentWork && <footer className="hk-actions"><button className="hk-text-button" onClick={() => controller.close()}>Return to Henry</button></footer>}</div>
    </dialog></div>;
}
