# HenryKnows + WebMCP

HenryKnows is an F-1 compliance reference application for international students and international student advisers. This challenge extension lets a student's browser agent coordinate HenryKnows' broad, primary-source guidance with a deterministic Duration of Status Mapper and retain two preparation PDFs from one student-confirmed case.

**Live judging app:** https://henryknows-webmcp.netlify.app

## Why WebMCP

A personal agent may already understand the student's academic, employment, and travel goals. HenryKnows has specialized F-1 regulatory retrieval and a tested rules engine, but no personal context. WebMCP lets the agent and student work with the same live page while HenryKnows keeps calculations, sources, confirmation, and visible case state under website control.

The agent can:

- propose relevant context the student has already shared;
- collect and revise a bounded, non-identifying case;
- consult HenryKnows repeatedly in student or professional mode;
- screen whether the new duration-of-status rules may apply;
- calculate one plan or compare two plans using deterministic code;
- retain an agent-authored student brief and concise DSO brief together; and
- download both documents as formatted PDFs.

Remembered information is proposed context, not verified fact. Case-specific calculations require the student's direct confirmation. The workflow does not authorize travel or employment, submit an application, or replace a DSO or qualified immigration lawyer.

## Current WebMCP Implementation

The preparation surface registers bounded tools with `document.modelContext.registerTool` in [`calculator/src/preparation/webmcp.ts`](calculator/src/preparation/webmcp.ts). The capability contract in [`calculator/src/preparation/capabilities.ts`](calculator/src/preparation/capabilities.ts) tells the external agent how to coordinate the tools without turning the student into a tool operator.

The shared case is versioned. Material changes invalidate affected calculations and documents, and late work from an older revision cannot silently become current. The student and professional documents are saved atomically and completion is verified with an explicit final read.

The latest implementation and verification record is in [`docs/webmcp/checkpoint-03.md`](docs/webmcp/checkpoint-03.md).

## Existing Product Versus Challenge Work

HenryKnows and the integrated Duration of Status Mapper existed before the WebMCP Challenge. The mapper was originally created for an earlier hackathon and was subsequently updated inside HenryKnows.

The WebMCP Challenge work adds the native site-tool layer, external-agent expeditor contract, versioned shared case, conversational confirmation boundary, cumulative connected interface, mapper/Henry orchestration, iterative consultations, stale-work protection, atomic paired-document retention, audience-specific validation, and client-generated PDF handoffs.

## Run Locally

Requirements:

- Node.js 22+
- Netlify CLI
- An Anthropic API key for live HenryKnows and mapper narratives
- ChatGPT's in-app browser or another browser with WebMCP enabled

Install dependencies:

```sh
npm install
npm --prefix calculator install
```

Set local Netlify environment variables without committing them:

```sh
netlify env:set ANTHROPIC_API_KEY your_key
netlify env:set HENRY_JUDGE_DEMO true
netlify env:set JWT_SECRET a_long_random_value
```

Run the complete site and Netlify Functions:

```sh
netlify dev
```

Open the reported local URL in a supported browser. Select **Use HenryKnows with ChatGPT**, or ask the browser agent to open the page and help with an F-1 planning question.

## Verification

```sh
npm --prefix calculator test -- --run
npm --prefix calculator run build:preparation
```

Current result: 242 tests across 19 files pass. The preparation TypeScript and production build also pass.

## Main Source Areas

- `calculator/src/preparation/`: shared case, tools, orchestration, interface, and PDF export
- `calculator/src/engine/`: deterministic duration-of-status calculation engine
- `calculator/src/impact/`: applicability and issue mapping
- `netlify/functions/`: HenryKnows answers, mapper narratives, and bounded continuation services
- `kb/`: indexed primary-source F-1 materials used by HenryKnows
- `public/`: deployed application

## Privacy And Safety

The challenge demonstration is designed for fictional, non-identifying cases. The preparation tools reject common direct identifiers and raw document payloads. Do not enter names, SEVIS IDs, passport numbers, or real student records.

## License

MIT. See [`LICENSE`](LICENSE).

