#!/usr/bin/env python3
"""Build Henry's retrieval index from kb/corpus/ + kb/updates/.

Output: kb/index/index.json.gz — chunk texts + BM25 inverted index, consumed by
netlify/functions/_shared/retrieval.js (prod reads the same artifact from
Netlify Blobs; push with kb/tools/push_index.sh).

Usage: python3 kb/tools/build_index.py
"""

import gzip
import json
import re
import sys
from datetime import date
from pathlib import Path

KB = Path(__file__).resolve().parent.parent
OUT_DIR = KB / "index"
SOURCES = [KB / "corpus", KB / "updates"]

TARGET_WORDS = 1100  # ~1500 tokens per chunk
MIN_WORDS = 120      # merge blocks smaller than this into neighbors

# Excluded from the index (still kept in the repo). nafsa-am-rss is secondary
# commentary — Henry cites primary sources only, and including it led to a
# NAFSA citation in an answer during the 2026-08-14 A/B bench.
EXCLUDE_SLUGS = {"nafsa-am-rss"}

STOPWORDS = set(
    (
        "a an and are as at be but by for from has have if in into is it its "
        "of on or that the this to was were will with your you not can may "
        "must shall"
    ).split()
)

# Boilerplate nav lines that survived HTML->md conversion; matching lines drop.
NAV_RE = re.compile(
    r"^\s*(skip to (main )?content|print manual|share this page|breadcrumb|"
    r"main navigation|search|menu|home)\s*$",
    re.IGNORECASE,
)


def parse_front_matter(text):
    meta = {}
    body = text
    if text.startswith("---"):
        end = text.find("\n---", 3)
        if end != -1:
            for line in text[3:end].strip().splitlines():
                if ":" in line:
                    k, v = line.split(":", 1)
                    meta[k.strip()] = v.strip()
            body = text[end + 4 :]
    return meta, body


def clean(body):
    lines = [ln.rstrip() for ln in body.splitlines() if not NAV_RE.match(ln)]
    text = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def split_blocks(body):
    """Split on markdown headings; yield (heading_path, text) blocks."""
    blocks = []
    heading = ""
    buf = []
    for line in body.splitlines():
        m = re.match(r"^(#{1,4})\s+(.*)", line)
        if m:
            if buf:
                blocks.append((heading, "\n".join(buf).strip()))
                buf = []
            heading = m.group(2).strip()
        else:
            buf.append(line)
    if buf:
        blocks.append((heading, "\n".join(buf).strip()))
    return [(h, t) for h, t in blocks if t]


def pack_chunks(blocks):
    """Pack heading blocks into chunks near TARGET_WORDS, splitting big ones
    on paragraph boundaries."""
    chunks = []
    cur_head, cur_parts, cur_words = "", [], 0

    def flush():
        nonlocal cur_parts, cur_words, cur_head
        if cur_parts:
            chunks.append((cur_head, "\n\n".join(cur_parts)))
            cur_parts, cur_words = [], 0

    for heading, text in blocks:
        paras = re.split(r"\n\n+", text)
        for para in paras:
            w = len(para.split())
            if cur_words + w > TARGET_WORDS and cur_words >= MIN_WORDS:
                flush()
            if not cur_parts:
                cur_head = heading
            cur_parts.append(para)
            cur_words += w
            if cur_words >= TARGET_WORDS:
                flush()
    flush()
    return chunks


TOKEN_RE = re.compile(r"[a-z0-9]+(?:[.\-][a-z0-9]+)*")


def tokenize(text):
    # keeps citations like "214.2" and "i-20" as single tokens
    return [t for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS]


def main():
    docs, chunks, lengths = [], [], []
    inverted = {}

    files = []
    for src in SOURCES:
        files += sorted(p for p in src.glob("*.md"))

    for path in files:
        if path.stem in EXCLUDE_SLUGS:
            continue
        meta, body = parse_front_matter(path.read_text(errors="replace"))
        body = clean(body)
        if not body:
            continue
        doc_id = len(docs)
        docs.append(
            {
                "slug": path.stem,
                "title": meta.get("title", path.stem),
                "url": meta.get("source_url", ""),
                "fetched": meta.get("fetched", ""),
                "kind": path.parent.name,  # corpus | updates
            }
        )
        for heading, text in pack_chunks(split_blocks(body)):
            cid = len(chunks)
            chunks.append({"d": doc_id, "h": heading, "t": text})
            toks = tokenize((heading + " " + text) if heading else text)
            lengths.append(len(toks))
            tf = {}
            for t in toks:
                tf[t] = tf.get(t, 0) + 1
            for t, n in tf.items():
                inverted.setdefault(t, []).append([cid, n])

    if not chunks:
        sys.exit("no chunks built — check kb/corpus and kb/updates")

    index = {
        "version": 1,
        "built": date.today().isoformat(),
        "k1": 1.2,
        "b": 0.75,
        "N": len(chunks),
        "avgdl": sum(lengths) / len(lengths),
        "docs": docs,
        "chunks": chunks,
        "len": lengths,
        "idx": inverted,
    }

    OUT_DIR.mkdir(exist_ok=True)
    out = OUT_DIR / "index.json.gz"
    raw = json.dumps(index, separators=(",", ":")).encode()
    with gzip.open(out, "wb", compresslevel=9) as f:
        f.write(raw)

    print(f"docs: {len(docs)}  chunks: {len(chunks)}  terms: {len(inverted)}")
    print(f"raw: {len(raw)/1e6:.1f} MB  gz: {out.stat().st_size/1e6:.1f} MB -> {out}")


if __name__ == "__main__":
    main()
