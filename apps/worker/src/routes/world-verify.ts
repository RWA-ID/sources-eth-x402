import type { Env } from "../lib/registry";
import { lookupAgentBook } from "../lib/agentbook";

export async function handleWorldVerify(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const address = url.searchParams.get("address");

  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return json({ error: "address param required (must be a valid 0x Ethereum address)" }, 400);
  }

  const result = await lookupAgentBook(address, env.BASE_RPC_URL);

  return json({ address, verified: result.verified, humanId: result.humanId ?? null });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
