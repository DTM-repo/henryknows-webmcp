import { describe, expect, it } from "vitest";
import { readHenryStream } from "./services";

function stream(items: unknown[], split = false) {
  const encoded = new TextEncoder().encode(items.map((item) => `data: ${JSON.stringify(item)}\n\n`).join(""));
  return new Response(new ReadableStream({ start(controller) {
    if (split) for (const byte of encoded) controller.enqueue(new Uint8Array([byte]));
    else controller.enqueue(encoded);
    controller.close();
  } }), { headers: { "content-type": "text/event-stream" } });
}
describe("existing Henry streaming protocol", () => {
  it("assembles split chunks and preserves source metadata", async () => {
    const response = await readHenryStream(stream([{ t: "delta", text: "Fictional answer." }, { t: "done", stopReason: "end_turn", sources: [{ id: "1", title: "Primary source", url: "https://www.uscis.gov/" }] }], true));
    expect(response.text).toBe("Fictional answer."); expect(response.sources).toHaveLength(1);
  });
  it("rejects partial streams, refusals, errors and empty completions", async () => {
    for (const events of [[{ t: "delta", text: "partial" }], [{ t: "error" }], [{ t: "done" }], [{ t: "delta", text: "limited" }, { t: "done", stopReason: "max_tokens" }]]) await expect(readHenryStream(stream(events))).rejects.toThrow();
  });
  it("does not treat access-gated responses or static HTML as answers", async () => {
    await expect(readHenryStream(Response.json({ gated: true }))).rejects.toThrow("access");
    await expect(readHenryStream(new Response("<html>not a function</html>"))).rejects.toThrow("backend");
  });
  it("does not return unsafe source URLs", async () => {
    expect((await readHenryStream(stream([{ t: "delta", text: "Answer" }, { t: "done", sources: [{ title: "Bad link", url: "javascript:alert(1)" }] }]))).sources).toEqual([]);
  });
});
