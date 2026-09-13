import { describe, it, expect, vi } from "vitest";
import { handleManifest } from "../src/routes/manifest";
import {
  FakeKV,
  makeEnv,
  makeManifest,
  makeRegistration,
  permanentRequest,
  OWNER,
} from "./helpers";

const ENS = "test-agent.agents.sources.eth";
const OTHER = "0xBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbbBBBBbbbb";
const DAY = 24 * 60 * 60 * 1000;

// Registration now requires proof of control over the payout wallet. These
// tests are about name availability, so the signature is stubbed to a simple
// rule and attached wherever a request is expected to get past the 401.
vi.mock("@worldcoin/agentkit", () => ({
  verifyEVMSignature: vi.fn(async (_m: string, address: string, signature: string) => {
    const m = signature.match(/^0x474f4f44([0-9a-fA-F]{40})$/);
    return !!m && m[1].toLowerCase() === address.replace(/^0x/, "").toLowerCase();
  }),
}));

let nonceSeq = 0;
/** Attach a valid owner signature for `body.payment_address`. */
function withSig<T extends { payment_address?: string }>(body: T) {
  const addr = body.payment_address ?? OWNER;
  return {
    ...body,
    owner_signature: {
      signature: "0x474f4f44" + addr.replace(/^0x/, "").toLowerCase(),
      nonce: `reclaim-nonce-${++nonceSeq}`,
      issued_at: Date.now(),
    },
  };
}

/**
 * Name availability on the permanent path.
 *
 * The handler validates the body and checks availability BEFORE issuing a 402,
 * so these all run without any network or payment: an available name answers
 * 402 (here is what to pay), a taken name answers 409.
 */
function seedRegistered(
  kv: FakeKV,
  opts: { owner: string; status: "trial" | "trial_expired" | "active"; expiresAt: number }
) {
  kv.seed(`registrations:${ENS}`, makeRegistration({
    status: opts.status,
    trial_expires_at: opts.expiresAt,
  }));
  kv.seed(`agents:${ENS}`, makeManifest({ payment_address: opts.owner }));
}

describe("permanent registration — name availability", () => {
  it("offers a 402 for a name nobody has registered", async () => {
    const kv = new FakeKV();
    const res = await handleManifest(permanentRequest(withSig(makeManifest())), makeEnv(kv));
    expect(res.status).toBe(402);
  });

  it("rejects a name that is in an active trial held by someone else", async () => {
    const kv = new FakeKV();
    seedRegistered(kv, { owner: OTHER, status: "trial", expiresAt: Date.now() + 5 * DAY });

    const res = await handleManifest(permanentRequest(makeManifest()), makeEnv(kv));
    expect(res.status).toBe(409);
    expect((await res.json() as { error: string }).error).toContain("active trial");
  });

  it("rejects a name that is permanently listed by someone else", async () => {
    const kv = new FakeKV();
    seedRegistered(kv, { owner: OTHER, status: "active", expiresAt: Date.now() });

    const res = await handleManifest(permanentRequest(makeManifest()), makeEnv(kv));
    expect(res.status).toBe(409);
    expect((await res.json() as { error: string }).error).toContain("permanently listed");
  });

  it("lets the current owner update their own live listing", async () => {
    const kv = new FakeKV();
    seedRegistered(kv, { owner: OWNER, status: "active", expiresAt: Date.now() });

    const res = await handleManifest(permanentRequest(withSig(makeManifest())), makeEnv(kv));
    expect(res.status).toBe(402);
  });

  it("matches the owner address case-insensitively", async () => {
    const kv = new FakeKV();
    seedRegistered(kv, { owner: OWNER.toLowerCase(), status: "active", expiresAt: Date.now() });

    const res = await handleManifest(
      permanentRequest(withSig(makeManifest({ payment_address: OWNER.toUpperCase().replace("0X", "0x") }))),
      makeEnv(kv)
    );
    expect(res.status).toBe(402);
  });
});

describe("expired-trial reclaim", () => {
  // The bug: an expired trial used to be available to ANYONE, including the
  // original owner, who could therefore cycle free trials on the same name
  // forever without ever paying.
  it("refuses the original owner a second free trial once theirs expired", async () => {
    const kv = new FakeKV();
    seedRegistered(kv, { owner: OWNER, status: "trial_expired", expiresAt: Date.now() - DAY });

    const res = await handleManifest(permanentRequest(makeManifest()), makeEnv(kv));
    expect(res.status).toBe(409);

    const { error } = await res.json() as { error: string };
    expect(error).toContain("expired");
    expect(error).toContain("$49");
  });

  it("also refuses the original owner when the trial lapsed by time, not status", async () => {
    const kv = new FakeKV();
    // status is still "trial" but the clock has run out
    seedRegistered(kv, { owner: OWNER, status: "trial", expiresAt: Date.now() - 1 });

    const res = await handleManifest(permanentRequest(makeManifest()), makeEnv(kv));
    expect(res.status).toBe(409);
    expect((await res.json() as { error: string }).error).toContain("expired");
  });

  it("releases an expired name to a different builder", async () => {
    const kv = new FakeKV();
    seedRegistered(kv, { owner: OTHER, status: "trial_expired", expiresAt: Date.now() - DAY });

    const res = await handleManifest(permanentRequest(withSig(makeManifest())), makeEnv(kv));
    expect(res.status).toBe(402);
  });
});

describe("manifest validation runs before any 402", () => {
  it("rejects a handle outside .agents.sources.eth", async () => {
    const res = await handleManifest(
      permanentRequest(makeManifest({ ens: "test-agent.eth" })),
      makeEnv()
    );
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toContain(".agents.sources.eth");
  });

  it("rejects a non-HTTPS endpoint", async () => {
    const res = await handleManifest(
      permanentRequest(makeManifest({ endpoint: "http://agent.example/generate" })),
      makeEnv()
    );
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toContain("https");
  });

  it("rejects an endpoint on a private host", async () => {
    const res = await handleManifest(
      permanentRequest(makeManifest({ endpoint: "https://192.168.1.1/generate" })),
      makeEnv()
    );
    expect(res.status).toBe(400);
  });

  // Service endpoints reach the same forwarding path as the top-level endpoint
  // via /generate's sub_path, and can come straight out of a third-party spec.
  it("rejects a service endpoint on an internal address", async () => {
    const res = await handleManifest(
      permanentRequest(makeManifest({
        services: [
          { name: "render", endpoint: "https://agent.example/render" },
          { name: "sneaky", endpoint: "http://169.254.169.254/latest/meta-data" },
        ],
      } as never)),
      makeEnv()
    );
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toContain("sneaky");
  });

  it("accepts services that are all public https", async () => {
    const res = await handleManifest(
      permanentRequest(withSig(makeManifest({
        services: [{ name: "render", endpoint: "https://agent.example/render" }],
      }) as never)),
      makeEnv()
    );
    expect(res.status).toBe(402);
  });

  it("rejects a price below the $0.001 floor", async () => {
    const res = await handleManifest(
      permanentRequest(makeManifest({ price_usd: 0.0001 })),
      makeEnv()
    );
    expect(res.status).toBe(400);
  });

  it("names the first missing required field", async () => {
    const body = makeManifest();
    delete (body as Record<string, unknown>).payment_address;

    const res = await handleManifest(permanentRequest(body), makeEnv());
    expect(res.status).toBe(400);
    expect((await res.json() as { error: string }).error).toContain("payment_address");
  });
});
