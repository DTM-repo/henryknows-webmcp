# Agent-Led Checkpoint

August 31, 2026. Supersedes the wizard and unimplemented-service statements in checkpoint-01. Local prototype only; human product review and deployment approval are still required.

## Product Contract

The external assistant is the expeditor. It clarifies the inquiry, proposes consequential facts for visible confirmation, coordinates tools, evaluates their answers, and authors the documents. Memory is unverified and may be outdated. Confirmation records what the student reports, not independent verification.

HenryKnows remains the broad regulatory reference with student and professional modes. The canonical integrated Duration Mapper specifically assesses the impact of the new duration-of-status rules. Its screening, calculations, advisement and timelines do not determine general F-1 eligibility or authorize travel or employment. This boundary is embedded in every mapper tool and the start guide.

There is no mandatory tool order and no mandatory comparison. Henry can answer first or without mapping. When new-rule evidence is used, it must be current and reviewed. The agent, not a new Henry generation endpoint, writes the student explanation and respectful adviser discussion summary. The site retains, renders and exports that writing without sending it anywhere.

## Implemented

- Ten native `document.modelContext` tools: read/propose case; screen, calculate or compare new-rule effects; request canonical mapper advisement; ask Henry in either mode; inspect asynchronous work; save and inspect agent-authored documents.
- Revision-bound requests, duplicate-job reuse, failure and partial-stream rejection, and stale-answer/document invalidation. Tools cannot mark facts confirmed or evidence reviewed.
- Optional assistant entry from a selected question or an empty question. No manual tool-selection wizard. Confirmed facts and reviewed evidence collapse to keep documents accessible.
- Consented 15-minute transfer of the bounded case through an opaque URL fragment. Confirmation is stripped; the receiving tab asks again. Other chat messages, attachments and credentials do not transfer.
- Documented `codex://new?prompt=...` desktop link and copyable request. It prepares a composer; it does not send the request or prove browser/model support.
- Server-only `HENRY_JUDGE_DEMO=true` flag for a future isolated judging deployment. No client flag can grant access. Existing account endpoints are not made public. Normal Henry access remains the default.

## Verified

- 231 tests in 19 files pass, including all canonical mapper tests. TypeScript and the preparation-only Vite build pass. No canonical legal-engine or published mapper changes.
- Actual native WebMCP calls in the desktop browser, not a shim: fictional facts proposed, confirmed through test UI interaction, both plans calculated, canonical advisement generated, findings reviewed, both Henry modes called, and two externally authored documents saved.
- Observed request timings: calculations about 4 ms; mapper advisement 20.99 seconds; student Henry answer 20.52 seconds; professional Henry answer 28.54 seconds. These are individual observed stages, not end-to-end benchmarks or guarantees.
- Henry's professional response identified overbroad wording in the mapper narrative and separated reported facts from assumptions. The documents preserved the unknowns rather than treating the tool responses as a decision.
- A material context edit marked both documents and all three operations outdated. A call using the old revision returned `stale_revision`.
- Actual local transfer creation/read in separate tabs preserved inquiry, context and the alternative, removed the token from the displayed address, and restored with no confirmation. This is not an independent-profile or OS-launch test.
- Desktop and 390px/320px screenshots inspected. Narrow-phone header collision with the legacy page's global header CSS was repaired; title stays above the notice, and no horizontal overflow was measured. Browser viewport restored afterward.
- Adviser download button exercised. Printable output layout and clipboard permissions were not independently verified. Local copies of the two actual test documents are [student](example-student.md) and [professional](example-professional.md).
- Unit/contract coverage includes incomplete broad cases without mapping, both audience requirements, invented source IDs, revision races, pending deduplication, partial/refused streams, failed jobs, handoff bounds/expiry, and default access versus server-owned judging access.

## Local Preview

Source: `/Users/davidmaxon/Documents/New project/henryknows-webmcp`.
Running preview: http://localhost:8029/.

iCloud repeatedly offloaded source and dependencies in Documents, stalling builds and watchers. The running preview therefore uses a temporary source copy at `/private/tmp/henry-webmcp-preview`, with dependency copies at `/private/tmp/henry-webmcp-runtime`. These paths can disappear after cleanup/restart. Source edits remain in the repository; final generated preparation assets were copied back. Do not copy `.env` files into the preview.

Standard checks from the repository when dependencies are available:

```sh
npm --prefix calculator test
npm --prefix calculator run build:preparation
```

Local runtime command, run from the preview copy (references the existing environment file without copying or displaying credentials):

```sh
env HENRY_JUDGE_DEMO=true node --env-file=/Users/davidmaxon/Projects/henryknows/.env /usr/local/bin/netlify dev --offline --no-open --framework '#static' --dir public --port 8029 --functions-port 8030
```

This process is local and unlinked. Do not deploy or push to the clone's origin, which points to the original checkout. The older 8028 server is static-only and cannot run Henry or the advisement backend.

## Remaining Checks And Limits

- David's review of whether the entry, confirmation, and documents are intuitive. Automated tests do not substitute for product review.
- Authorized OS-level desktop launch and actual app/model availability. No new user task was created to test this. Unsupported installation/sign-in behavior still needs a human walkthrough.
- Approved non-production deployment, deployed long-running jobs/rate-limit configuration, and scheduled transfer cleanup. Cleanup is hourly when deployed; it does not run automatically in local development or deploy previews.
- Case facts persist locally, but confirmations do not survive reload. Answers/jobs/documents are held in the open page only; downloads survive. Reload recovery for generated work is not implemented.
- Transfer currently preserves the selected question and bounded facts, not full conversation history or existing output files. The UI discloses this.
- Source-ID checks prevent invented references, not unsupported reasoning. Retrieved Henry sources are candidates. A source list is not proof that every statement is supported. Adviser/regulatory review of the demo wording remains necessary.
- The old `Panel.tsx` wizard is not mounted; retained legacy files/tests are historical. No broad cleanup was included in this change.
- No push, production mutation, public source/corpus release, Devpost submission, or real student-record use occurred.
