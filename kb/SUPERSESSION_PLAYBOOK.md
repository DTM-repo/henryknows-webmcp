# KB Supersession Playbook — run this whenever a new rule or guidance lands

## Why this exists (the August 2026 lesson)

Henry HAD the duration-of-status final rule in his corpus from day one — as one
156-page document. He still answered OPT-window questions with the old 60-day
rule for three weeks. Root cause: **ingestion appends; it doesn't reconcile.**
The corpus is mostly snapshots (eCFR "current" text, USCIS Policy Manual, form
instructions) that state old law crisply and confidently. BM25 retrieval
returns whatever chunks lexically match the question — and a question about
"OPT filing window 60 days" matches the old rule's crisp sentence far better
than the new rule's dense preamble. Nothing marked the old text as superseded,
so the model saw confident old law next to a wall of new text and often
followed the confident sentence.

Adding a document is therefore NOT the same as updating Henry's knowledge.
Every new authority must be reconciled against what's already there.

## The procedure

When a new rule, policy manual update, or SEVP guidance is ingested:

1. **Ingest the new document** into `kb/corpus/` with proper frontmatter
   (source_url, published, effective dates).
2. **Write the supersessions doc** in `kb/updates/`: a dense, retrieval-friendly
   summary of every change, using the SAME vocabulary a user would query with
   ("60 days", "grace period", "filing window") so it competes on the same
   BM25 queries as the stale text. Make it **date-aware** if there's a gap
   between publication and effective date — state what is law before AND after
   the effective date (see `kb/updates/2026-08-ds-rule-supersessions.md`).
3. **Run the contradiction sweep**: an adversarial agent pass over the whole
   corpus asking "which statements does the new authority make false?" —
   ranked by how badly a student would be misled. (The 2026-08-16 sweep found
   the 60-day OPT window in three separate corpus files.)
4. **Annotate every stale passage inline** with a clearly marked note directly
   under the sentence, e.g.:
   `> **[HENRYKNOWS EDITOR'S NOTE — SUPERSEDED effective <date>]** <correction>. Source: <cite>.`
   Inline placement matters: BM25 returns chunks, so the chunk containing the
   stale sentence then also contains its correction. A header note alone does
   not travel with the chunk.
5. **Update the bench**: fix any `kb/tools/bench-questions.json` golden truths
   the change touches, and ADD a question that specifically tests the change
   (ideally a date-straddling scenario).
6. **Rebuild and push**: `python3 kb/tools/build_index.py` then
   `bash kb/tools/push_index.sh` (live in ~1 minute, no deploy).
7. **Verify end-to-end against live Henry**: ask the questions the change is
   most likely to get wrong — especially deadline questions that straddle the
   effective date — in both Professional and Student modes. Do not skip this;
   it is the only step that tests what users actually experience.

## Standing risks to keep an eye on

- **Snapshots rot silently.** Every `ecfr-*` / `uscis-*` capture has a
  fetched date in its frontmatter. When a capture is superseded in part, its
  header must say so (see the header notes added 2026-08-16).
- **"Current" isn't.** A file titled "as of 2026-07-23" stops being current
  the day anything in it changes. The supersessions doc + inline notes are the
  compensating control until a full re-capture after the effective date.
- **After an effective date passes**, re-capture the amended sources (eCFR
  republishes consolidated text) and retire the interim annotations in favor
  of clean current text. For the DS rule: re-capture 8 CFR 214.2 after
  September 15, 2026.
- **The watcher is still manual.** A Federal Register / SEVP Broadcast watcher
  (open item from the 8/13 list) would turn step 1 from "when David notices"
  into "when it publishes."
