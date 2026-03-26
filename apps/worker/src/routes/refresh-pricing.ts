import type { AgentManifest, AgentService } from "@sources-eth/agent-manifest";
import type { Env } from "../lib/registry";

export async function handleRefreshPricing(request: Request, env: Env): Promise<Response> {
  const secret = request.headers.get("X-ADMIN-SECRET");
  if (!secret || secret !== env.ADMIN_SECRET) {
    return json({ error: "Unauthorized" }, 401);
  }

  const { ens } = await request.json() as { ens: string };
  if (!ens) return json({ error: "ens required" }, 400);

  const manifest = await env.AGENTS_KV.get<AgentManifest>(`agents:${ens}`, "json");
  if (!manifest) return json({ error: "Agent not found" }, 404);

  const base = manifest.endpoint.replace(/\/$/, "");
  let pricingData: Record<string, unknown>;
  try {
    const res = await fetch(`${base}/pricing`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return json({ error: `Pricing endpoint returned ${res.status}` }, 422);
    pricingData = await res.json() as Record<string, unknown>;
  } catch {
    return json({ error: "Could not reach pricing endpoint" }, 422);
  }

  // Enrich each service with price_usd from the live pricing response
  const enriched: AgentService[] = (manifest.services ?? []).map((svc) => {
    if (svc.price_usd !== undefined) return svc; // already priced
    const priceUsd = findServicePrice(pricingData, svc.name);
    return priceUsd !== undefined ? { ...svc, price_usd: priceUsd } : svc;
  });

  const updated: AgentManifest = { ...manifest, services: enriched };
  await env.AGENTS_KV.put(`agents:${ens}`, JSON.stringify(updated));

  return json({ success: true, ens, services: enriched });
}

function findServicePrice(pricing: Record<string, unknown>, svcName: string): number | undefined {
  const normalized = svcName.toLowerCase().replace(/-/g, "_");
  // Words to match against: full name + each word segment (min 3 chars)
  const words = [normalized, ...normalized.split("_").filter((w) => w.length >= 3)];

  for (const [key, val] of Object.entries(pricing)) {
    const k = key.toLowerCase();
    // Skip micro-unit fields and non-price metadata
    if (k.includes("micro") || k.includes("chain") || k.includes("network") || k.includes("asset") || k.includes("endpoint") || k.includes("pay_to")) continue;

    const matches = words.some((w) => k.includes(w));
    if (!matches) continue;

    // Direct numeric USD value (assume values < 100 are in USD, not micro)
    if (typeof val === "number" && val > 0 && val < 100) return val;

    // Object with explicit price field
    if (val && typeof val === "object") {
      const e = val as Record<string, unknown>;
      const p = e.usd ?? e.price ?? e.amount;
      if (typeof p === "number" && p > 0) return p;
    }
  }
  return undefined;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
