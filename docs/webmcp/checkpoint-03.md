# Conversational Expeditor Checkpoint

August 31, 2026. Supersedes the interaction model in checkpoint-02. Local prototype only; deployment and final product approval remain separate.

## Current Product Contract

The external assistant is the expeditor. It gathers only material facts, labels assumptions and student-chosen modeling values, consults HenryKnows as often as useful, gives one final recap, and records the student's direct conversational confirmation. The assistant evaluates tool results and authors the two documents. The student does not operate a second intake wizard or approve regulatory evidence.

HenryKnows remains the broad, source-grounded F-1 reference in student and professional modes. The integrated Duration Mapper has one specialized job: assess the effect of the new duration-of-status rules on a settled scenario. It normally runs once after precise confirmed or explicitly modeled inputs are available. It is not a general travel, employment, or eligibility decision tool.

## Implemented Correction

- Eleven native site tools, including `confirm_preparation_case`. Draft screening and Henry consultation do not require confirmation; case-specific calculations and documents do.
- Conversational confirmation is revision-bound. Silence, a stale case, a negative response, and a response such as "Yes, but actually I meant March" do not confirm the case.
- Fresh assistant entry and invalid transfer fallback start blank. A different selected Henry inquiry receives a new case ID and cannot inherit the prior scenario, operations, or documents.
- Repeated Henry calls are supported before and after the mapper. Identical in-flight requests are reused; distinct clarification questions remain available.
- Mapper calculations and advisement use automatic case/evidence freshness. No student evidence-approval field, tool, checkbox, or second confirmation remains.
- The shared page is a supporting surface: confirmed recap, relevant facts, relevant assumptions, calculation details, new-rule evidence, reference-work status, timeline, and the two documents.
- Student documents hide citations in the rendered page and Markdown export. Adviser/DSO documents render source links and collapse duplicate URLs. Both have copy, download, and print controls.
- Document validation rejects internal source IDs, prototype/writing-policy prose, and fictional-demo language in the body. The agent, not HenryKnows or the page, writes the final prose.

## Real Native Acceptance Run

The run used the actual browser site-tool surface and local Henry/mapper backends at `http://localhost:8029/`:

1. Opened a genuinely empty assistant case.
2. Proposed an incomplete OPT/travel inquiry with only relevant reported facts and one tentative travel assumption.
3. Screened the draft and received missing inputs with reasons.
4. Rejected a response that corrected the recap, then recorded a clear conversational confirmation.
5. Ran one canonical duration-rule plan calculation with no comparison placeholder and no evidence-review step.
6. Called Henry once for broad student orientation, once for professional integration with mapper evidence, and once for the final student integration.
7. Saved a plain student document and a source-linked professional document, both authored by the external agent and tied to the same case revision.

The rendered student document contained zero links. The professional document displayed Federal Register/eCFR sources. Desktop and phone screenshots were inspected. At 390px, the populated modal previously measured `390/390` page width, `372/372` dialog width, and `332/332` article width (client/scroll), with no horizontal overflow. The final fresh-entry copy was rechecked visually after the last fixes.

## Verification

```sh
npm --prefix calculator test -- --run
npm --prefix calculator run build:preparation
git diff --check
```

Result: 228 tests in 18 files passed. TypeScript and the preparation-only Vite build passed. The generated `public/advising/preparation.js` and `.css` were refreshed. The canonical mapper rules and published mapper page were not edited.

## Host Limitation

A bounded real-host experiment proved that an asynchronous WebMCP call can show a page confirmation request, but the caller times out after about 25 seconds. A later page click updates the page but does not resume the abandoned agent call. The implemented route therefore keeps confirmation in the assistant conversation. The page does not ask the student to click and then type "done."

## Remaining Checkpoints

- David's hands-on review of the corrected experience.
- An explicitly authorized desktop-launch walkthrough and non-production judging deployment.
- Deployed long-running job, rate-limit, cleanup, and fresh-profile access verification.
- Adviser/regulatory review of the demo's substantive wording.
- No push, production mutation, public release, Devpost submission, or real student-record use occurred.

## September 1 Communication Repair

David's first full hands-on run validated the regulatory orchestration but rejected the amount of repetition and tool-centric language. The correction now enforces these additional behaviors:

- Record a clear answer immediately; do not ask for permission to record it or repeat it back as a new confirmation.
- Ask one question per turn. Do not label it a "useful follow-up" or combine presence, status maintenance, and I-94 basis into one turn.
- Build the shared case cumulatively. Structured dates appear once; free-text facts must not duplicate structured fields; generic unknown/not-reported items are not visible assumptions.
- Screen for every calculation input before the final recap. A post-September 15 return using the same/longer I-20 now requires the program start date before calculation.
- Explain the new-rule timeline in student language before using it. Never expose internal posture/classification names or narrate revisions, stale runs, and tool bookkeeping.
- Put completed documents at the top of the panel. Student questions render as direct bullets. The professional brief is concise and case-specific, omits ordinary DSO procedure and product/tool attribution, and receives one deduplicated primary-source list.
- Document validation rejects HenryKnows/mapper/WebMCP attribution, internal snake-case labels, and repeated "Ask..." question boilerplate. Federal Register links render with a primary-authority label rather than a corpus title.

Live verification repeated the native case update, calculation, student/professional Henry calls, and both document saves. At 390px, the revised cumulative case measured `390/390` page and `372/372` dialog widths with no horizontal overflow. The full result appeared document-first. Current verification is 233 tests in 18 files plus a successful TypeScript/preparation build.

ChatGPT's current site-tools documentation requires ChatGPT Work or Codex for the built-in browser. The initial switch from ordinary Chat is therefore a host constraint, not something the page can suppress through a documented handoff option. The entry now sets that expectation directly. Final human approval still requires a fresh walkthrough of this revision.

## September 2 Launch And Completion Repair

David's next hands-on run confirmed that the reasoning had improved but found avoidable launch friction, another redundant I-20 question, too little visible coordination with the page, and a false final claim that the two documents were ready.

- The website entry is now `Use HenryKnows with ChatGPT`. Its dialog contains one benefit sentence and one `Open ChatGPT` action. The copy-request fallback, calculator link, compatibility lecture, and second launch button were removed.
- The transferred guide addresses the user as `you`, begins an empty case with `What would you like to figure out?`, records clear answers without asking permission, and asks for a planned OPT filing date in ordinary language. A current I-20 end date now supplies the September 15 end date unless the user says it will change.
- The shared page shows a live connection line and cumulative progress as the agent records details, consults Henry, calculates the new-rule timeline, and retains documents. The page cannot force the ChatGPT host to keep its browser panel visible, so the agent guide explicitly asks it to keep the live HenryKnows page beside the conversation.
- The professional brief defaults to a compact expert handoff. It does not receive the student's full explanatory timeline unless the sequence of dates is itself the issue requiring review.
- The two documents now save atomically. A failed or stale audience prevents both from being committed. `get_preparation_outputs` is the explicit completion gate, and the assistant may say the documents are ready only when it returns `completion.status: ready`.
- Saved document bodies, source snapshots, and timeline snapshots survive a page reload. Because restored cases require renewed confirmation, the UI labels those copies `Saved documents` and `need refresh`; it does not call them ready.

The false-ready root cause was reproduced from the actual Work task. Both original document saves failed freshness checks after an optional advisement changed the evidence snapshot. The agent began refreshing its two Henry answers, hit its usage limit, and nevertheless emitted a completion sentence. The revised mapper fingerprint excludes optional narrative completion, the pair save is all-or-nothing, and the final read-back makes that claim impossible through the intended tool contract.

A fresh native acceptance run used the actual local Henry backends: draft collection, one confirmation, one canonical single-plan calculation, student and professional Henry answers, atomic pair save, final completion read, desktop rendering, 390x844 rendering, and reload recovery. The live completion returned `ready` with both audiences current. The phone page and dialog had matching client/scroll widths with no horizontal overflow. After reload, both bodies remained readable and the API/UI correctly reported them as needing refresh.

Verification is now 238 tests in 18 files, plus successful TypeScript, canonical app, and preparation-only builds. Generated preparation assets were refreshed. No deployment, remote push, production mutation, public release, or submission occurred.

## September 2 Finish-First Polish

David's next complete run rated the experience B+/A- and, for the first time, described it as an actually usable product. The regulatory analysis was correct and useful, the shared page accumulated evidence during the conversation, and the strongest moment was the assistant identifying a real gap in the transition guidance without manufacturing certainty. That unresolved-authority moment is now a primary demo proof point.

- A supported assistant session records its connection immediately after native tool registration, before the first case read. The shared panel therefore opens with `ChatGPT and HenryKnows are connected` instead of waiting for a round of questions.
- The connection dot now has a restrained breathing animation and a faster active-work pulse, with reduced-motion support. It represents successful page/tool registration. The current host exposes no later disconnect event, so closing the host panel cannot be detected instantly by the page.
- The assistant now distinguishes a date the student has chosen from a request for help choosing one. When guidance is requested, it should ask about the real constraint, consult Henry, and offer one or two concrete dates or sequences with practical tradeoffs. The student may choose one, compare both, or carry the unresolved choice into the documents.
- Tool retries, stale references, rejected saves, operation IDs, and other bookkeeping are private recovery work. The assistant must not narrate them unless a genuine interruption requires student action.
- The student document may include a concise two-plan comparison, but the page owns the canonical timeline when requested; a second authored timeline is rejected. The professional brief must lead directly with the case-specific question, omit routine professional instruction of every kind unless it is itself disputed or explains an unusual case-specific departure, and use short human sentences while retaining the controlling authority and unresolved issue.
- A current duration advisement may support the documents without being misidentified as a Henry answer. Only current audience-matching Henry answers are retained as document answer IDs.

Browser verification showed the connected state immediately, the `hk-breathe` animation active, and no console errors. The full suite now passes 240 tests in 18 files, and TypeScript plus the preparation production build pass. The next critical path is an authorized judging deployment, a fresh-profile end-to-end run, and submission materials rather than further interaction redesign.

## September 2 PDF Export Repair

David identified that the retained documents downloaded as Markdown files. On his computer that format opened Claude instead of a readable document, and even a correctly associated Markdown viewer would not provide an appropriate student-to-adviser handoff.

- Replaced the Markdown download with a real client-generated PDF for each audience. Stable filenames are `henryknows-student-preparation.pdf` and `henryknows-adviser-preparation.pdf`.
- The PDF generator loads only after the download action, so the normal HenryKnows and WebMCP interface does not pay the PDF library's startup cost.
- Both PDFs use a restrained HenryKnows masthead, Letter pages, section hierarchy, page breaks, continuation headers, page numbers, and a clear preparation boundary. Student timelines render as dated events with restrained status color. Adviser primary-source labels remain clickable PDF links.
- PDF text is normalized for common smart punctuation and stray Markdown formatting so core PDF fonts do not produce broken glyphs or visible syntax.
- The download button now reads `Download PDF`, shows a working state, and presents a concise fallback message if generation fails. Copy and Print remain separate actions.

Generated student and adviser samples were validated as PDF 1.3 files, reopened with independent PDF tooling, text-extracted, and visually inspected page by page. The student sample rendered cleanly across two pages; the concise adviser sample rendered on one page, and both Federal Register/eCFR links were present as link annotations. Production dependencies have zero npm audit findings. The full suite now passes 242 tests in 19 files, and the preparation production build passes with the PDF code split into an on-demand chunk.

The optional live Henry-answer smoke test could not produce a fresh document because this local preview process has no provider credential; the backend returned 502 and the app correctly kept completion incomplete. This is a local service-configuration limitation, not a PDF-generation failure. A deployed fresh-profile document download remains part of the judging-preview checkpoint.

## September 3 Public Judging Deployment

The isolated judging site is live at `https://henryknows-webmcp.netlify.app`. It uses server-controlled judge access, a separate signing secret, the existing per-IP/domain Henry rate limit, and a server-side provider credential. The commercial HenryKnows deployment was not changed.

The public deployment passed these live checks:

- Henry streamed a substantive student answer and completed with ten source records.
- Duration intake extracted supported facts from a short fictional OPT/travel narrative.
- A bounded continuation token preserved and returned a non-identifying case from the isolated Netlify Blob store.
- The public page registered all eleven WebMCP tools and showed the connected state immediately.
- A confirmed single-plan case produced the canonical new-rule timeline.
- Separate student and professional Henry operations completed. When the first student answer conflicted with the filing-window dates, a later Henry consultation corrected the conflict before document creation.
- The external agent authored and atomically saved both documents. `get_preparation_outputs` returned `completion.status: ready`, and the panel displayed the student guide first with its timeline plus a concise DSO brief with two primary-source links.
- Both `Download PDF` controls completed generation without a page error. The in-app browser automation surface did not expose the synthetic Blob download as a conventional download event, so downloadable-file integrity continues to rely on the independently verified PDF byte/layout tests described above.

Netlify initially packaged the local dependency-folder symlink instead of the Anthropic SDK. The deployed configuration now packages the SDK only with the five functions that use it and includes the Henry knowledge index only with `chat-proxy-v2`. A cache-bypassed deployment and subsequent live model calls verified the repair.
