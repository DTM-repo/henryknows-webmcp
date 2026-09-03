import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ usage: vi.fn(), tier: vi.fn(), save: vi.fn(), bump: vi.fn(), create: vi.fn() }));
vi.mock("../../../netlify/functions/_shared/lib.js", () => ({ json: (body, status = 200) => Response.json(body, { status }), emailFromAuth: () => "fictional-test-account", getUsage: mocks.usage, paidTier: mocks.tier, bumpUsage: mocks.bump, isPaid: vi.fn(), REGISTERED_MONTHLY_LIMIT: 3, STUDENT_MONTHLY_LIMIT: 20 }));
vi.mock("../../../netlify/functions/_shared/history.js", () => ({ createConversationId: () => "test-conversation", isSafeConversationId: () => false, saveConversation: mocks.save }));
vi.mock("../../../netlify/functions/_shared/retrieval.js", () => ({ retrieve: async () => [{ title: "Official reference", url: "https://www.uscis.gov/", text: "Retrieved reference text" }], renderSources: () => "Retrieved reference text" }));
vi.mock("../../../node_modules/@anthropic-ai/sdk/index.mjs", () => ({ default: class { beta = { messages: { create: mocks.create } }; } }));
import handler from "../../../netlify/functions/chat-proxy-v2.js";
import { judgeDemoEnabled } from "../../../netlify/functions/_shared/preparation-access.js";
const req = (body) => new Request("https://example.com/.netlify/functions/chat-proxy-v2", { method: "POST", body: JSON.stringify(body) });
beforeEach(() => {
  vi.clearAllMocks(); delete process.env.HENRY_JUDGE_DEMO;
  mocks.usage.mockResolvedValue(99); mocks.tier.mockResolvedValue(null);
  mocks.create.mockImplementation(async function* () {
    yield { type: "content_block_delta", delta: { type: "text_delta", text: "A fictional completed reference answer." } };
    yield { type: "message_delta", delta: { stop_reason: "end_turn" } };
  });
});
afterEach(() => { delete process.env.HENRY_JUDGE_DEMO; });
describe("deployment-owned judging access", () => {
  it("is disabled by default and cannot be enabled by body fields", async () => {
    expect(judgeDemoEnabled({})).toBe(false); expect(judgeDemoEnabled({ HENRY_JUDGE_DEMO: "1" })).toBe(false);
    const response = await handler(req({ message: "Fictional question", purpose: "preparation", demo: true, judgeDemo: true }));
    expect(await response.json()).toMatchObject({ gated: true }); expect(mocks.create).not.toHaveBeenCalled();
  });
  it("allows both answer modes with server configuration without saving preparation to account history", async () => {
    process.env.HENRY_JUDGE_DEMO = "true";
    for (const mode of ["student", "professional"]) {
      const response = await handler(req({ message: "Fictional question", purpose: "preparation", mode }));
      const body = await response.text(); expect(body).toContain('"t":"done"'); expect(body).toContain("https://www.uscis.gov/");
      expect(body).not.toContain("Retrieved reference text");
    }
    expect(mocks.save).not.toHaveBeenCalled(); expect(mocks.bump).not.toHaveBeenCalled();
  });
  it("retains input and identifier safeguards in demo mode", async () => {
    process.env.HENRY_JUDGE_DEMO = "true";
    expect((await handler(req({ message: "N1234567890" }))).status).toBe(400);
    expect((await handler(req({ message: "x".repeat(16001) }))).status).toBe(400);
    expect((await handler(req({ message: "x".repeat(32001), purpose: "preparation" }))).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });
});
