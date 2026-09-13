import type { Env } from "../lib/registry";

/**
 * GET /probe-openapi?url=<api-root-or-openapi-json>
 *
 * Discovers a paid agent from its OpenAPI 3.x spec.
 * - Accepts the API root (we'll append /openapi.json) or a direct openapi.json URL.
 * - Enumerates operations with `x-payment-info`, maps them to services.
 * - Resolves payTo / asset / chainId from `x-x402` (preferred) or by live-probing
 *   the first payable path for a 402 response with x402 v1/v2 terms.
 *
 * Returns the same shape as /probe (ProbeResult) so the frontend can reuse step 2.
 */

interface ProbeResult {
  payTo: string;
  priceUsd: number;
  chainId: number;
  asset: string;
  services: Array<{ name: string; endpoint: string; priceUsd: number }>;
  healthy: boolean;
  // Extra fields surfaced for the register form auto-fill:
  display_name?: string;
  description?: string;
  base_url?: string;
}

interface PaymentInfo {
  price?: {
    mode?: "fixed" | "dynamic";
    currency?: string;
    amount?: string;
    min?: string;
    max?: string;
  };
  protocols?: Array<Record<string, unknown>>;
}

interface OpenApiOperation {
  summary?: string;
  description?: string;
  "x-payment-info"?: PaymentInfo;
}

interface OpenApiSpec {
  info?: {
    title?: string;
    description?: string;
    "x-guidance"?: string;
  };
  servers?: Array<{ url: string }>;
  paths?: Record<string, Record<string, OpenApiOperation>>;
  "x-x402"?: {
    payTo?: string;
    asset?: string;
    network?: string;
    chainId?: number;
  };
}

function parseChainIdFromNetwork(network: string | undefined): number {
  if (!network) return 8453;
  const m = network.match(/eip155:(\d+)/);
  if (m) return parseInt(m[1], 10);
  if (network === "base" || network === "base-mainnet") return 8453;
  if (network === "ethereum" || network === "ethereum-mainnet") return 1;
  return 8453;
}

function priceFromInfo(info: PaymentInfo): number | null {
  const p = info?.price;
  if (!p) return null;
  if (p.mode === "fixed" && p.amount) return parseFloat(p.amount);
  if (p.mode === "dynamic" && p.min) return parseFloat(p.min);
  return null;
}

async function resolveOpenApiUrl(input: string): Promise<{ specUrl: string; baseUrl: string } | null> {
  const cleaned = input.replace(/\/$/, "");
  // If user passed openapi.json directly:
  if (/\.json$/i.test(cleaned) || cleaned.endsWith("/openapi") || cleaned.endsWith("/openapi.json")) {
    return { specUrl: cleaned, baseUrl: cleaned.replace(/\/openapi(\.json)?$/i, "") };
  }
  // Try common locations
  const candidates = [
    `${cleaned}/openapi.json`,
    `${cleaned}/openapi`,
    `${cleaned}/.well-known/openapi.json`,
  ];
  for (const c of candidates) {
    try {
      const res = await fetch(c, { headers: { Accept: "application/json" } });
      if (res.ok) return { specUrl: c, baseUrl: cleaned };
    } catch {
      // try next
    }
  }
  return null;
}

async function probePayTo(
  baseUrl: string,
  paths: string[]
): Promise<{ payTo?: string; asset?: string; chainId?: number; priceUsd?: number }> {
  // Try GET first (no body), then POST with empty body.
  for (const p of paths) {
    const url = `${baseUrl}${p.startsWith("/") ? p : "/" + p}`;
    for (const method of ["GET", "POST"] as const) {
      try {
        const res = await fetch(url, {
          method,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          ...(method === "POST" ? { body: "{}" } : {}),
        });
        if (res.status !== 402) continue;
        // Try header first (v2), then body
        const headerB64 = res.headers.get("PAYMENT-REQUIRED") ?? res.headers.get("payment-required");
        let bodyText = "";
        try { bodyText = await res.text(); } catch { /* ignore */ }
        let parsed: Record<string, unknown> | null = null;
        if (headerB64) {
          try {
            const decoded = atob(headerB64);
            parsed = JSON.parse(decoded);
          } catch { /* fall through */ }
        }
        if (!parsed && bodyText) {
          try { parsed = JSON.parse(bodyText); } catch { /* ignore */ }
        }
        if (!parsed) continue;
        const accepts = (parsed.accepts as Array<Record<string, unknown>> | undefined) ?? [];
        const a = accepts[0];
        if (!a) continue;
        const payTo = (a.payTo as string | undefined) ?? (a.pay_to as string | undefined);
        const asset = (a.asset as string | undefined) ?? "USDC";
        const network = (a.network as string | undefined);
        const chainId = parseChainIdFromNetwork(network);
        const amountRaw = (a.amount as string | undefined) ?? (a.maxAmountRequired as string | undefined);
        const priceUsd = amountRaw ? parseInt(amountRaw, 10) / 1_000_000 : undefined;
        return { payTo, asset, chainId, priceUsd };
      } catch {
        // try next
      }
    }
  }
  return {};
}

export async function handleProbeOpenApi(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const apiUrl = url.searchParams.get("url");

  if (!apiUrl || !apiUrl.startsWith("https://")) {
    return new Response(JSON.stringify({ error: "url param required (must be https://)" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const resolved = await resolveOpenApiUrl(apiUrl);
  if (!resolved) {
    return new Response(
      JSON.stringify({ error: "Could not find /openapi.json at the provided URL" }),
      { status: 422, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  let spec: OpenApiSpec;
  try {
    const res = await fetch(resolved.specUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ error: `OpenAPI fetch returned ${res.status}` }),
        { status: 422, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
    }
    spec = await res.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "OpenAPI document is not valid JSON" }),
      { status: 422, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  // Derive base URL: prefer servers[0].url, else the URL the user provided.
  const baseUrl = spec.servers?.[0]?.url?.replace(/\/$/, "") ?? resolved.baseUrl;

  // Enumerate payable operations.
  const services: Array<{ name: string; endpoint: string; priceUsd: number }> = [];
  for (const [path, methods] of Object.entries(spec.paths ?? {})) {
    for (const [_method, op] of Object.entries(methods)) {
      const info = op["x-payment-info"];
      if (!info) continue;
      const price = priceFromInfo(info);
      if (price === null || price <= 0) continue;
      const name = path.replace(/^\//, "").replace(/\{[^}]+\}/g, "").replace(/\/+/g, "-").replace(/-+$/g, "") || "root";
      services.push({ name, endpoint: `${baseUrl}${path}`, priceUsd: price });
    }
  }

  if (services.length === 0) {
    return new Response(
      JSON.stringify({
        error: "No payable operations found. Each paid route needs an x-payment-info block in your OpenAPI spec.",
      }),
      { status: 422, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  // Resolve payTo / asset / chainId.
  let payTo: string | undefined = spec["x-x402"]?.payTo;
  let asset: string | undefined = spec["x-x402"]?.asset ?? "USDC";
  let chainId: number = spec["x-x402"]?.chainId ?? parseChainIdFromNetwork(spec["x-x402"]?.network);

  if (!payTo) {
    const probed = await probePayTo(
      baseUrl,
      services.map((s) => s.endpoint.replace(baseUrl, ""))
    );
    payTo = probed.payTo;
    if (probed.asset) asset = probed.asset;
    if (probed.chainId) chainId = probed.chainId;
  }

  if (!payTo) {
    return new Response(
      JSON.stringify({
        error:
          "Found payable operations but no payment address. Add an `x-x402: { payTo, asset, network }` block to your OpenAPI spec, or ensure your 402 responses include `accepts[0].payTo`.",
      }),
      { status: 422, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  // Health check is implicit — if we got the spec, the server is up.
  const result: ProbeResult = {
    payTo,
    priceUsd: Math.min(...services.map((s) => s.priceUsd)),
    chainId,
    asset: asset ?? "USDC",
    services,
    healthy: true,
    display_name: spec.info?.title,
    description: spec.info?.description ?? spec.info?.["x-guidance"],
    base_url: baseUrl,
  };

  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
