import { getStore } from "@netlify/blobs";
import { createHash, randomUUID } from "crypto";

const MAX_ITEMS = 200;
const MAX_TITLE_CHARS = 120;
const MAX_QUESTION_CHARS = 2000;
const MAX_ANSWER_CHARS = 12000;
const MAX_TAGS = 10;
const MAX_TAG_CHARS = 24;

function store() {
  return getStore({ name: "saved-answers", consistency: "strong" });
}

export function createSavedId() {
  return `sa_${randomUUID()}`;
}

export function isSafeSavedId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9._-]{1,128}$/.test(id);
}

function ownerKey(email) {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 40);
}

function savedKey(email, id) {
  if (!isSafeSavedId(id)) throw new Error("Invalid saved answer id");
  return `${ownerKey(email)}/${id}.json`;
}

export function normalizeTags(tags) {
  return (Array.isArray(tags) ? tags : [])
    .map((t) => String(t).toLowerCase().replace(/\s+/g, " ").trim().slice(0, MAX_TAG_CHARS))
    .filter(Boolean)
    .filter((t, i, arr) => arr.indexOf(t) === i)
    .slice(0, MAX_TAGS);
}

function titleFrom(title, question) {
  const t = String(title || question || "").replace(/\s+/g, " ").trim();
  if (!t) return "Saved answer";
  return t.length > MAX_TITLE_CHARS ? `${t.slice(0, MAX_TITLE_CHARS - 3)}...` : t;
}

export async function saveAnswer(email, { question, answer, title, tags }) {
  const a = typeof answer === "string" ? answer.trim() : "";
  if (!a) return null;

  const item = {
    id: createSavedId(),
    title: titleFrom(title, question),
    question: String(question || "").slice(0, MAX_QUESTION_CHARS),
    answer: a.slice(0, MAX_ANSWER_CHARS),
    tags: normalizeTags(tags),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await store().setJSON(savedKey(email, item.id), item);
  return item;
}

export async function listSaved(email) {
  const s = store();
  const prefix = `${ownerKey(email)}/`;
  const { blobs } = await s.list({ prefix });
  const items = [];

  await Promise.all(
    blobs.map(async (blob) => {
      const item = await s.get(blob.key, { type: "json" }).catch(() => null);
      if (item) items.push(item);
    })
  );

  return items.sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ITEMS);
}

export async function updateSaved(email, id, { title, tags }) {
  const key = savedKey(email, id);
  const item = await store().get(key, { type: "json" }).catch(() => null);
  if (!item) return null;

  if (title !== undefined) item.title = titleFrom(title, item.question);
  if (tags !== undefined) item.tags = normalizeTags(tags);
  item.updatedAt = Date.now();

  await store().setJSON(key, item);
  return item;
}

export async function deleteSaved(email, id) {
  await store().delete(savedKey(email, id));
}
