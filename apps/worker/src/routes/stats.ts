import type { Env } from "../lib/registry";

const json = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });

/**
 * A counter is a string in KV, so a missing or damaged value must not become
 * NaN — incrementStat would then persist the string "NaN" and the counter
 * would be permanently poisoned, rendering "NaN" on the landing page.
 */
function counter(value: string | null): number {
  const n = parseInt(value ?? "0", 10);
  return Number.isFinite(n) ? n : 0;
}

export async function handleStats(env: Env): Promise<Response> {
  const kv = env.AGENTS_KV;

  const [permanentAgents, totalTransactions, totalUsdcVolume] = await Promise.all([
    kv.get("stats:permanent_agents"),
    kv.get("stats:total_transactions"),
    kv.get("stats:total_usdc_volume"),
  ]);

  return json({
    permanent_agents: counter(permanentAgents),
    total_transactions: counter(totalTransactions),
    total_usdc_volume: counter(totalUsdcVolume),
  });
}

export async function incrementStat(
  kv: KVNamespace,
  key: "stats:permanent_agents" | "stats:total_transactions" | "stats:total_usdc_volume",
  amount = 1
): Promise<void> {
  const current = await kv.get(key);
  await kv.put(key, (counter(current) + amount).toString());
}
