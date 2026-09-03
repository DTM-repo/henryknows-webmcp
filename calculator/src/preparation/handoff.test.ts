import { describe, expect, it, vi } from "vitest";
import { createCase, FICTIONAL_EXAMPLE, reviseCase, serializeCase, restoreCase, confirmCase } from "./case";
import { assistantPrompt, createHandoff, desktopLink } from "./handoff";
import { handoffHandler, HANDOFF_TTL_MS } from "../../../netlify/functions/preparation-handoff";

describe("consented desktop continuation", () => {
  it("uses the documented composer link without treating originUrl as a website", () => {
    const url = new URL(desktopLink("Open https://example.com/"));
    expect(url.protocol).toBe("codex:"); expect(url.searchParams.get("prompt")).toBe("Open https://example.com/");
    expect(url.searchParams.has("originUrl")).toBe(false);
  });
  it("tells the assistant to avoid the observed permission and narration loops", () => {
    const prompt = assistantPrompt("https://example.com/#assist=start");
    expect(prompt).toContain("without asking permission or repeating it");
    expect(prompt).toContain("keep the HenryKnows page visible");
    expect(prompt).toContain("Speak directly to me as \"you.\"");
    expect(prompt).toContain("What would you like to figure out?");
    expect(prompt).toContain("help me choose one");
    expect(prompt).toContain("Reuse this page and tool connection throughout");
    expect(prompt).toContain("Handle tool validation, retries");
    expect(prompt).toContain("do not write a second timeline section");
    expect(prompt).toContain("routine professional instruction of every kind");
    expect(prompt).toContain("completion.status as \"ready\"");
    expect(prompt).not.toContain("switch to ChatGPT Work");
  });
  it("starts empty without storing anything and never puts facts in the launch URL", async () => {
    const fetcher = vi.fn();
    const empty = await createHandoff(createCase(), "https://example.com/?private=old#old", fetcher);
    expect(fetcher).not.toHaveBeenCalled(); expect(empty.url).toBe("https://example.com/#assist=start");
    fetcher.mockResolvedValue(Response.json({ token: "a".repeat(64), expiresAt: Date.now() + 10000 }));
    const c = reviseCase(createCase(), { expectedRevision: 1, ...FICTIONAL_EXAMPLE });
    const link = await createHandoff(c, "https://example.com/", fetcher);
    expect(link.desktopUrl).not.toContain("2027-05-15"); expect(link.url).toBe(`https://example.com/#assist=${"a".repeat(64)}`);
  });
  it("validates transfers, strips confirmation, expires links, and rejects cross-origin writes", async () => {
    let time = 1000;
    const records = new Map<string, unknown>();
    const handler = handoffHandler(() => ({ get: async (key) => records.get(key) ?? null, setJSON: async (key, value) => { records.set(key, value); }, delete: async (key) => { records.delete(key); } }), () => time);
    const request = (body: unknown, origin = "https://example.com") => new Request("https://example.com/.netlify/functions/preparation-handoff", { method: "POST", headers: { origin }, body: JSON.stringify(body) });
    const c = confirmCase(reviseCase(createCase(), { expectedRevision: 1, ...FICTIONAL_EXAMPLE }), 2);
    const result = await handler(request({ action: "create", case: serializeCase(c) }));
    const { token } = await result.json(); expect(token).toMatch(/^[a-f0-9]{64}$/);
    const restored = await (await handler(request({ action: "read", token }))).json();
    expect(restoreCase(restored.case)?.confirmedRevision).toBeNull();
    expect((await handler(request({ action: "read", token }, "https://attacker.example"))).status).toBe(403);
    expect((await handler(request({ action: "create", case: JSON.stringify({ ...c, confirmedRevision: 2 }) }))).status).toBe(400);
    time += HANDOFF_TTL_MS + 1;
    expect((await handler(request({ action: "read", token }))).status).toBe(410); expect(records.size).toBe(0);
  });
  it("rejects failed handoffs instead of promising preserved context", async () => {
    const c = reviseCase(createCase(), { expectedRevision: 1, ...FICTIONAL_EXAMPLE });
    await expect(createHandoff(c, "https://example.com/", vi.fn(async () => new Response("offline", { status: 503 })))).rejects.toThrow("Nothing was lost");
  });
});
