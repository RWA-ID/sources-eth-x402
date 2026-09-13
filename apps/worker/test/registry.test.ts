import { describe, it, expect } from "vitest";
import type { Registration } from "@sources-eth/agent-manifest";
import { getAgent } from "../src/lib/registry";
import { FakeKV, makeManifest, makeRegistration } from "./helpers";

const ENS = "test-agent.agents.sources.eth";
const DAY = 24 * 60 * 60 * 1000;

function seed(kv: FakeKV, reg: Partial<Registration>) {
  kv.seed(`registrations:${ENS}`, makeRegistration(reg));
  kv.seed(`agents:${ENS}`, makeManifest());
}

describe("getAgent — trial visibility", () => {
  it("returns nothing for a name that was never registered", async () => {
    const kv = new FakeKV();
    expect(await getAgent(ENS, kv as unknown as KVNamespace)).toBeNull();
  });

  it("serves an agent inside its trial window", async () => {
    const kv = new FakeKV();
    seed(kv, { status: "trial", trial_expires_at: Date.now() + 5 * DAY });

    const agent = await getAgent(ENS, kv as unknown as KVNamespace);
    expect(agent?.ens).toBe(ENS);
  });

  it("serves a permanently active agent regardless of the trial clock", async () => {
    const kv = new FakeKV();
    seed(kv, { status: "active", trial_expires_at: Date.now() - 100 * DAY });

    expect(await getAgent(ENS, kv as unknown as KVNamespace)).not.toBeNull();
  });

  it("hides an agent whose trial has run out", async () => {
    const kv = new FakeKV();
    seed(kv, { status: "trial", trial_expires_at: Date.now() - 1 });

    expect(await getAgent(ENS, kv as unknown as KVNamespace)).toBeNull();
  });

  it("persists the expiry on read, so the lapse is recorded once", async () => {
    const kv = new FakeKV();
    seed(kv, { status: "trial", trial_expires_at: Date.now() - 1 });

    await getAgent(ENS, kv as unknown as KVNamespace);

    const stored = JSON.parse(kv.raw(`registrations:${ENS}`)!) as Registration;
    expect(stored.status).toBe("trial_expired");
  });

  it("keeps the manifest on file after expiry, so upgrading needs no re-pin", async () => {
    const kv = new FakeKV();
    seed(kv, { status: "trial_expired", trial_expires_at: Date.now() - DAY });

    expect(await getAgent(ENS, kv as unknown as KVNamespace)).toBeNull();
    expect(kv.raw(`agents:${ENS}`)).toBeDefined();
  });
});
