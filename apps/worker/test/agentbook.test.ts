import { describe, it, expect, vi } from "vitest";
import { lookupAgentBook } from "../src/lib/agentbook";
import { handleWorldVerify } from "../src/routes/world-verify";
import { makeEnv } from "./helpers";

const lookupHuman = vi.fn();
vi.mock("@worldcoin/agentkit", () => ({
  createAgentBookVerifier: vi.fn(() => ({ lookupHuman: (...a: unknown[]) => lookupHuman(...a) })),
}));

const ADDR = "0x0E84dDEdAaE6A779c462C22a59F301EC31B6b808";

// No beforeEach(mockReset) here on purpose: resetting a mock that a later test
// makes throw causes vitest 2.1 to surface the thrown error as an unhandled
// test failure, even though the code under test catches it correctly. Every
// test sets its own implementation, so a shared reset buys nothing.

describe("AgentBook lookup", () => {
  it("resolves on World Chain, never on Base", async () => {
    lookupHuman.mockClear();
    lookupHuman.mockResolvedValue(null);
    await lookupAgentBook(ADDR, "https://worldchain.example/rpc");
    // The old code queried Base with a function that does not exist there.
    expect(lookupHuman).toHaveBeenCalledWith(ADDR, "eip155:480");
  });

  it("reports a registered human", async () => {
    lookupHuman.mockResolvedValue("0x00000000000000000000000000000000000000000000000000000000000004d2");
    const r = await lookupAgentBook(ADDR);
    expect(r.verified).toBe(true);
    expect(r.humanId).toBeTruthy();
    expect(r.error).toBeUndefined();
  });

  it("treats a null result as an honest 'not registered'", async () => {
    lookupHuman.mockResolvedValue(null);
    const r = await lookupAgentBook(ADDR);
    expect(r).toEqual({ verified: false });
    expect(r.error).toBeUndefined();
  });

  it("treats an all-zero humanId as not registered", async () => {
    lookupHuman.mockResolvedValue("0x" + "0".repeat(64));
    const r = await lookupAgentBook(ADDR);
    expect(r.verified).toBe(false);
    expect(r.error).toBeUndefined();
  });

  // The original bug: every call reverted, the revert was swallowed, and a
  // broken integration was indistinguishable from "this person is not verified".
  it("distinguishes a failed lookup from a negative answer", async () => {
    lookupHuman.mockImplementation(async () => { throw new Error("execution reverted"); });
    const r = await lookupAgentBook(ADDR);
    expect(r.verified).toBe(false);
    expect(r.error).toContain("execution reverted");
  });

  it("never throws, so a lookup failure cannot block a registration", async () => {
    lookupHuman.mockImplementation(async () => { throw new Error("network down"); });
    await expect(lookupAgentBook(ADDR)).resolves.toBeDefined();
  });
});

describe("GET /world/verify", () => {
  const req = (address: string) =>
    new Request(`https://worker.example/world/verify?address=${address}`);

  it("rejects a malformed address", async () => {
    const res = await handleWorldVerify(req("not-an-address"), makeEnv());
    expect(res.status).toBe(400);
  });

  it("reports a verified human", async () => {
    lookupHuman.mockResolvedValue("0x" + "0".repeat(63) + "7");
    const res = await handleWorldVerify(req(ADDR), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ verified: true });
  });

  it("reports an unregistered address as a 200 negative", async () => {
    lookupHuman.mockResolvedValue(null);
    const res = await handleWorldVerify(req(ADDR), makeEnv());
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ verified: false, humanId: null });
  });

  it("reports a broken lookup as 502, not as an unverified human", async () => {
    lookupHuman.mockImplementation(async () => { throw new Error("rpc unreachable"); });
    const res = await handleWorldVerify(req(ADDR), makeEnv());
    expect(res.status).toBe(502);
    const body = await res.json() as { error?: string };
    expect(body.error).toContain("rpc unreachable");
  });
});
