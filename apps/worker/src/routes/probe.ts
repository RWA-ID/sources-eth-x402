import type { Env } from "../lib/registry";

export interface ProbeResult {
  payTo: string;
  priceUsd: number;
  chainId: number;
  asset: string;
  services: Array<{ name: string; endpoint: string; priceUsd: number }>;
  healthy: boolean;
}

/** Recursively find the first Ethereum address in any JSON structure */
function findEthAddress(val: unknown): string | null {
  if (typeof val === "string" && /^0x[a-fA-F0-9]{40}$/.test(val)) return val;
  if (val && typeof val === "object") {
    for (const v of Object.values(val)) {
      const found = findEthAddress(v);
      if (found) return found;
    }
  }
  return null;
}

/** Parse chainId from number, "eip155:8453", or "base" */
function parseChainId(data: Record<string, unknown>): number {
  for (const val of Object.values(data)) {
    if (typeof val === "number" && val === 8453) return 8453;
    if (typeof val === "string") {
      const m = val.match(/eip155:(\d+)/);
      if (m) return parseInt(m[1], 10);
    }
  }
  // Check nested chainId / chain_id keys
  if (typeof data.chainId === "number") return data.chainId as number;
  if (typeof data.chain_id === "number") return data.chain_id as number;
  return 8453; // default Base
}

/** Extract service prices from any shape of pricing JSON */
function extractServices(data: Record<string, unknown>): Array<{ name: string; endpoint: string; priceUsd: number }> {
  const skip = new Set(["network", "asset", "payTo", "pay_to", "address", "chainId", "chain_id", "ok"]);

  // Pass 1: collect *_endpoint fields → name → path mapping
  // e.g. upload_endpoint: "/upload" → { upload: "/upload" }
  const endpointMap: Record<string, string> = {};
  for (const [key, val] of Object.entries(data)) {
    if (typeof val === "string" && key.endsWith("_endpoint")) {
      const name = key.replace(/_endpoint$/, "");
      endpointMap[name] = val.replace(/^\//, ""); // strip leading slash
    }
  }

  // Pass 2: collect prices — strip common suffixes to get the canonical name
  const seen = new Set<string>();
  const services: Array<{ name: string; endpoint: string; priceUsd: number }> = [];

  for (const [key, val] of Object.entries(data)) {
    if (skip.has(key)) continue;

    // Strip price suffixes to get canonical name: upload_price_usdc → upload
    const canonical = key
      .replace(/_price_usdc$/, "")
      .replace(/_price_usd$/, "")
      .replace(/_price$/, "")
      .replace(/_usdc$/, "")
      .replace(/_usd$/, "");

    // Skip if this looks like metadata, not a service name
    if (canonical === key && (key.includes("chain") || key.includes("network") || key.includes("endpoint") || key.includes("pay"))) continue;

    // Resolve endpoint path: prefer *_endpoint map, then use canonical name
    const endpointPath = endpointMap[canonical] ?? canonical;

    let priceUsd: number | null = null;

    if (typeof val === "number" && val > 0 && val < 100) {
      priceUsd = val;
    } else if (typeof val === "number" && val >= 100 && key.toLowerCase().includes("micro")) {
      priceUsd = val / 1_000_000;
    } else if (val && typeof val === "object" && !Array.isArray(val)) {
      const v = val as Record<string, unknown>;
      if (typeof v.usd === "number") priceUsd = v.usd;
      else if (typeof v.price === "number") priceUsd = v.price;
      else if (typeof v.amount === "number") priceUsd = v.amount;
      else if (typeof v.micro === "number") priceUsd = v.micro / 1_000_000;
    }

    if (priceUsd !== null && priceUsd > 0 && !seen.has(endpointPath)) {
      seen.add(endpointPath);
      services.push({ name: endpointPath, endpoint: endpointPath, priceUsd });
    }
  }

  return services;
}

export async function handleProbe(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const apiUrl = url.searchParams.get("url");

  if (!apiUrl || !apiUrl.startsWith("https://")) {
    return new Response(JSON.stringify({ error: "url param required (must be https://)" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const base = apiUrl.replace(/\/$/, "");

  // Health check (best-effort)
  let healthy = false;
  try {
    const h = await fetch(`${base}/health`, { method: "GET" });
    healthy = h.ok || h.status === 405;
  } catch {
    // not all agents have /health — that's OK
  }

  // Fetch pricing
  let pricingData: Record<string, unknown>;
  try {
    const res = await fetch(`${base}/pricing`, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `Pricing endpoint returned ${res.status}`, healthy }),
        { status: 422, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }
    const text = await res.text();
    try {
      pricingData = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return new Response(
        JSON.stringify({ error: "Pricing response is not JSON", healthy }),
        { status: 422, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }
  } catch (e) {
    return new Response(
      JSON.stringify({ error: "Could not reach pricing endpoint", healthy }),
      { status: 422, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  // Parse
  const payTo = findEthAddress(pricingData);
  if (!payTo) {
    return new Response(
      JSON.stringify({ error: "No Ethereum address found in pricing response", healthy, raw: pricingData }),
      { status: 422, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  const chainId = parseChainId(pricingData);
  const services = extractServices(pricingData);
  const priceUsd = services.length > 0
    ? Math.min(...services.map((s) => s.priceUsd))
    : 0.01;

  const result: ProbeResult = {
    payTo,
    priceUsd,
    chainId,
    asset: "USDC",
    services,
    healthy,
  };

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
