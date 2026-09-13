import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { handleManifest } from "../src/routes/manifest";
import {
  buildRegistrationMessage,
  MAX_SIGNATURE_AGE_MS,
} from "../src/lib/owner-signature";
import { FakeKV, makeEnv, makeManifest, makeRegistration, permanentRequest, OWNER } from "./helpers";

const ENS = "test-agent.agents.sources.eth";
const OTHER = "0xBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbb";

/**
 * verifyEVMSignature is the real cryptography (viem, EOA + ERC-1271). These
 * tests stub it to a simple rule — "0xGOOD:<address>" verifies for <address>
 * and nothing else — so they exercise OUR binding, replay and expiry logic
 * rather than re-testing viem.
 */
vi.mock("@worldcoin/agentkit", () => ({
  verifyEVMSignature: vi.fn(async (_msg: string, address: string, signature: string) => {
    const m = signature.match(/^0x474f4f44(?:00)?([0-9a-fA-F]{40})$/); // "GOOD" + address
    return !!m && m[1].toLowerCase() === address.replace(/^0x/, "").toLowerCase();
  }),
}));

// Keep these tests off the network. Without this they hit the real Pinata API,
// which is slow, flaky, and makes the "never pins the signature" assertion
// vacuous — the pin fails, nothing is stored, and the check skips.
vi.mock("../src/lib/ipfs", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/lib/ipfs")>()),
  pinJSON: vi.fn(async () => "bafyTESTCID"),
  fetchFromIPFS: vi.fn(async () => ({})),
}));

function goodSig(address: string) {
  return "0x474f4f44" + address.replace(/^0x/, "").toLowerCase();
}

function signed(overrides: Record<string, unknown> = {}, address = OWNER) {
  // owner_signature is merged field-by-field, so a test can override just
  // issued_at without losing the signature and nonce.
  const { owner_signature: sigOverride, ...rest } = overrides;
  return {
    ...makeManifest({ payment_address: address }),
    ...rest,
    owner_signature: {
      signature: goodSig(address),
      nonce: "nonce-" + Math.random().toString(36).slice(2, 12),
      issued_at: Date.now(),
      ...((sigOverride as object) ?? {}),
    },
  };
}

function freeRequest(body: unknown) {
  return new Request("https://worker.example/manifest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

let kv: FakeKV;
beforeEach(() => { kv = new FakeKV(); });
afterEach(() => vi.clearAllMocks());

describe("the signed message binds to the listing", () => {
  it("names every field a hijacker would want to change", () => {
    const msg = buildRegistrationMessage({
      ens: ENS,
      endpoint: "https://agent.example/generate",
      payment_address: OWNER,
      plan: "trial",
      nonce: "abc12345",
      issued_at: 1_700_000_000_000,
    });
    expect(msg).toContain(ENS);
    expect(msg).toContain("https://agent.example/generate");
    expect(msg).toContain(OWNER);
    expect(msg).toContain("trial");
    expect(msg).toContain("abc12345");
  });

  it("changes when the endpoint changes", () => {
    const base = { ens: ENS, payment_address: OWNER, plan: "trial" as const, nonce: "abc12345", issued_at: 1 };
    const a = buildRegistrationMessage({ ...base, endpoint: "https://good.example/x" });
    const b = buildRegistrationMessage({ ...base, endpoint: "https://evil.example/x" });
    expect(a).not.toEqual(b);
  });

  it("distinguishes trial from permanent", () => {
    const base = { ens: ENS, endpoint: "https://a.example", payment_address: OWNER, nonce: "abc12345", issued_at: 1 };
    expect(buildRegistrationMessage({ ...base, plan: "trial" }))
      .not.toEqual(buildRegistrationMessage({ ...base, plan: "permanent" }));
  });
});

describe("free listing requires a valid owner signature", () => {
  it("rejects a listing with no signature at all", async () => {
    const res = await handleManifest(freeRequest(makeManifest()), makeEnv(kv));
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toContain("owner_signature is required");
  });

  it("accepts a correctly signed listing", async () => {
    const res = await handleManifest(freeRequest(signed()), makeEnv(kv));
    expect(res.status).not.toBe(401);
  });

  it("rejects a signature from a wallet that is not the payout address", async () => {
    const body = { ...makeManifest({ payment_address: OWNER }), owner_signature: {
      signature: goodSig(OTHER), nonce: "nonce-abcdefgh", issued_at: Date.now(),
    } };
    const res = await handleManifest(freeRequest(body), makeEnv(kv));
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toContain("does not match payment_address");
  });

  it("rejects a malformed signature", async () => {
    const res = await handleManifest(
      freeRequest(signed({ owner_signature: { signature: "not-hex" } })), makeEnv(kv)
    );
    expect(res.status).toBe(401);
  });

  it("rejects a short or non-URL-safe nonce", async () => {
    const res = await handleManifest(
      freeRequest(signed({ owner_signature: { nonce: "a b" } })), makeEnv(kv)
    );
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toContain("nonce");
  });
});

describe("replay and freshness", () => {
  it("refuses to accept the same nonce twice", async () => {
    const body = signed({}, OWNER);
    const env = makeEnv(kv);

    const first = await handleManifest(freeRequest(body), env);
    expect(first.status).not.toBe(401);

    // Same signature, different name — must not be reusable.
    const replay = { ...body, ens: "second-name.agents.sources.eth", name: "second-name" };
    const res = await handleManifest(freeRequest(replay), env);
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toContain("already been used");
  });

  it("rejects a signature older than the validity window", async () => {
    const res = await handleManifest(
      freeRequest(signed({ owner_signature: { issued_at: Date.now() - MAX_SIGNATURE_AGE_MS - 1000 } })),
      makeEnv(kv)
    );
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toContain("expired");
  });

  it("rejects a signature dated well into the future", async () => {
    const res = await handleManifest(
      freeRequest(signed({ owner_signature: { issued_at: Date.now() + 60 * 60 * 1000 } })),
      makeEnv(kv)
    );
    expect(res.status).toBe(401);
    expect((await res.json() as { error: string }).error).toContain("future");
  });

  it("tolerates small clock skew", async () => {
    const res = await handleManifest(
      freeRequest(signed({ owner_signature: { issued_at: Date.now() + 30_000 } })),
      makeEnv(kv)
    );
    expect(res.status).not.toBe(401);
  });
});

describe("paid listing requires the signature before the 402", () => {
  it("refuses to quote a price without a signature", async () => {
    const res = await handleManifest(permanentRequest(makeManifest()), makeEnv(kv));
    expect(res.status).toBe(401);
    // Crucially NOT 402 — nobody should be asked to pay for a listing they
    // cannot prove they own.
    expect(res.status).not.toBe(402);
  });

  it("quotes the price once ownership is proven", async () => {
    const res = await handleManifest(permanentRequest(signed()), makeEnv(kv));
    expect(res.status).toBe(402);
  });

  it("rejects a paid listing signed by the wrong wallet", async () => {
    const body = { ...makeManifest({ payment_address: OWNER }), owner_signature: {
      signature: goodSig(OTHER), nonce: "nonce-12345678", issued_at: Date.now(),
    } };
    const res = await handleManifest(permanentRequest(body), makeEnv(kv));
    expect(res.status).toBe(401);
  });
});

describe("listing hijack is closed", () => {
  // The original hole: payment_address is public on IPFS, and matching it was
  // the entire ownership check — so anyone could re-point a live listing's
  // endpoint at their own server and receive every paid request.
  it("stops an attacker re-pointing a live listing they cannot sign for", async () => {
    kv.seed(`registrations:${ENS}`, makeRegistration({ status: "active" }));
    kv.seed(`agents:${ENS}`, makeManifest({ payment_address: OWNER }));

    const hijack = {
      ...makeManifest({ payment_address: OWNER, endpoint: "https://evil.example/steal" }),
      owner_signature: { signature: goodSig(OTHER), nonce: "nonce-hijack01", issued_at: Date.now() },
    };

    const res = await handleManifest(freeRequest(hijack), makeEnv(kv));
    expect(res.status).toBe(401);

    // and the stored listing is untouched
    const stored = JSON.parse(kv.raw(`agents:${ENS}`)!) as { endpoint: string };
    expect(stored.endpoint).toBe("https://agent.example/generate");
  });

  it("still lets the real owner update their own listing", async () => {
    kv.seed(`registrations:${ENS}`, makeRegistration({ status: "active" }));
    kv.seed(`agents:${ENS}`, makeManifest({ payment_address: OWNER }));

    const res = await handleManifest(freeRequest(signed()), makeEnv(kv));
    expect(res.status).not.toBe(401);
  });
});

describe("the signature is authorization, not listing content", () => {
  it("never pins owner_signature into the manifest", async () => {
    const env = makeEnv(kv);
    const res = await handleManifest(freeRequest(signed()), env);
    expect(res.status).toBe(200); // the listing really was written

    const stored = kv.raw(`agents:${ENS}`);
    expect(stored).toBeDefined();
    expect(stored).not.toContain("owner_signature");
    expect(stored).not.toContain("474f4f44");
  });

  it("writes a complete listing on success", async () => {
    const res = await handleManifest(freeRequest(signed()), makeEnv(kv));
    const body = await res.json() as { success: boolean; cid: string; status: string };
    expect(body.success).toBe(true);
    expect(body.cid).toBe("bafyTESTCID");
    expect(body.status).toBe("trial");
  });
});
