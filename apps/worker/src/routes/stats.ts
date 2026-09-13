import type { Env } from "../lib/registry";

const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });

export async function handleStats(env: Env): Promise<Response> {
  const kv = env.AGENTS_KV;

  const [permanentAgents, totalTransactions, totalUsdcVolume] = await Promise.all([
    kv.get("stats:permanent_agents"),
    kv.get("stats:total_transactions"),
    kv.get("stats:total_usdc_volume"),
  ]);

  return json({
    permanent_agents: parseInt(permanentAgents ?? "0", 10),
    total_transactions: parseInt(totalTransactions ?? "0", 10),
    total_usdc_volume: parseInt(totalUsdcVolume ?? "0", 10),
  });
}

export async function incrementStat(
  kv: KVNamespace,
  key: "stats:permanent_agents" | "stats:total_transactions" | "stats:total_usdc_volume",
  amount = 1
): Promise<void> {
  const current = await kv.get(key);
  await kv.put(key, (parseInt(current ?? "0", 10) + amount).toString());
}
