import { json, emailFromAuth, isPaid } from "./_shared/lib.js";
import {
  deleteSaved,
  isSafeSavedId,
  listSaved,
  saveAnswer,
  updateSaved,
} from "./_shared/saved.js";

// Saved answers are a Henry Basic (paid) feature — kept indefinitely, unlike
// the 7-day chat history.
export default async (req) => {
  const email = emailFromAuth(req);
  if (!email) return json({ error: "Please sign in to use saved answers." }, 401);

  if (!(await isPaid(email))) {
    return json(
      { error: "Saved answers are part of Henry Basic.", upgradeRequired: true },
      403
    );
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  try {
    if (req.method === "GET") {
      return json({ items: await listSaved(email) });
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const item = await saveAnswer(email, body);
      if (!item) return json({ error: "Nothing to save" }, 400);
      return json({ item });
    }

    if (req.method === "PUT") {
      const body = await req.json().catch(() => ({}));
      const targetId = body.id || id;
      if (!isSafeSavedId(targetId)) return json({ error: "Invalid saved answer id" }, 400);
      const item = await updateSaved(email, targetId, body);
      if (!item) return json({ error: "Saved answer not found" }, 404);
      return json({ item });
    }

    if (req.method === "DELETE") {
      if (!isSafeSavedId(id)) return json({ error: "Invalid saved answer id" }, 400);
      await deleteSaved(email, id);
      return json({ ok: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch {
    return json({ error: "Saved answers request failed" }, 500);
  }
};
