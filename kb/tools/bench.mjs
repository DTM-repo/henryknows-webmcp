#!/usr/bin/env node
// Blind A/B benchmark: Chatbase Henry vs the owned engine (chat-proxy-v2).
//
// Prereqs: `netlify dev` running on :8888 (with ANTHROPIC_API_KEY in .env),
// CHATBASE_API_KEY + CHATBASE_BOT_ID in .env.
//
// Output: kb/tools/bench-results-<date>.md   — answers labeled Engine A/B,
//         blinded per-question (random which engine is A)
//         kb/tools/bench-key-<date>.json     — the unblinding key (don't read
//         until grading is done)
//
// Usage: node kb/tools/bench.mjs [--only 1,2,3]

import { readFileSync, writeFileSync } from "node:fs";
import { randomInt } from "node:crypto";

const root = new URL("../..", import.meta.url).pathname;
const env = Object.fromEntries(
  readFileSync(`${root}/.env`, "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
);

const questions = JSON.parse(
  readFileSync(`${root}/kb/tools/bench-questions.json`, "utf8")
);
const onlyArg = process.argv.indexOf("--only");
const only =
  onlyArg > -1 ? new Set(process.argv[onlyArg + 1].split(",").map(Number)) : null;

async function askChatbase(q) {
  const r = await fetch("https://www.chatbase.co/api/v1/chat", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.CHATBASE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chatbotId: env.CHATBASE_BOT_ID,
      stream: false,
      temperature: 0,
      messages: [{ role: "user", content: q }],
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok || !data.text) throw new Error(`chatbase ${r.status}`);
  return data.text;
}

import { ask } from "./ask-direct.mjs";

// Direct engine call (no function wrapper) so the dev server's 30s execution
// timeout doesn't clip Fable's thinking; latency is recorded to the key file.
async function askV2(q) {
  const r = await ask(q);
  askV2.lastMs = r.ms;
  return r.text;
}

const date = new Date().toISOString().slice(0, 10);
const results = [];
const key = [];

for (const item of questions) {
  if (only && !only.has(item.id)) continue;
  process.stderr.write(`Q${item.id} ${item.topic} ... `);
  let chatbase, v2;
  const t0 = Date.now();
  try {
    chatbase = await askChatbase(item.q);
  } catch (e) {
    chatbase = `[ERROR: ${e.message}]`;
  }
  const chatbaseMs = Date.now() - t0;
  try {
    v2 = await askV2(item.q);
  } catch (e) {
    v2 = `[ERROR: ${e.message}]`;
  }
  const flip = randomInt(2) === 1; // true => A = v2
  key.push({
    id: item.id,
    A: flip ? "v2" : "chatbase",
    v2Ms: askV2.lastMs || null,
    chatbaseMs,
  });
  results.push(
    `## Q${item.id}: ${item.topic}\n\n**Question:** ${item.q}\n\n` +
      `### Engine A\n\n${flip ? v2 : chatbase}\n\n` +
      `### Engine B\n\n${flip ? chatbase : v2}\n`
  );
  process.stderr.write("done\n");
}

writeFileSync(
  `${root}/kb/tools/bench-results-${date}.md`,
  `# Henry A/B bench — ${date}\n\nEngines blinded per question; key in bench-key-${date}.json.\n\n` +
    results.join("\n---\n\n")
);
writeFileSync(
  `${root}/kb/tools/bench-key-${date}.json`,
  JSON.stringify(key, null, 2)
);
console.log(`wrote bench-results-${date}.md and bench-key-${date}.json`);
