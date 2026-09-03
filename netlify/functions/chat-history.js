import { json, emailFromAuth } from "./_shared/lib.js";
import {
  deleteConversation,
  getConversation,
  isSafeConversationId,
  listConversations,
} from "./_shared/history.js";

export default async (req) => {
  const email = emailFromAuth(req);
  if (!email) return json({ error: "Please sign in to view chat history." }, 401);

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  try {
    if (req.method === "GET") {
      if (!id) return json({ chats: await listConversations(email) });
      if (!isSafeConversationId(id)) return json({ error: "Invalid chat id" }, 400);
      const chat = await getConversation(email, id);
      if (!chat) return json({ error: "Chat not found" }, 404);
      return json({ chat });
    }

    if (req.method === "DELETE") {
      if (!isSafeConversationId(id)) return json({ error: "Invalid chat id" }, 400);
      await deleteConversation(email, id);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch {
    return json({ error: "History request failed" }, 500);
  }
};
