#!/usr/bin/env python3
"""Henry KB corpus fetcher — pulls every source in chatbase-sources.md (incl. gap
additions) from official origins into kb/corpus/ as markdown + raw originals.

Run:  python3 fetch_corpus.py            # full run
Idempotent: skips files already fetched today unless --force.
Failures are logged, never fatal — rerun or handle stragglers via Context.dev.
"""
import json, re, sys, time, zipfile, io, hashlib
from datetime import date, timedelta
from pathlib import Path

import requests, html2text

KB = Path(__file__).resolve().parent.parent
CORPUS, RAW = KB / "corpus", KB / "corpus" / "raw"
CORPUS.mkdir(parents=True, exist_ok=True); RAW.mkdir(parents=True, exist_ok=True)
LOG = CORPUS / "fetch_log.json"
FORCE = "--force" in sys.argv

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36"}
H2T = html2text.HTML2Text(); H2T.ignore_images = True; H2T.body_width = 0

results = []

def log(slug, url, status, note=""):
    results.append({"slug": slug, "url": url, "status": status, "note": note})
    print(f"[{status}] {slug} {note}", flush=True)

def get(url, **kw):
    r = requests.get(url, headers=UA, timeout=90, **kw)
    r.raise_for_status()
    return r

def save_md(slug, title, url, text):
    p = CORPUS / f"{slug}.md"
    p.write_text(f"---\nsource_url: {url}\nfetched: {date.today()}\ntitle: {title}\n---\n\n{text}\n")
    return p

def fetch_page(slug, url, title=None):
    if (CORPUS / f"{slug}.md").exists() and not FORCE:
        return log(slug, url, "skip", "exists")
    try:
        r = get(url)
        ct = r.headers.get("content-type", "")
        if "pdf" in ct or url.lower().endswith(".pdf"):
            raw = RAW / f"{slug}.pdf"; raw.write_bytes(r.content)
            from pypdf import PdfReader
            txt = "\n\n".join((pg.extract_text() or "") for pg in PdfReader(io.BytesIO(r.content)).pages)
            save_md(slug, title or slug, url, txt)
            log(slug, url, "ok", f"pdf {len(r.content)//1024}KB")
        elif "xml" in ct or url.endswith(".xml"):
            raw = RAW / f"{slug}.xml"; raw.write_bytes(r.content)
            save_md(slug, title or slug, url, re.sub(r"<[^>]+>", " ", r.text))
            log(slug, url, "ok", "xml")
        else:
            save_md(slug, title or slug, url, H2T.handle(r.text))
            log(slug, url, "ok", f"html {len(r.text)//1024}KB")
    except Exception as e:
        log(slug, url, "FAIL", str(e)[:200])
    time.sleep(1.5)

def fetch_ecfr(slug, title_num, part, section=None):
    """eCFR versioner API — walk back from today to find a served date."""
    if (CORPUS / f"{slug}.md").exists() and not FORCE:
        return log(slug, f"ecfr t{title_num}/{part}/{section}", "skip", "exists")
    for back in range(0, 45):
        d = (date.today() - timedelta(days=back)).isoformat()
        url = f"https://www.ecfr.gov/api/versioner/v1/full/{d}/title-{title_num}.xml?part={part}"
        if section:
            url += f"&section={section}"
        try:
            r = get(url)
            (RAW / f"{slug}.xml").write_bytes(r.content)
            text = re.sub(r"\n{3,}", "\n\n", re.sub(r"<[^>]+>", " ", r.text))
            human = f"https://www.ecfr.gov/current/title-{title_num}/part-{part}" + (f"/section-{section}" if section else "")
            save_md(slug, f"{title_num} CFR {section or 'Part ' + str(part)} (as of {d})", human, text)
            return log(slug, url, "ok", f"as-of {d}")
        except requests.HTTPError as e:
            if e.response is not None and e.response.status_code == 404:
                continue
            return log(slug, url, "FAIL", str(e)[:200])
        except Exception as e:
            return log(slug, url, "FAIL", str(e)[:200])
        finally:
            time.sleep(1.0)
    log(slug, f"ecfr t{title_num}/{part}", "FAIL", "no served date in 45-day walkback")

def fetch_usc_title8():
    slug = "usc-title-8"
    if (RAW / "usc08.xml").exists() and not FORCE:
        return log(slug, "uscode.house.gov", "skip", "exists")
    try:
        idx = get("https://uscode.house.gov/download/download.shtml").text
        m = re.search(r'href="([^"]*xml_usc08@[^"]+\.zip)"', idx)
        if not m:
            return log(slug, "uscode.house.gov", "FAIL", "no usc08 zip link on download page")
        zurl = m.group(1)
        if not zurl.startswith("http"):
            zurl = "https://uscode.house.gov/download/" + zurl.lstrip("/")
        z = get(zurl)
        zf = zipfile.ZipFile(io.BytesIO(z.content))
        for name in zf.namelist():
            if name.endswith(".xml"):
                data = zf.read(name)
                (RAW / "usc08.xml").write_bytes(data)
                text = re.sub(r"\n{3,}", "\n\n", re.sub(r"<[^>]+>", " ", data.decode("utf-8", "ignore")))
                save_md(slug, "8 U.S.C. (official release)", zurl, text)
                return log(slug, zurl, "ok", f"{len(data)//1048576}MB xml")
        log(slug, zurl, "FAIL", "zip had no xml")
    except Exception as e:
        log(slug, "uscode.house.gov", "FAIL", str(e)[:200])

# ---- regulations (eCFR API) ----
fetch_ecfr("ecfr-8-214.2", 8, 214, "214.2")
fetch_ecfr("ecfr-8-214.3", 8, 214, "214.3")
fetch_ecfr("ecfr-8-214.4", 8, 214, "214.4")
fetch_ecfr("ecfr-8-103.2", 8, 103, "103.2")
fetch_ecfr("ecfr-20-656", 20, 656)          # whole PERM part: covers 656.3/.10/.17/.24/.26
fetch_ecfr("ecfr-22-62", 22, 62)            # whole J-1 part

# ---- statute ----
fetch_usc_title8()

# ---- agency pages: existing sources ----
PAGES = [
    ("sits-sevis-help-hub", "https://studyinthestates.dhs.gov/sevis-help-hub"),
    ("sits-help-hub-user-guide", "https://studyinthestates.dhs.gov/sevis-help-hub/sevis-help-hub-user-guide"),
    ("sits-site-map", "https://studyinthestates.dhs.gov/sevis-help-hub/site-map"),
    ("sits-seta", "https://studyinthestates.dhs.gov/schools/additional-resources/sevp-external-training-application"),
    ("ice-sevis-schools", "https://www.ice.gov/sevis/schools"),
    ("uscis-policy-manual-home", "https://www.uscis.gov/policy-manual"),
    ("uscis-book-68600", "https://www.uscis.gov/book/export/html/68600"),
    ("j1visa-home", "https://j1visa.state.gov/"),
    ("j1visa-common-questions", "https://j1visa.state.gov/sponsors/common-questions/"),
    ("j1visa-regs-compliance", "https://j1visa.state.gov/sponsors/current/regulations-compliance/"),
    ("j1visa-ro-aro-training", "https://j1visa.state.gov/sponsors/current/ro-aro-virtual-training/"),
    ("j1visa-sevis-training-videos", "https://j1visa.state.gov/sponsors/current/sevis/sevis-training-videos/"),
    ("j1visa-adjustments-extensions", "https://j1visa.state.gov/participants/current/adjustments-and-extensions/"),
    ("dos-visa-wait-times", "https://travel.state.gov/content/travel/en/us-visas/visa-information-resources/global-visa-wait-times.html"),
    ("dol-flag-processing-times", "https://flag.dol.gov/processingtimes"),
    ("dol-eta9089-determination", "https://www.dol.gov/sites/dolgov/files/ETA/oflc/pdfs/ETA-9089%20Final%20Determination%20-Compliant.pdf"),
    ("nafsa-am-rss", "https://www.nafsa.org/rss-feed.xml?feed=am_news"),
    ("fr-2025-00582", "https://www.federalregister.gov/d/2025-00582"),
]
# ---- gap sources (never in Chatbase) ----
PAGES += [
    ("ice-stem-opt-hub", "https://www.ice.gov/sevis/stem-opt"),
    ("sits-sevp-portal-help", "https://studyinthestates.dhs.gov/sevp-portal-help"),
    ("ice-i901", "https://www.ice.gov/sevis/i901"),
    ("uscis-i765-instructions", "https://www.uscis.gov/sites/default/files/document/forms/i-765instr.pdf"),
    ("uscis-i539-instructions", "https://www.uscis.gov/sites/default/files/document/forms/i-539instr.pdf"),
    ("fr-79-60293-j-subpart-a", "https://www.federalregister.gov/citation/79-FR-60293"),
    ("fr-2026-14439-ds-final-rule", "https://www.federalregister.gov/d/2026-14439"),
    ("nafsa-sevp-dso-training-text", "https://www.nafsa.org/professional-resources/browse-by-interest/sevp-training-dsos-course-text"),
    ("census-naics", "https://www.census.gov/naics/"),
]
for slug, url in PAGES:
    fetch_page(slug, url)

LOG.write_text(json.dumps(results, indent=1))
ok = sum(1 for r in results if r["status"] == "ok")
skip = sum(1 for r in results if r["status"] == "skip")
fail = [r for r in results if r["status"] == "FAIL"]
print(f"\nDONE: {ok} fetched, {skip} skipped, {len(fail)} failed", flush=True)
for r in fail:
    print(f"  FAIL {r['slug']}: {r['note']}", flush=True)
