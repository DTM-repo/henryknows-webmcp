#!/usr/bin/env python3
"""Build the self-hosted Federal Register rule page.

Fetches (or reads) the full-text HTML of the DHS duration-of-status final rule
(FR Doc 2026-14439, 91 FR 44976) and wraps it in the HenryKnows shell at
public/rules/duration-of-status/index.html, preserving the p-#### paragraph
ids that the Duration Mapper's citations target.

The Federal Register text is a U.S. government work (public domain). The page
links to the official version.

Usage:
  python3 scripts/build-rule-page.py [path-to-saved-full-text.html]
  (with no argument it downloads from federalregister.gov)
"""
import re
import sys
import urllib.request
from pathlib import Path

SOURCE_URL = "https://www.federalregister.gov/documents/full_text/html/2026/07/17/2026-14439.html"
OFFICIAL_URL = "https://www.federalregister.gov/documents/2026/07/17/2026-14439/establishing-a-fixed-time-period-of-admission-and-an-extension-of-stay-procedure-for-nonimmigrant"
OUT = Path(__file__).resolve().parent.parent / "public" / "rules" / "duration-of-status" / "index.html"


def load_source() -> str:
    if len(sys.argv) > 1:
        return Path(sys.argv[1]).read_text(encoding="utf-8")
    with urllib.request.urlopen(SOURCE_URL, timeout=120) as response:
        return response.read().decode("utf-8")


def transform(html: str) -> str:
    # Drop the "Document Headings" explainer box (site chrome, not rule text).
    html = re.sub(
        r'<div class="document-headings">.*?</div>\s*</div>\s*</div>\s*</div>',
        "",
        html,
        count=1,
        flags=re.S,
    )
    # Absolutize relative links so cross-references still resolve.
    html = html.replace('href="/', 'href="https://www.federalregister.gov/')
    html = html.replace('src="/', 'src="https://www.federalregister.gov/')
    return html


SHELL = """<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Full text: DHS final rule ending F-1 duration of status (91 FR 44976) | HenryKnows</title>
    <meta name="description" content="Searchable full text of the DHS final rule replacing F-1 duration of status with fixed-period admission, effective September 15, 2026 (91 FR 44976). Hosted for citation by the HenryKnows Duration Rules Calculator." />
    <link rel="canonical" href="https://henryknows.info/rules/duration-of-status/" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <style>
      body { margin: 0; font-family: Georgia, "Times New Roman", serif; color: #1c1c1c; background: #fbfaf7; }
      .hk-band { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 20px; background: #050505; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 14px; color: rgba(255,255,255,0.82); }
      .hk-band a { color: #fff; text-decoration: none; }
      .hk-band a:hover { text-decoration: underline; }
      .rule-intro { max-width: 760px; margin: 28px auto 8px; padding: 0 20px; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
      .rule-intro h1 { font-size: 1.35rem; line-height: 1.35; }
      .rule-intro p { font-size: 0.95rem; line-height: 1.55; color: #444; }
      .rule-intro .official { font-size: 0.85rem; }
      main.rule-text { max-width: 760px; margin: 0 auto 80px; padding: 0 20px; line-height: 1.6; }
      main.rule-text img { max-width: 100%; height: auto; }
      main.rule-text table { max-width: 100%; overflow-x: auto; display: block; }
      .unprinted-element { display: none; }
      /* The cited paragraph gets an unmissable highlight. */
      .cited-paragraph { background: #fff3bf; outline: 3px solid #f5c518; outline-offset: 6px; border-radius: 2px; transition: background 0.6s ease; }
      .cited-paragraph mark.cited-quote { background: #ffd43b; padding: 0 2px; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
      .cite-note { position: sticky; top: 0; z-index: 5; background: #050505; color: #fff; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; font-size: 13px; padding: 8px 20px; display: none; }
      .cite-note a { color: #ffd43b; }
    </style>
  </head>
  <body>
    <header class="hk-band">
      <span><a href="/"><strong>HenryKnows</strong></a> &middot; compliance answers for international students and the professionals who advise them</span>
      <a href="/new-duration-rules-calculator/">Duration Rules Calculator &rarr;</a>
    </header>
    <div class="cite-note" id="cite-note"></div>
    <div class="rule-intro">
      <h1>Full text: the DHS final rule ending F-1 duration of status</h1>
      <p>
        This is the complete text of &ldquo;Establishing a Fixed Time Period of Admission and an
        Extension of Stay Procedure for Nonimmigrant Academic Students, Exchange Visitors, and
        Representatives of Foreign Information Media,&rdquo; 91 FR 44976 (July 17, 2026), effective
        September 15, 2026. Federal Register text is a work of the United States government.
        Citations from the <a href="/new-duration-rules-calculator/">Duration Rules Calculator</a>
        land on the exact paragraph, highlighted below.
      </p>
      <p class="official">Official version: <a href="__OFFICIAL_URL__" rel="noopener">federalregister.gov</a></p>
    </div>
    <main class="rule-text">
__RULE_BODY__
    </main>
    <script>
      (function () {
        var match = location.hash.match(/^#(p-\\d+)$/);
        if (!match) return;
        var target = document.getElementById(match[1]);
        if (!target) return;
        target.classList.add("cited-paragraph");
        var params = new URLSearchParams(location.search);
        var srcId = params.get("src");
        var done = function () {
          target.scrollIntoView({ block: "center" });
        };
        if (!srcId) return done();
        fetch("/rules/duration-of-status/quotes.json")
          .then(function (r) { return r.ok ? r.json() : null; })
          .then(function (quotes) {
            var quote = quotes && quotes[srcId] && quotes[srcId].quote;
            if (!quote) return;
            // Mark the exact quoted passage inside the paragraph. We control
            // this DOM, so an exact text match is reliable here in a way it
            // never was against federalregister.gov's markup.
            var walker = document.createTreeWalker(target, NodeFilter.SHOW_TEXT, {
              acceptNode: function (candidate) {
                // Skip hidden printed-page markers so quotes can span page breaks.
                for (var el = candidate.parentElement; el && el !== target; el = el.parentElement) {
                  if (el.classList.contains("unprinted-element")) return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
              }
            });
            var nodes = [], text = "", node;
            while ((node = walker.nextNode())) { nodes.push({ node: node, start: text.length }); text += node.nodeValue; }
            var flat = text.replace(/\\s+/g, " ");
            var needle = quote.replace(/\\s+/g, " ");
            var flatIndex = flat.indexOf(needle);
            if (flatIndex < 0) return;
            // Map the flattened index range back onto the raw text offsets.
            var rawStart = -1, rawEnd = -1, flatPos = 0, lastWasSpace = false;
            for (var i = 0; i < text.length; i += 1) {
              var isSpace = /\\s/.test(text[i]);
              if (!(isSpace && lastWasSpace)) {
                if (flatPos === flatIndex && rawStart < 0) rawStart = i;
                flatPos += 1;
                if (flatPos === flatIndex + needle.length) { rawEnd = i + 1; break; }
              }
              lastWasSpace = isSpace;
            }
            if (rawStart < 0 || rawEnd < 0) return;
            var range = document.createRange();
            var findPoint = function (offset, preferEnd) {
              for (var j = nodes.length - 1; j >= 0; j -= 1) {
                var entry = nodes[j];
                var within = offset - entry.start;
                if (within >= 0 && within <= entry.node.nodeValue.length) {
                  if (!preferEnd && within === entry.node.nodeValue.length && j + 1 < nodes.length) continue;
                  return { node: entry.node, offset: within };
                }
              }
              return null;
            };
            var startPoint = findPoint(rawStart, false);
            var endPoint = findPoint(rawEnd, true);
            if (!startPoint || !endPoint) return;
            range.setStart(startPoint.node, startPoint.offset);
            range.setEnd(endPoint.node, endPoint.offset);
            var mark = document.createElement("mark");
            mark.className = "cited-quote";
            try { range.surroundContents(mark); } catch (e) { /* quote spans elements; paragraph highlight still applies */ }
          })
          .catch(function () { /* quotes are progressive enhancement */ })
          .finally(done);
      })();
    </script>
  </body>
</html>
"""


def main() -> None:
    body = transform(load_source())
    page = SHELL.replace("__OFFICIAL_URL__", OFFICIAL_URL).replace("__RULE_BODY__", body)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(page, encoding="utf-8")
    anchors = len(re.findall(r'id="p-\d+"', body))
    print(f"wrote {OUT} ({len(page):,} bytes, {anchors} paragraph anchors)")


if __name__ == "__main__":
    main()
