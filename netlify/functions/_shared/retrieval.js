// BM25 retrieval over Henry's knowledge base index.
// The index artifact is built by kb/tools/build_index.py and lives in the
// "kb-index" Netlify Blobs store (key: index.json.gz), pushed from a dev
// machine by kb/tools/push_index.sh — updating knowledge never needs a deploy.
// Local dev falls back to reading kb/index/index.json.gz from the repo.

import { getStore } from "@netlify/blobs";
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";

let INDEX = null; // cached across warm invocations

async function loadIndex() {
  if (INDEX) return INDEX;
  let buf = null;
  try {
    const store = getStore("kb-index");
    const ab = await store.get("index.json.gz", { type: "arrayBuffer" });
    if (ab) buf = Buffer.from(ab);
  } catch {
    // fall through to local file (netlify dev without a seeded blob store)
  }
  if (!buf) buf = readFileSync("kb/index/index.json.gz");
  INDEX = JSON.parse(gunzipSync(buf).toString("utf8"));
  return INDEX;
}

const TOKEN_RE = /[a-z0-9]+(?:[.\-][a-z0-9]+)*/g;
// Mirrors STOPWORDS in build_index.py — keep the two lists in sync.
const STOP = new Set(
  (
    "a an and are as at be but by for from has have if in into is it its " +
    "of on or that the this to was were will with your you not can may " +
    "must shall"
  ).split(" ")
);

export async function retrieve(query, k = 10) {
  const ix = await loadIndex();
  const terms = (query.toLowerCase().match(TOKEN_RE) || []).filter(
    (t) => !STOP.has(t)
  );
  if (!terms.length) return [];

  const { k1, b, N, avgdl, idx, len } = ix;
  const scores = new Map();
  for (const term of new Set(terms)) {
    // hasOwnProperty guard: bare idx[term] would match Object.prototype keys
    // (a query containing "constructor" must not blow up scoring)
    if (!Object.prototype.hasOwnProperty.call(idx, term)) continue;
    const postings = idx[term];
    const df = postings.length;
    const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
    for (const [cid, tf] of postings) {
      const norm = tf + k1 * (1 - b + (b * len[cid]) / avgdl);
      const s = (idf * (tf * (k1 + 1))) / norm;
      scores.set(cid, (scores.get(cid) || 0) + s);
    }
  }

  return [...scores.entries()]
    .sort((x, y) => y[1] - x[1])
    .slice(0, k)
    .map(([cid, score]) => {
      const c = ix.chunks[cid];
      const d = ix.docs[c.d];
      return {
        score,
        heading: c.h,
        text: c.t,
        title: d.title,
        url: d.url,
        fetched: d.fetched,
        kind: d.kind, // "corpus" | "updates"
      };
    });
}

// Renders retrieved chunks as a numbered <sources> block for the prompt,
// capped by character budget so the request stays inside the cost model.
export function renderSources(hits, maxChars = 55000) {
  const parts = [];
  let used = 0;
  let n = 0;
  for (const h of hits) {
    const header = `[${n + 1}] ${h.title}${h.heading ? " — " + h.heading : ""}${
      h.url ? ` (${h.url})` : ""
    }${h.fetched ? ` [retrieved ${h.fetched}]` : ""}`;
    const block = `${header}\n${h.text}\n`;
    if (used + block.length > maxChars && n > 0) break;
    parts.push(block);
    used += block.length;
    n += 1;
  }
  return parts.join("\n");
}
