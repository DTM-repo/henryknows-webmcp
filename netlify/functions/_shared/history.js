import { getStore } from "@netlify/blobs";
import { createHash, randomUUID } from "crypto";

const HISTORY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_STORED_MESSAGES = 80;
const MAX_MESSAGE_CHARS = 12000;

function store() {
  return getStore({ name: "chat-history", consistency: "strong" });
}

export function createConversationId() {
  return `hc_${randomUUID()}`;
}

export function isSafeConversationId(id) {
  return typeof id === "string" && /^[a-zA-Z0-9._-]{1,128}$/.test(id);
}

function ownerKey(email) {
  return createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 40);
}

function historyKey(email, conversationId) {
  if (!isSafeConversationId(conversationId)) throw new Error("Invalid conversation id");
  return `${ownerKey(email)}/${conversationId}.json`;
}

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_STORED_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.slice(0, MAX_MESSAGE_CHARS),
    }));
}

function titleFrom(messages) {
  const firstUser = messages.find((m) => m.role === "user" && m.content.trim());
  if (!firstUser) return "New chat";
  const title = firstUser.content.replace(/\s+/g, " ").trim();
  return title.length > 72 ? `${title.slice(0, 69)}...` : title;
}

function isExpired(chat, now = Date.now()) {
  return !chat?.expiresAt || chat.expiresAt <= now;
}

export async function saveConversation(email, conversationId, messages) {
  const normalized = normalizeMessages(messages);
  if (!normalized.length) return null;

  const now = Date.now();
  const existing =
    (await store().get(historyKey(email, conversationId), { type: "json" }).catch(() => null)) || {};
  const chat = {
    id: conversationId,
    title: existing.title || titleFrom(normalized),
    createdAt: existing.createdAt || now,
    updatedAt: now,
    expiresAt: now + HISTORY_TTL_MS,
    messageCount: normalized.length,
    messages: normalized,
  };

  await store().setJSON(historyKey(email, conversationId), chat);
  return chat;
}

export async function listConversations(email) {
  const s = store();
  const prefix = `${ownerKey(email)}/`;
  const { blobs } = await s.list({ prefix });
  const chats = [];

  await Promise.all(
    blobs.map(async (blob) => {
      const chat = await s.get(blob.key, { type: "json" }).catch(() => null);
      if (!chat || isExpired(chat)) {
        await s.delete(blob.key).catch(() => {});
        return;
      }
      chats.push({
        id: chat.id,
        title: chat.title || "Untitled chat",
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt,
        expiresAt: chat.expiresAt,
        messageCount: chat.messageCount || chat.messages?.length || 0,
      });
    })
  );

  return chats.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 30);
}

export async function getConversation(email, conversationId) {
  const chat = await store().get(historyKey(email, conversationId), { type: "json" });
  if (!chat) return null;
  if (isExpired(chat)) {
    await deleteConversation(email, conversationId);
    return null;
  }
  return chat;
}

export async function deleteConversation(email, conversationId) {
  await store().delete(historyKey(email, conversationId));
}
