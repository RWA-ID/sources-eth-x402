import type { Env } from "../lib/registry";
import { searchAgents } from "../lib/registry";

export async function handleSearch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const category = url.searchParams.get("category");
  const limit = parseInt(url.searchParams.get("limit") ?? "20", 10);

  const results = await searchAgents(q, category, env.AGENTS_KV, limit);

  return new Response(JSON.stringify(results), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
