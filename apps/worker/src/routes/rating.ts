import type { AgentRating } from "@sources-eth/agent-manifest";
import type { Env } from "../lib/registry";

export async function handleRate(request: Request, env: Env): Promise<Response> {
  const { ens, rating } = await request.json() as { ens: string; rating: number };

  if (!ens || typeof rating !== "number" || rating < 1 || rating > 5) {
    return new Response(JSON.stringify({ error: "ens and rating (1-5) are required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const key = `ratings:${ens}`;
  const existing = (await env.AGENTS_KV.get<AgentRating>(key, "json")) ?? {
    ens,
    total: 0,
    count: 0,
    avg: 0,
  };

  const updated: AgentRating = {
    ens,
    total: existing.total + rating,
    count: existing.count + 1,
    avg: Math.round(((existing.total + rating) / (existing.count + 1)) * 10) / 10,
  };

  await env.AGENTS_KV.put(key, JSON.stringify(updated));

  return new Response(JSON.stringify(updated), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

export async function handleGetRating(ens: string, env: Env): Promise<Response> {
  const rating = await env.AGENTS_KV.get<AgentRating>(`ratings:${ens}`, "json");

  return new Response(
    JSON.stringify(rating ?? { ens, total: 0, count: 0, avg: 0 }),
    {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    }
  );
}
