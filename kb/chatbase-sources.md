# Henry — Chatbase KB source manifest

Captured 2026-07-24 by Claude via browser automation of the Chatbase dashboard
(agent `T2mtPNQalwDV9JqEtVZnM` "Henry: - copy", workspace david-maxons-workspace).
Dashboard totals at capture time: **5 Files (2 MB) + 586 Links (19 MB) = 21 MB / 40 MB.**
"586 Links" counts crawled sub-pages; the actual configured link sources number 43
(one of them, Cornell USC Title 8, contributes 545 sub-pages). Text snippets, Q&A,
and Notion tabs: **empty**.

## Deduplicated crawl list (unique roots, utm params stripped)

### Regulations (eCFR)
- https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/subpart-A/section-214.2
- https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/subpart-A/section-214.3
- https://www.ecfr.gov/current/title-8/chapter-I/subchapter-B/part-214/subpart-A/section-214.4
- https://www.ecfr.gov/current/title-8/section-103.2
- https://www.ecfr.gov/current/title-20/section-656.3
- https://www.ecfr.gov/current/title-20/section-656.10
- https://www.ecfr.gov/current/title-20/section-656.17
- https://www.ecfr.gov/current/title-20/section-656.24
- https://www.ecfr.gov/current/title-20/chapter-V/part-656/subpart-C/section-656.24  (same reg as previous, alternate path form — keep one)
- https://www.ecfr.gov/current/title-20/section-656.26
- https://www.ecfr.gov/current/title-22/part-62
- https://www.ecfr.gov/current/title-22/chapter-I/subchapter-G/part-62  (same reg as previous, alternate path form — keep one)

### Statute
- https://www.law.cornell.edu/uscode/text/8/  ← the big one: 545 included sub-pages (all of 8 U.S.C.)

### DHS / SEVP / ICE
- https://studyinthestates.dhs.gov/sevis-help-hub
- https://studyinthestates.dhs.gov/sevis-help-hub/sevis-help-hub-user-guide
- https://studyinthestates.dhs.gov/sevis-help-hub/site-map
- https://studyinthestates.dhs.gov/schools/additional-resources/sevp-external-training-application
- https://www.ice.gov/sevis/schools

### USCIS
- https://www.uscis.gov/policy-manual
- https://www.uscis.gov/book/export/html/68600

### DOS / J-1
- https://j1visa.state.gov/
- https://j1visa.state.gov/sponsors/common-questions/
- https://j1visa.state.gov/sponsors/current/regulations-compliance/
- https://j1visa.state.gov/sponsors/current/ro-aro-virtual-training/
- https://j1visa.state.gov/sponsors/current/sevis/sevis-training-videos/
- https://j1visa.state.gov/participants/current/adjustments-and-extensions/
- https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/global-visa-wait-times.html  (⚠ display-truncated at "…global-visa-wait-time"; completion inferred — verify on fetch)

### DOL
- https://flag.dol.gov/processingtimes
- https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/ETA-9089%20Final%20Determination%20-Compliant.pdf  (⚠ ".pdf" inferred from truncation; source shows **Failed** in Chatbase — never scraped, so nothing to reproduce; decide keep/drop)

### Other
- https://www.nafsa.org/rss-feed.xml?feed=am_news  (2 included links; appears 3× in dashboard — dedupe to 1)
- https://www.federalregister.gov/d/2025-00582

## Files (5) — uploaded documents, no URL; locate originals locally/OneDrive
- New D:S rule.pdf
- SEVIS Help Links.docx
- Temporary-User_6.82.1.pdf   (SEVIS RTI user manual, v6.82.1)
- RO_AROvol1_6.82.1.pdf       (SEVIS RO/ARO manual vol 1)
- RO_AROvol2_6.82.1.pdf       (SEVIS RO/ARO manual vol 2)

## Gaps to ADD (from NAFSA-resources doc diff, 7/24 — never in Chatbase)
- https://www.ice.gov/sevis/stem-opt  (STEM OPT hub)
- https://studyinthestates.dhs.gov/sevp-portal-help  (SEVP Portal help)
- USCIS form instructions: I-765, I-539, I-20-related (fetch official instruction PDFs)
- SEVP policy guidance/announcements (incl. Sept 2023 electronic I-983 submission)
- ICE FAQ pages for F-1/J-1/OPT/STEM
- https://www.federalregister.gov/citation/79-FR-60293  (2014 J subpart A final rule)
- SEVP DSO training course text (nafsa.org/professional-resources/browse-by-interest/sevp-training-dsos-course-text)
- https://www.census.gov/naics/  (NAICS codes — I-983 employer classification)
- I-901 fee sources (ice.gov/sevis/i901 + fmjfee.com) — closes the audit's fee gap
- Re-fetch the failed ETA-9089 PDF

## Fetch outcomes (7/24 corpus build — kb/corpus/, 31 docs, ~23 MB)
- ✅ 30 sources fetched (eCFR API as-of 2026-07-23; official USC Title 8 XML;
  USCIS Policy Manual full book export; both FR rules incl. 2026-14439 D/S final rule;
  I-765/I-539 instruction PDFs; STEM OPT hub at studyinthestates.dhs.gov/stem-opt-hub —
  the ice.gov/sevis/stem-opt URL is wrong; NAICS + it needed a real browser).
- 🪦 SETA page: DEAD — SEVP sunsetted SETA Sept 2023 for redesign; Henry's KB was
  carrying a dead link. Dropped; DSO training text captured via nafsa.org course-text page.
- 🔄 travel.state.gov visa wait times: live dataset, not corpus material — link out or
  feed from visa-wait-dash pipeline instead of ingesting a snapshot.
- ⏭ ETA-9089 sample PDF: 403 even in-browser context; also failed in Chatbase forever —
  Context.dev candidate or drop (marginal for DSO scope).
- Still to source: SEVIS RTI/RO-ARO manual PDFs (have them as Chatbase uploads; find
  official ICE/SITS download URLs), ICE F-1/OPT FAQ pages, SEVP policy announcements.

## Crawl notes
- Duplicates in the dashboard (nafsa ×3, several ecfr utm_source=chatgpt variants) are
  collapsed above; raw dashboard rows = 43.
- law.cornell.edu aggressively rate-limits scrapers. For the 8 U.S.C. corpus consider
  crawling the official source instead (uscode.house.gov) or throttling hard.
- The `?utm_source=chatgpt` variants suggest some sources were added by pasting URLs
  from ChatGPT answers — content identical to canonical URLs.
- eCFR pages are also available as structured XML via the eCFR API (ecfr.gov/api) —
  cleaner than HTML scraping if we want exact reg text.
