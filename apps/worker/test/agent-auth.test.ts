import { describe, it, expect, vi } from "vitest";
import {
  generateAgentSecret,
  signForward,
  buildForwardHeaders,
  secretKey,
  SIG_HEADER,
  TS_HEADER,
  TX_HEADER,
  LEGACY_HEADER,
} from "../src/lib/agent-auth";
import { handleAgentSecret } from "../src/routes/agent-secret";
import { FakeKV, makeEnv, makeManifest, OWNER } from "./helpers";

vi.mock("@worldcoin/agentkit", () => ({
  verifyEVMSignature: vi.fn(async (_m: string, address: string, signature: string) => {
    const m = signature.match(/^0x474f4f44([0-9a-fA-F]{40})$/);
    return !!m && m[1].toLowerCase() === address.replace(/^0x/, "").toLowerCase();
  }),
}));

const ENS = "test-agent.agents.sources.eth";
const TX = "0xabc123def456";
const OTHER = "0xBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbb";
let seq = 0;
const sigFor = (addr: string) => ({
  signature: "0x474f4f44" + addr.replace(/^0x/, "").toLowerCase(),
  nonce: `secret-nonce-${++seq}`,
  issued_at: Date.now(),
});

describe("agent secrets", () => {
  it("generates unguessable, distinct secrets", () => {
    const a = generateAgentSecret();
    const b = generateAgentSecret();
    expect(a).toMatch(/^sk_[0-9a-f]{64}$/);
    expect(a).not.toEqual(b);
  });
});

describe("forward signing", () => {
  it("is deterministic for the same inputs", async () => {
    const a = await signForward("sk_test", 1700000000, TX);
    const b = await signForward("sk_test", 1700000000, TX);
    expect(a).toEqual(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes with the secret, the timestamp and the txHash", async () => {
    const base = await signForward("sk_one", 1700000000, TX);
    expect(await signForward("sk_two", 1700000000, TX)).not.toEqual(base);
    expect(await signForward("sk_one", 1700000001, TX)).not.toEqual(base);
    expect(await signForward("sk_one", 1700000000, "0xdifferent")).not.toEqual(base);
  });
});

describe("forward headers", () => {
  it("signs when the agent has a secret", async () => {
    const kv = new FakeKV();
    kv.seed(secretKey(ENS), "sk_abc");

    const h = await buildForwardHeaders(ENS, TX, kv as unknown as KVNamespace);
    expect(h[SIG_HEADER]).toMatch(/^sha256=[0-9a-f]{64}$/);
    expect(h[TS_HEADER]).toMatch(/^\d+$/);
    expect(h[TX_HEADER]).toBe(TX);
  });

  it("carries the txHash so a provider can verify settlement itself", async () => {
    const kv = new FakeKV();
    const h = await buildForwardHeaders(ENS, TX, kv as unknown as KVNamespace);
    expect(h[TX_HEADER]).toBe(TX);
  });

  it("still forwards for agents registered before secrets existed", async () => {
    const kv = new FakeKV();
    const h = await buildForwardHeaders(ENS, TX, kv as unknown as KVNamespace);
    expect(h[LEGACY_HEADER]).toBe("1");
    expect(h[SIG_HEADER]).toBeUndefined();
  });

  it("never leaks the secret itself in a header", async () => {
    const kv = new FakeKV();
    kv.seed(secretKey(ENS), "sk_supersecret");

    const h = await buildForwardHeaders(ENS, TX, kv as unknown as KVNamespace);
    expect(JSON.stringify(h)).not.toContain("sk_supersecret");
  });

  it("preserves base headers it was given", async () => {
    const kv = new FakeKV();
    const h = await buildForwardHeaders(ENS, TX, kv as unknown as KVNamespace, { "X-Custom": "y" });
    expect(h["X-Custom"]).toBe("y");
  });

  // A provider recomputes HMAC(secret, `${ts}.${tx}`) and compares. If that does
  // not reproduce our header, every integration breaks.
  it("produces a signature a provider can independently reproduce", async () => {
    const kv = new FakeKV();
    kv.seed(secretKey(ENS), "sk_shared");

    const h = await buildForwardHeaders(ENS, TX, kv as unknown as KVNamespace);
    const expected = await signForward("sk_shared", Number(h[TS_HEADER]), h[TX_HEADER]);
    expect(h[SIG_HEADER]).toBe(`sha256=${expected}`);
  });
});

describe("POST /agent-secret", () => {
  const req = (body: unknown) =>
    new Request("https://worker.example/agent-secret", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  function seeded() {
    const kv = new FakeKV();
    kv.seed(`agents:${ENS}`, makeManifest({ payment_address: OWNER }));
    return kv;
  }

  it("issues a secret to the listing's payout owner", async () => {
    const kv = seeded();
    const res = await handleAgentSecret(req({ ens: ENS, owner_signature: sigFor(OWNER) }), makeEnv(kv));
    expect(res.status).toBe(200);

    const body = (await res.json()) as { agent_secret: string };
    expect(body.agent_secret).toMatch(/^sk_[0-9a-f]{64}$/);
    expect(kv.raw(secretKey(ENS))).toBe(body.agent_secret);
  });

  it("refuses anyone who cannot sign for the payout address", async () => {
    const kv = seeded();
    const res = await handleAgentSecret(req({ ens: ENS, owner_signature: sigFor(OTHER) }), makeEnv(kv));
    expect(res.status).toBe(401);
    expect(kv.raw(secretKey(ENS))).toBeUndefined();
  });

  it("refuses with no signature at all", async () => {
    const kv = seeded();
    const res = await handleAgentSecret(req({ ens: ENS }), makeEnv(kv));
    expect(res.status).toBe(401);
  });

  // The payout address is read from the stored manifest, so a caller cannot
  // nominate a wallet they happen to control.
  it("ignores a payment_address supplied in the request", async () => {
    const kv = seeded();
    const res = await handleAgentSecret(
      req({ ens: ENS, payment_address: OTHER, owner_signature: sigFor(OTHER) }),
      makeEnv(kv)
    );
    expect(res.status).toBe(401);
  });

  it("404s for a listing that does not exist", async () => {
    const res = await handleAgentSecret(
      req({ ens: "nope.agents.sources.eth", owner_signature: sigFor(OWNER) }),
      makeEnv(new FakeKV())
    );
    expect(res.status).toBe(404);
  });

  it("rotates: the previous secret stops working", async () => {
    const kv = seeded();
    kv.seed(secretKey(ENS), "sk_old");

    const res = await handleAgentSecret(req({ ens: ENS, owner_signature: sigFor(OWNER) }), makeEnv(kv));
    const { agent_secret } = (await res.json()) as { agent_secret: string };
    expect(agent_secret).not.toBe("sk_old");
    expect(kv.raw(secretKey(ENS))).toBe(agent_secret);
  });

  it("rejects a non-JSON body", async () => {
    const res = await handleAgentSecret(
      new Request("https://worker.example/agent-secret", { method: "POST", body: "not json" }),
      makeEnv(new FakeKV())
    );
    expect(res.status).toBe(400);
  });
});
