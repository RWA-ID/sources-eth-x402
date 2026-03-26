import type { AgentManifest, Registration } from "@sources-eth/agent-manifest";

export interface Env {
  AGENTS_KV: KVNamespace;
  PINATA_JWT: string;
  BASE_RPC_URL: string;
  ETH_RPC_URL: string;
  X402_FACILITATOR_URL: string;
  PLATFORM_TREASURY_ADDRESS: string;
  TRIAL_FEE_USDC: string;
  UPGRADE_FEE_USDC: string;
  FULL_FEE_USDC: string;
  TRIAL_DURATION_DAYS: string;
  ADMIN_SECRET: string;
}

export async function getAgent(ens: string, kv: KVNamespace): Promise<AgentManifest | null> {
  const reg = await kv.get<Registration>(`registrations:${ens}`, "json");
  if (!reg) return null;

  // Auto-expire trials on read
  if (reg.status === "trial" && Date.now() > reg.trial_expires_at) {
    await kv.put(
      `registrations:${ens}`,
      JSON.stringify({ ...reg, status: "trial_expired" })
    );
    return null;
  }

  if (reg.status === "trial_expired") return null;

  return kv.get<AgentManifest>(`agents:${ens}`, "json");
}

export async function listAgents(
  kv: KVNamespace,
  category?: string
): Promise<AgentManifest[]> {
  const listKey = category ? `agents:list:${category}` : "agents:list:all";
  const ensList = await kv.get<string[]>(listKey, "json");
  if (!ensList || ensList.length === 0) return [];

  const results = await Promise.all(ensList.map((ens) => getAgent(ens, kv)));
  return results.filter((a): a is AgentManifest => a !== null);
}

export async function storeAgent(
  manifest: AgentManifest,
  reg: Registration,
  kv: KVNamespace
): Promise<void> {
  await kv.put(`agents:${manifest.ens}`, JSON.stringify(manifest));
  await kv.put(`registrations:${manifest.ens}`, JSON.stringify(reg));

  // Update category list
  const catKey = `agents:list:${manifest.category}`;
  const catList = (await kv.get<string[]>(catKey, "json")) ?? [];
  if (!catList.includes(manifest.ens)) {
    catList.push(manifest.ens);
    await kv.put(catKey, JSON.stringify(catList));
  }

  // Update all list
  const allList = (await kv.get<string[]>("agents:list:all", "json")) ?? [];
  if (!allList.includes(manifest.ens)) {
    allList.push(manifest.ens);
    await kv.put("agents:list:all", JSON.stringify(allList));
  }

  // Update tag index
  for (const tag of manifest.tags) {
    const tagKey = `tags:${tag.toLowerCase()}`;
    const tagList = (await kv.get<string[]>(tagKey, "json")) ?? [];
    if (!tagList.includes(manifest.ens)) {
      tagList.push(manifest.ens);
      await kv.put(tagKey, JSON.stringify(tagList));
    }
  }
}

export async function searchAgents(
  q: string,
  category: string | null,
  kv: KVNamespace,
  limit = 20
): Promise<AgentManifest[]> {
  const all = await listAgents(kv, category || undefined);
  if (!q) return all.slice(0, limit);

  const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
  const scored = all
    .map((agent) => {
      let score = 0;
      for (const token of tokens) {
        if (agent.name.toLowerCase().includes(token)) score += 10;
        if (agent.display_name.toLowerCase().includes(token)) score += 10;
        if (agent.description.toLowerCase().includes(token)) score += 5;
        if (agent.tags.some((t) => t.toLowerCase().includes(token))) score += 8;
        if (agent.category.toLowerCase().includes(token)) score += 3;
      }
      return { agent, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit).map(({ agent }) => agent);
}
