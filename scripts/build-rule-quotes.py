#!/usr/bin/env python3
"""Generate public/rules/duration-of-status/quotes.json from the calculator's
source index so the hosted rule page can mark the exact quoted passage.

Run after any edit to calculator/src/sources/sourceIndex.ts.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "calculator" / "src" / "sources" / "sourceIndex.ts"
OUT = ROOT / "public" / "rules" / "duration-of-status" / "quotes.json"


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    quotes: dict[str, dict[str, str]] = {}
    for match in re.finditer(
        r'"([A-Z0-9-]+)": \{(.*?)\n  \}', text, flags=re.S
    ):
        source_id, body = match.group(1), match.group(2)
        anchor = re.search(r'url: ruleParagraph\("[^"]+", (\d+)\)', body)
        quote = re.search(r'quote:\s*"((?:[^"\\]|\\.)*)"', body)
        if anchor and quote:
            full = json.loads(f'"{quote.group(1)}"')
            # Elided quotes ("…") can't exact-match the page text; mark the
            # longest verbatim segment instead. The in-app citation sheet
            # still shows the full quote.
            segments = [s.strip() for s in re.split(r"…|\.\.\.", full) if s.strip()]
            markable = max(segments, key=len) if segments else full
            quotes[source_id] = {
                "anchor": f"p-{anchor.group(1)}",
                "quote": markable,
            }
    OUT.write_text(json.dumps(quotes, indent=1), encoding="utf-8")
    print(f"wrote {OUT} ({len(quotes)} quotes)")


if __name__ == "__main__":
    main()
