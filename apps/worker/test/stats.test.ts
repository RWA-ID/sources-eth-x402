import { describe, it, expect } from "vitest";
import { handleStats, incrementStat } from "../src/routes/stats";
import { FakeKV, makeEnv } from "./helpers";

describe("platform stats", () => {
  it("reports zeroes on a cold KV rather than null or NaN", async () => {
    const res = await handleStats(makeEnv());
    expect(await res.json()).toEqual({
      permanent_agents: 0,
      total_transactions: 0,
      total_usdc_volume: 0,
    });
  });

  it("counts by 1 by default", async () => {
    const kv = new FakeKV();
    await incrementStat(kv as unknown as KVNamespace, "stats:permanent_agents");
    await incrementStat(kv as unknown as KVNamespace, "stats:permanent_agents");

    const body = await (await handleStats(makeEnv(kv))).json() as { permanent_agents: number };
    expect(body.permanent_agents).toBe(2);
  });

  it("accumulates USDC volume in raw 6-decimal units", async () => {
    const kv = new FakeKV();
    // $0.05 and $1.00 in USDC raw units
    await incrementStat(kv as unknown as KVNamespace, "stats:total_usdc_volume", 50_000);
    await incrementStat(kv as unknown as KVNamespace, "stats:total_usdc_volume", 1_000_000);

    const body = await (await handleStats(makeEnv(kv))).json() as { total_usdc_volume: number };
    expect(body.total_usdc_volume).toBe(1_050_000);
    // The landing page divides by 1e6 to render "$1.05"
    expect(body.total_usdc_volume / 1_000_000).toBeCloseTo(1.05, 2);
  });

  it("stores counters as strings, the way KV actually round-trips them", async () => {
    const kv = new FakeKV();
    await incrementStat(kv as unknown as KVNamespace, "stats:total_transactions");
    expect(kv.raw("stats:total_transactions")).toBe("1");
  });

  it("treats a corrupt counter as zero instead of propagating NaN", async () => {
    const kv = new FakeKV();
    kv.seed("stats:total_transactions", "not-a-number");

    const body = await (await handleStats(makeEnv(kv))).json() as { total_transactions: number };
    expect(Number.isNaN(body.total_transactions)).toBe(false);
  });
});
