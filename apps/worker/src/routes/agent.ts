import type { Env } from "../lib/registry";
import { getAgent } from "../lib/registry";

export async function handleGetAgent(ens: string, env: Env): Promise<Response> {
  const agent = await getAgent(ens, env.AGENTS_KV);

  if (!agent) {
    // Check if it exists but is expired
    const reg = await env.AGENTS_KV.get(`registrations:${ens}`, "json") as { status?: string } | null;
    if (reg?.status === "trial_expired") {
      return new Response(
        JSON.stringify({ error: "trial_expired", ens }),
        {
          status: 402,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
          },
        }
      );
    }
    return new Response(JSON.stringify({ error: "not_found" }), {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  return new Response(JSON.stringify(agent), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
