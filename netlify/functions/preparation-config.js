import { judgeDemoEnabled } from "./_shared/preparation-access.js";

export default async (request) => new Response(JSON.stringify({ judgeDemo: judgeDemoEnabled() }), {
  status: request.method === "GET" ? 200 : 405,
  headers: { "content-type": "application/json", "cache-control": "no-store" },
});
