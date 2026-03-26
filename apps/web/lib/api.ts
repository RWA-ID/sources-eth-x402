import type { AgentManifest, AgentCategory, AgentRating } from "@sources-eth/agent-manifest";

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";

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
  chain: "base" | "ethereum";
}

export interface ProbeResult {
  payTo: string;
  priceUsd: number;
  chainId: number;
  asset: string;
  services: Array<{ name: string; endpoint: string; priceUsd: number }>;
  healthy: boolean;
}

export async function probeAgent(apiUrl: string): Promise<ProbeResult> {
  const res = await fetch(`${WORKER_URL}/probe?url=${encodeURIComponent(apiUrl)}`);
  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error ?? "Probe failed");
  }
  return res.json();
}

export async function searchAgents(
  q: string,
  category?: AgentCategory | "all"
): Promise<AgentManifest[]> {
  const params = new URLSearchParams({ q });
  if (category && category !== "all") params.set("category", category);

  const res = await fetch(`${WORKER_URL}/search?${params}`);
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export async function getAgent(ens: string): Promise<AgentManifest | null> {
  const res = await fetch(`${WORKER_URL}/agent/${ens}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch agent");
  return res.json();
}

export async function initiateGenerate(
  ens: string,
  prompt: string,
  inputs: Record<string, unknown> = {},
  sub_path?: string
): Promise<{ requires402: true; paymentRequest: unknown } | { result: Record<string, unknown> }> {
  const res = await fetch(`${WORKER_URL}/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ens, prompt, ...(sub_path && { sub_path }), ...inputs }),
  });

  if (res.status === 402) {
    const paymentRequest = await res.json();
    return { requires402: true, paymentRequest };
  }

  if (!res.ok) throw new Error("Generate failed");
  const result = await res.json();
  return { result };
}

export async function generateWithPayment(
  ens: string,
  prompt: string,
  paymentProof: string,
  inputs: Record<string, unknown> = {},
  sub_path?: string
): Promise<Record<string, unknown>> {
  const res = await fetch(`${WORKER_URL}/generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-PAYMENT": paymentProof,
    },
    body: JSON.stringify({ ens, prompt, ...(sub_path && { sub_path }), ...inputs }),
  });

  if (!res.ok) {
    const err = await res.json() as { error: string; status?: number; detail?: string };
    const msg = err.detail ? `${err.error} (${err.status}): ${err.detail}` : (err.error ?? "Generation failed");
    throw new Error(msg);
  }

  return res.json();
}

export async function registerManifest(
  manifest: Omit<AgentManifest, "ipfs_cid" | "registered_at" | "manifest_version">
): Promise<{ requires402: true; paymentRequest: unknown } | { cid: string; ens: string; trial_expires_at: number | null; status: string }> {
  const res = await fetch(`${WORKER_URL}/manifest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(manifest),
  });

  if (res.status === 402) {
    const paymentRequest = await res.json();
    return { requires402: true, paymentRequest };
  }

  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error);
  }

  return res.json();
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

export async function importErc8004Agent(q: string): Promise<{ agents: ImportedAgent[]; error?: string }> {
  const res = await fetch(`${WORKER_URL}/import-agent?q=${encodeURIComponent(q)}`);
  const data = await res.json() as { agents?: ImportedAgent[]; error?: string };
  if (data.error && !data.agents) throw new Error(data.error);
  return { agents: data.agents ?? [], error: data.error };
}

export async function discoverAgents(q = ""): Promise<Erc8004Agent[]> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  const res = await fetch(`${WORKER_URL}/discover?${params}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getRating(ens: string): Promise<AgentRating> {
  const res = await fetch(`${WORKER_URL}/rating/${ens}`);
  if (!res.ok) return { ens, total: 0, count: 0, avg: 0 };
  return res.json();
}

export async function submitRating(ens: string, rating: number): Promise<AgentRating> {
  const res = await fetch(`${WORKER_URL}/rate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ens, rating }),
  });
  if (!res.ok) throw new Error("Rating failed");
  return res.json();
}

export async function upgradeAgent(
  ens: string,
  paymentProof?: string
): Promise<{ requires402: true; paymentRequest: unknown } | { success: true }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (paymentProof) headers["X-PAYMENT"] = paymentProof;

  const res = await fetch(`${WORKER_URL}/upgrade/${ens}`, {
    method: "POST",
    headers,
    body: "{}",
  });

  if (res.status === 402) {
    const paymentRequest = await res.json();
    return { requires402: true, paymentRequest };
  }

  if (!res.ok) {
    const err = await res.json() as { error: string };
    throw new Error(err.error);
  }

  return res.json();
}
