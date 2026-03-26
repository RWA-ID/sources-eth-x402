/**
 * GET /import-agent?q=36119 | ?q=base/16969 | ?q=0x...
 *
 * Fetches full ERC-8004 agent data from 8004scan (including real service endpoints
 * from raw_metadata) and returns it formatted for the sources.eth register form.
 */

import type { Env } from "../lib/registry";

const SCAN_API = "https://www.8004scan.io/api/v1/public";
const ALLOWED_CHAINS = new Set([1, 8453]);

interface OffchainService {
  name: string;
  endpoint: string;
  version?: string;
}

interface FullAgentData {
  token_id?: string;
  chain_id?: number;
  name?: string;
  description?: string;
  image_url?: string;
  supported_protocols?: string[];
  x402_supported?: boolean;
  owner_address?: string;
  agent_id?: string;
  mcp_server?: string;
  a2a_endpoint?: string;
  raw_metadata?: {
    offchain_content?: {
      services?: OffchainService[];
    };
  };
}

export interface ImportedAgent {
  agentId: number;
  chain: string;
  name: string;
  description: string;
  image?: string;
  services: Array<{ name: string; endpoint: string; version?: string }>;
  x402Support: boolean;
  owner: string;
}

function chainName(chainId: number): string {
  if (chainId === 1) return "ethereum";
  if (chainId === 8453) return "base";
  return `chain-${chainId}`;
}

/**
 * Extract services with real endpoints.
 * Prefers offchain metadata (has full URLs), falls back to known endpoint fields,
 * then falls back to protocol names only.
 */
function extractServices(d: FullAgentData): ImportedAgent["services"] {
  const offchain = d.raw_metadata?.offchain_content?.services;
  if (offchain?.length) {
    return offchain
      .filter((s) => s.name && s.endpoint)
      .map((s) => ({ name: s.name, endpoint: s.endpoint, ...(s.version && { version: s.version }) }));
  }

  // Reconstruct from known endpoint fields
  const services: ImportedAgent["services"] = [];
  if (d.mcp_server) services.push({ name: "MCP", endpoint: d.mcp_server });
  if (d.a2a_endpoint) services.push({ name: "A2A", endpoint: d.a2a_endpoint });

  const known = new Set(services.map((s) => s.name.toLowerCase()));
  for (const p of d.supported_protocols ?? []) {
    if (!known.has(p.toLowerCase())) services.push({ name: p, endpoint: "" });
  }

  return services;
}

async function fetchById(chainId: number, tokenId: number): Promise<ImportedAgent | null> {
  const res = await fetch(`${SCAN_API}/agents/${chainId}/${tokenId}`, {
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) return null;
  const body = await res.json() as { data?: FullAgentData };
  const d = body.data;
  if (!d?.name) return null;

  return {
    agentId: parseInt(d.token_id ?? "0", 10),
    chain: chainName(d.chain_id ?? chainId),
    name: d.name,
    description: d.description ?? "",
    image: d.image_url ?? undefined,
    services: extractServices(d),
    x402Support: d.x402_supported ?? false,
    owner: d.owner_address ?? "",
  };
}

export async function handleImportAgent(request: Request, _env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";

  if (!q) return json({ error: "q parameter required" }, 400);

  // --- Wallet address lookup ---
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) {
    const res = await fetch(`${SCAN_API}/accounts/${q}/agents`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return json({ agents: [] });

    const body = await res.json() as { data?: FullAgentData[] };
    const agents: ImportedAgent[] = (body.data ?? [])
      .filter((a) => a.name && a.chain_id && ALLOWED_CHAINS.has(a.chain_id))
      .map((a) => ({
        agentId: parseInt(a.token_id ?? "0", 10),
        chain: chainName(a.chain_id!),
        name: a.name!,
        description: a.description ?? "",
        image: a.image_url ?? undefined,
        services: extractServices(a),
        x402Support: a.x402_supported ?? false,
        owner: a.owner_address ?? "",
      }));
    return json({ agents });
  }

  // --- Agent ID lookup ---
  const normalized = q.toLowerCase().replace(/[/\s]+/g, " ");
  let chainId = 8453;
  let tokenId: number | null = null;

  const namedMatch = normalized.match(/^(base|ethereum|eth)\s+(\d+)$/);
  if (namedMatch) {
    chainId = namedMatch[1] === "base" ? 8453 : 1;
    tokenId = parseInt(namedMatch[2], 10);
  } else if (/^\d+$/.test(normalized)) {
    tokenId = parseInt(normalized, 10);
  }

  if (!tokenId) return json({ error: "Enter a numeric agent ID (e.g. 36119), chain prefix (e.g. base/36119), or wallet address (0x...)" }, 400);

  const chainsToTry = chainId === 8453 ? [8453, 1] : [1, 8453];
  for (const cid of chainsToTry) {
    const agent = await fetchById(cid, tokenId);
    if (agent) return json({ agents: [agent] });
  }

  return json({ agents: [] });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
