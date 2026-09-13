import type { AgentManifest, Registration } from "@sources-eth/agent-manifest";
import type { Env } from "../src/lib/registry";

/**
 * Minimal in-memory stand-in for a Workers KV namespace.
 *
 * Only implements what the routes under test actually call: get(key),
 * get(key, "json"), put() and delete(). Values are stored as strings, exactly
 * as real KV does, so a test can never accidentally pass by round-tripping a
 * live object reference.
 */
export class FakeKV {
  private store = new Map<string, string>();

  async get<T = unknown>(key: string, type?: "json" | "text"): Promise<T | string | null> {
    const raw = this.store.get(key);
    if (raw === undefined) return null;
    return type === "json" ? (JSON.parse(raw) as T) : raw;
  }

  async put(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.store.delete(key);
  }

  /** Test-only: seed a value without going through put(). */
  seed(key: string, value: unknown): void {
    this.store.set(key, typeof value === "string" ? value : JSON.stringify(value));
  }

  /** Test-only: read raw stored string. */
  raw(key: string): string | undefined {
    return this.store.get(key);
  }
}

export const TREASURY = "0x116fC3Bb1E3b48d39718b0D19D286f6B44DC7ED3";

export function makeEnv(kv: FakeKV = new FakeKV()): Env {
  return {
    AGENTS_KV: kv as unknown as KVNamespace,
    PINATA_JWT: "test-jwt",
    BASE_RPC_URL: "https://base.example/rpc",
    ETH_RPC_URL: "https://eth.example/rpc",
    X402_FACILITATOR_URL: "https://facilitator.example",
    PLATFORM_TREASURY_ADDRESS: TREASURY,
    TRIAL_FEE_USDC: "10000000",
    UPGRADE_FEE_USDC: "39000000",
    FULL_FEE_USDC: "49000000",
    TRIAL_DURATION_DAYS: "15",
    ADMIN_SECRET: "test-secret",
  };
}

const OWNER = "0xAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaaAAAAaaaa";

export function makeManifest(overrides: Partial<AgentManifest> = {}): Partial<AgentManifest> {
  return {
    name: "test-agent",
    display_name: "Test Agent",
    description: "An agent used in tests.",
    ens: "test-agent.agents.sources.eth",
    version: "1.0.0",
    endpoint: "https://agent.example/generate",
    method: "POST",
    price_usd: 0.05,
    payment_address: OWNER,
    payment_chain: 8453,
    payment_token: "USDC",
    category: "image-generation",
    tags: ["test"],
    input: { prompt: { type: "string", required: true, maxLength: 1000 } },
    output: { type: "image", format: "png", delivery: "url" },
    ...overrides,
  } as Partial<AgentManifest>;
}

export function makeRegistration(overrides: Partial<Registration> = {}): Registration {
  const now = Date.now();
  return {
    ens: "test-agent.agents.sources.eth",
    tx_hash_trial: "free",
    fee_paid_total: 0,
    status: "trial",
    trial_started_at: now,
    trial_expires_at: now + 15 * 24 * 60 * 60 * 1000,
    ...overrides,
  };
}

export { OWNER };

/** POST a manifest body to the permanent (402-gated) registration path. */
export function permanentRequest(body: unknown, paymentHeader?: string): Request {
  return new Request("https://worker.example/manifest?plan=permanent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(paymentHeader ? { "X-PAYMENT": paymentHeader } : {}),
    },
    body: JSON.stringify(body),
  });
}
