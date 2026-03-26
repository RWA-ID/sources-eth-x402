/**
 * ERC-8004 agent discovery powered by 8004scan.io public API
 * Supports: text search, direct agent ID lookup, owner address lookup
 */

import type { Env } from "../lib/registry";

const SCAN_API = "https://www.8004scan.io/api/v1/public";
const CACHE_TTL_SECONDS = 300; // 5 min

export interface Erc8004Agent {
  agentId: number;
  name: string;
  description: string;
  image?: string;
  services: Array<{ name: string; endpoint: string; version?: string }>;
  x402Support?: boolean;
  owner: string;
  agentURI: string;
  isRegistered: boolean;
  sourcesEns?: string;
  chain: string;
}

// 8004scan list/account response item
interface ScanListItem {
  id: string;
  agent_id: string;
  token_id: string;
  chain_id: number;
  owner_address?: string;
  name?: string;
  description?: string;
  image_url?: string;
  supported_protocols?: string[];
  x402_supported?: boolean;
  total_score?: number;
}

// 8004scan search response item
interface ScanSearchItem {
  id: string;
  name?: string;
  description?: string;
  image_url?: string;
  supported_protocols?: string[];
  x402_supported?: boolean;
  total_score?: number;
  chain_id?: number;
  token_id?: string;
  agent_id?: string;
}

const ALLOWED_CHAINS = new Set([1, 8453]); // Ethereum mainnet + Base mainnet

function chainName(chainId: number): string {
  if (chainId === 1) return "ethereum";
  if (chainId === 8453) return "base";
  return `chain-${chainId}`;
}

function mapListItem(item: ScanListItem): Erc8004Agent {
  return {
    agentId: parseInt(item.token_id ?? "0", 10),
    name: item.name ?? `Agent #${item.token_id}`,
    description: item.description ?? "",
    image: item.image_url ?? undefined,
    services: (item.supported_protocols ?? []).map((p) => ({ name: p, endpoint: "" })),
    x402Support: item.x402_supported ?? false,
    owner: item.owner_address ?? "",
    agentURI: item.agent_id,
    isRegistered: false,
    chain: chainName(item.chain_id),
  };
}

function mapSearchItem(item: ScanSearchItem): Erc8004Agent {
  return {
    agentId: parseInt(item.token_id ?? "0", 10),
    name: item.name ?? "Unknown Agent",
    description: item.description ?? "",
    image: item.image_url ?? undefined,
    services: (item.supported_protocols ?? []).map((p) => ({ name: p, endpoint: "" })),
    x402Support: item.x402_supported ?? false,
    owner: "",
    agentURI: item.agent_id ?? "",
    isRegistered: false,
    chain: item.chain_id ? chainName(item.chain_id) : "ethereum",
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.eth$/, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function checkRegistration(agents: Erc8004Agent[], kv: KVNamespace): Promise<Erc8004Agent[]> {
  return Promise.all(
    agents.map(async (a) => {
      const slug = slugify(a.name);
      const expectedEns = `${slug}.agents.sources.eth`;
      const exists = await kv.get(`agents:${expectedEns}`, "text");
      return exists
        ? { ...a, isRegistered: true, sourcesEns: expectedEns }
        : a;
    })
  );
}

/**
 * Parse agent ID lookup patterns.
 * Handles: "16969", "base 16969", "base/16969", "ethereum 22605"
 */
function parseAgentIdQuery(q: string): { chainId: number; tokenId: number } | null {
  const normalized = q.trim().toLowerCase().replace(/[/\s]+/g, " ");

  // "base 16969" or "ethereum/eth 22605"
  const namedChainMatch = normalized.match(/^(base|ethereum|eth)\s+(\d+)$/);
  if (namedChainMatch) {
    const chainId = namedChainMatch[1] === "base" ? 8453 : 1;
    return { chainId, tokenId: parseInt(namedChainMatch[2], 10) };
  }

  // Pure numeric — try Base first, then Ethereum
  if (/^\d+$/.test(normalized)) {
    return { chainId: 8453, tokenId: parseInt(normalized, 10) };
  }

  return null;
}

/** Detect Ethereum address pattern (0x + 40 hex chars) */
function isEthAddress(q: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(q.trim());
}

export async function handleDiscover(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const forceRefresh = url.searchParams.get("refresh") === "1";

  const cacheKey = q ? `erc8004:search:${q.slice(0, 100)}` : "erc8004:cache";

  if (!forceRefresh) {
    const cached = await env.AGENTS_KV.get<Erc8004Agent[]>(cacheKey, "json");
    if (cached) return jsonResponse(cached);
  }

  let agents: Erc8004Agent[] = [];
  const idQuery = q ? parseAgentIdQuery(q) : null;

  try {
    if (q && isEthAddress(q)) {
      // --- Owner address lookup: GET /accounts/{address}/agents ---
      const res = await fetch(
        `${SCAN_API}/accounts/${q.trim()}/agents`,
        { signal: AbortSignal.timeout(8_000) }
      );
      if (res.ok) {
        const data = await res.json() as { data?: ScanListItem[] };
        agents = (data.data ?? [])
          .filter((a) => a.name && ALLOWED_CHAINS.has(a.chain_id))
          .map(mapListItem);
      }
    } else if (idQuery) {
      // --- Direct agent ID lookup: GET /agents/{chainId}/{tokenId} ---
      const chainsToTry = idQuery.chainId === 8453 ? [8453, 1] : [1, 8453];

      for (const chainId of chainsToTry) {
        const res = await fetch(
          `${SCAN_API}/agents/${chainId}/${idQuery.tokenId}`,
          { signal: AbortSignal.timeout(8_000) }
        );
        if (!res.ok) continue;
        const data = await res.json() as { data?: ScanListItem };
        if (data.data?.name && ALLOWED_CHAINS.has(data.data.chain_id)) {
          agents = [mapListItem(data.data)];
          break;
        }
      }

      // Fall through to text search if direct lookup found nothing
      if (agents.length === 0) {
        const res = await fetch(
          `${SCAN_API}/agents/search?q=${encodeURIComponent(q)}&limit=60`,
          { signal: AbortSignal.timeout(8_000) }
        );
        const data = await res.json() as { data?: ScanSearchItem[] };
        agents = (data.data ?? [])
          .filter((a) => a.name && (a.chain_id === undefined || ALLOWED_CHAINS.has(a.chain_id)))
          .map(mapSearchItem);
      }
    } else if (q) {
      // --- Semantic search: GET /agents/search ---
      const res = await fetch(
        `${SCAN_API}/agents/search?q=${encodeURIComponent(q)}&limit=60`,
        { signal: AbortSignal.timeout(8_000) }
      );
      const data = await res.json() as { data?: ScanSearchItem[] };
      agents = (data.data ?? [])
        .filter((a) => a.name && (a.chain_id === undefined || ALLOWED_CHAINS.has(a.chain_id)))
        .map(mapSearchItem);
    } else {
      // --- Default browse: parallel chain-specific queries for accurate top results ---
      const [baseRes, ethRes] = await Promise.all([
        fetch(`${SCAN_API}/agents?chain_id=8453&limit=50&sort=total_score&order=desc`, { signal: AbortSignal.timeout(8_000) }),
        fetch(`${SCAN_API}/agents?chain_id=1&limit=50&sort=total_score&order=desc`, { signal: AbortSignal.timeout(8_000) }),
      ]);
      const [baseData, ethData] = await Promise.all([
        baseRes.json() as Promise<{ data?: ScanListItem[] }>,
        ethRes.json() as Promise<{ data?: ScanListItem[] }>,
      ]);
      const baseAgents = (baseData.data ?? []).filter((a) => a.name).map(mapListItem);
      const ethAgents = (ethData.data ?? []).filter((a) => a.name).map(mapListItem);
      // Interleave: best base, best eth, 2nd base, 2nd eth... for a balanced mix
      const maxLen = Math.max(baseAgents.length, ethAgents.length);
      for (let i = 0; i < maxLen; i++) {
        if (i < baseAgents.length) agents.push(baseAgents[i]);
        if (i < ethAgents.length) agents.push(ethAgents[i]);
      }
    }
  } catch {
    return jsonResponse([]);
  }

  const withRegistration = await checkRegistration(agents, env.AGENTS_KV);

  await env.AGENTS_KV.put(cacheKey, JSON.stringify(withRegistration), {
    expirationTtl: CACHE_TTL_SECONDS,
  });

  return jsonResponse(withRegistration);
}

function jsonResponse(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
