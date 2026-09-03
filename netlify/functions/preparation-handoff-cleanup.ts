import { getStore } from "@netlify/blobs";

export default async () => {
  const store = getStore({ name: "preparation-handoffs", consistency: "strong" });
  const { blobs } = await store.list({ prefix: "transfer/" });
  for (const blob of blobs) {
    const record = await store.get(blob.key, { type: "json" }) as { expiresAt: number } | null;
    if (record && record.expiresAt <= Date.now()) await store.delete(blob.key);
  }
};
export const config = { schedule: "@hourly" };
