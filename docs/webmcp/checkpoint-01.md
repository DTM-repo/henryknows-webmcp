# WebMCP Checkpoint 1

Historical record. The agent-led implementation and current verification are in [checkpoint-02.md](checkpoint-02.md); the wizard described below is no longer mounted.

Date: 2026-08-30. Status: first product review requested a UX redesign; revised flow awaiting review.

## Scope

This is an additive extension of the integrated HenryKnows repository at
`b2fbdd7`. The mapper under `calculator/` is canonical. The older standalone
hackathon mapper was not used or synchronized into this implementation.

Implemented:

- A visible preparation entry alongside HenryKnows' existing chat and audience controls.
- One fictional, versioned case with a baseline and optional alternative.
- Runtime validation, explicit unknowns, conflicting-date checks, and expected-revision updates.
- Separate visible review of the reported facts and the comparison findings.
- Canonical mapper screening, deterministic calculation, timelines, and source links.
- Old comparisons marked outdated after edits; confirmation and evidence approval revoked.
- Bounded local persistence that restores facts but never restores confirmation.
- Native top-level `document.modelContext` registration, without a WebMCP shim.

Not implemented at this checkpoint:

- Mapper narrative/advisement generation and its reviewed handoff.
- Paired student/adviser documents through the actual HenryKnows AI engine.
- Consented desktop continuation or cross-browser case restoration.
- Server-controlled free judging mode, deployment, or public submission packaging.

The static local preview does not run HenryKnows' backend chat functions. No
provider credentials were copied, no AI requests were made, and no production
authentication, billing, or deployment settings were changed.

## Run Locally

From the repository root, with its existing dependencies installed:

```sh
npm --prefix calculator test
npm --prefix calculator run build:preparation
python3 -m http.server 8028 --bind 127.0.0.1 --directory public
```

Open `http://127.0.0.1:8028/`, not the HTML file directly. The module needs an
HTTP origin. The preparation build writes only `public/advising/`.

Do not run the full mapper build as a substitute: the existing published mapper
HTML contains an explainer and JSON-LD not present in its source template. That
pre-existing drift must be reconciled before any full mapper rebuild is shipped.

## Native Operations

| Tool | Effect |
| --- | --- |
| `get_preparation_case` | Read bounded case context, revision, review state, and freshness. |
| `propose_case_update` | Validate a proposal and open the visible draft for review. |
| `screen_duration_topics` | Screen confirmed F-1 facts using canonical applicability logic. |
| `compare_duration_plans` | Calculate and display separate results for confirmed plans. |
| `check_duration_plan` | Check one confirmed plan without inventing a second. |

There is no tool that confirms facts or approves findings. The UI review gates
are separate actions. Browser API availability does not prove an agent is signed
in. This is not a travel, employment, eligibility, or immigration decision tool.

## Verification

- 188 tests passed across 13 files: 134 existing tests plus 54 new tests.
- TypeScript and the separate preparation bundle build passed.
- All four operations were called through native WebMCP in the in-app browser.
- An agent proposal opened the visible facts panel. Calculation before review
  returned `review_required` with no result.
- In an explicitly fictional UI test, the first review gate was exercised and
  the native comparison returned distinct `transition_ds` and
  `fixed_period_reentry` results. This was a test action, not a real student's
  attestation or an actual immigration determination.
- The results exactly match the integrated engine's outputs for the fixture.
  The return projection uses the engine's existing `scenarioForFixedReentry`.
- One uncached browser calculation reported 11.3 ms for the deterministic
  calculation work only. Agent, network, rendering, and AI generation time are
  excluded; this is not a full-workflow latency claim.
- Desktop facts/comparison screenshots and mobile layout inspection completed.
  A narrow header discovered at 390px was fixed and visually rechecked.
- The native revision test was initially interrupted by an account usage limit.
  After the participant reported resetting usage, the native test resumed and
  passed: edits revoke both approvals, old revisions are rejected, unknown
  dependent facts block calculation, and fresh confirmation enables a new result.
- Repeated comparison calls reuse the same evidence. A status mismatch found
  during this test was fixed: already-reviewed findings return `reviewed`, not
  `review_required`. This correction passed both a regression test and a real
  native WebMCP call. It does not imply that preparation documents were generated.
- The original fictional January-return plan was restored, then reloaded as an
  unconfirmed draft for the participant's product review.
- The original checkout is clean. The published canonical mapper assets are
  unchanged. No remote push or deployment occurred.

Next product checkpoint: review the draft/confirmation and comparison experience
before connecting the mapper advisement and paired HenryKnows generation.

## Product-Review Revision

The participant found the original tab/sidebar layout confusing: the second plan
was buried, the no-travel baseline looked blank, confirmation was premature, and
internal date labels were unexplained. Passing the initial tests did not establish
usability. That version was not accepted as a completed product checkpoint.

The revised human path is question -> student situation -> Plan A -> explicitly
choose Plan B (or one-plan check) -> review both plans -> results. An agent proposal
opens the readable review directly. Student edits stay on their current step.

- Entry and dialog now share the same "Compare plans" name. The preview no longer
  claims to launch an AI assistant before desktop handoff exists.
- One primary next action replaces the tabs, sticky sidebar, and duplicate compare
  button. Each plan has a visible description, including "No international travel."
- Empty and identical alternatives cannot be confirmed through the UI or calculated
  by the comparison operation. Single-plan checking has its own native tool.
- Conditional questions reduce irrelevant fields; missing calculation inputs appear
  directly in review. Unknown is not no and missing dates remain empty.
- A live blank-case test found native date input events could update the field but
  not the case. Date fields now handle `input` events; entered dates were verified
  in tool results, on the next screen, and after reload.
- Results lead with the actual plans and canonical outcomes. Full findings, changed
  facts, and the explained canonical timeline use progressive disclosure. The
  standalone "Current activity ends," "Modeled latest departure," and "Transition
  filing deadline" metrics were removed. No legal rules were changed.
- The second review names actual remaining adviser-review points before requesting
  acknowledgement. Reviewed results are explicitly session-only until persistence
  and paired generation are implemented.

Reverification: 202 tests in 14 files pass; TypeScript and the isolated preparation
build pass. Native browser tests cover a blank case, incomplete shared dates,
explicit Plan B, pre-confirmation rejection, two-plan and single-plan operations,
empty alternative rejection, retained reviewed status, date editing, stale revision
rejection, missing filing-order recovery, and reload. Desktop (1280x720) and phone
(390x844, 320x720) screenshots and DOM overflow checks were inspected. Temporary
viewport overrides were reset. Testing used `localhost:8028` to keep the participant's
saved `127.0.0.1:8028` case separate.

The same pending integration items above remain. No AI generation, production
changes, publication, or deployment was performed during the UX revision.
