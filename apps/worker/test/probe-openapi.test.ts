import { describe, it, expect, vi, afterEach } from "vitest";
import { handleProbeOpenApi } from "../src/routes/probe-openapi";
import { makeEnv } from "./helpers";

const PAY_TO = "0xCCCCccccCCCCccccCCCCccccCCCCccccCCCCcccc";

interface ProbeResult {
  payTo: string;
  priceUsd: number;
  chainId: number;
  asset: string;
  services: Array<{ name: string; endpoint: string; priceUsd: number }>;
  healthy: boolean;
  display_name?: string;
  description?: string;
  base_url?: string;
}

function probe(url: string) {
  return handleProbeOpenApi(
    new Request(`https://worker.example/probe-openapi?url=${encodeURIComponent(url)}`),
    makeEnv()
  );
}

/** Route fetches by URL; anything unrouted 404s, so a test can't pass by accident. */
function mockFetch(routes: Record<string, { status?: number; body?: unknown; headers?: Record<string, string> }>) {
  const fn = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const hit = routes[url];
    if (!hit) return new Response("not found", { status: 404 });
    return new Response(
      typeof hit.body === "string" ? hit.body : JSON.stringify(hit.body ?? {}),
      { status: hit.status ?? 200, headers: hit.headers }
    );
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

const SPEC_WITH_X402 = {
  info: { title: "Pixel Forge", description: "Image generation agent." },
  servers: [{ url: "https://agent.example" }],
  paths: {
    "/render": {
      post: {
        summary: "Render an image",
        "x-payment-info": {
          price: { mode: "fixed", currency: "USD", amount: "0.05" },
          protocols: [{ x402: {} }],
        },
      },
    },
    "/upscale": {
      post: {
        "x-payment-info": {
          price: { mode: "fixed", currency: "USD", amount: "0.12" },
        },
      },
    },
    "/health": { get: { summary: "Free health check" } },
  },
  "x-x402": { payTo: PAY_TO, asset: "USDC", network: "eip155:8453" },
};

afterEach(() => vi.unstubAllGlobals());

describe("GET /probe-openapi — input guarding", () => {
  it("refuses a missing url", async () => {
    const res = await handleProbeOpenApi(
      new Request("https://worker.example/probe-openapi"),
      makeEnv()
    );
    expect(res.status).toBe(400);
  });

  it("refuses plaintext http", async () => {
    const res = await probe("http://agent.example");
    expect(res.status).toBe(400);
  });
});

describe("GET /probe-openapi — discovery", () => {
  it("finds the spec at /openapi.json from a bare API root", async () => {
    mockFetch({ "https://agent.example/openapi.json": { body: SPEC_WITH_X402 } });

    const res = await probe("https://agent.example");
    expect(res.status).toBe(200);

    const body = await res.json() as ProbeResult;
    expect(body.payTo).toBe(PAY_TO);
    expect(body.chainId).toBe(8453);
    expect(body.display_name).toBe("Pixel Forge");
    expect(body.base_url).toBe("https://agent.example");
  });

  it("enumerates only the payable operations, skipping free routes", async () => {
    mockFetch({ "https://agent.example/openapi.json": { body: SPEC_WITH_X402 } });

    const body = await (await probe("https://agent.example")).json() as ProbeResult;
    expect(body.services).toHaveLength(2);
    expect(body.services.map((s) => s.name)).toEqual(["render", "upscale"]);
    expect(body.services.every((s) => s.endpoint.startsWith("https://agent.example/"))).toBe(true);
  });

  it("reports the cheapest payable route as the headline price", async () => {
    mockFetch({ "https://agent.example/openapi.json": { body: SPEC_WITH_X402 } });

    const body = await (await probe("https://agent.example")).json() as ProbeResult;
    expect(body.priceUsd).toBe(0.05);
  });

  it("accepts a direct openapi.json URL without double-appending", async () => {
    const fetchFn = mockFetch({ "https://agent.example/openapi.json": { body: SPEC_WITH_X402 } });

    const res = await probe("https://agent.example/openapi.json");
    expect(res.status).toBe(200);
    const called = fetchFn.mock.calls.map((c) => String(c[0]));
    expect(called).not.toContain("https://agent.example/openapi.json/openapi.json");
  });

  it("prefers servers[0].url over the URL the builder typed", async () => {
    mockFetch({
      "https://typed.example/openapi.json": {
        body: { ...SPEC_WITH_X402, servers: [{ url: "https://real-api.example/" }] },
      },
    });

    const body = await (await probe("https://typed.example")).json() as ProbeResult;
    expect(body.base_url).toBe("https://real-api.example");
    expect(body.services[0].endpoint).toBe("https://real-api.example/render");
  });

  it("reads a dynamic price from its minimum", async () => {
    mockFetch({
      "https://agent.example/openapi.json": {
        body: {
          ...SPEC_WITH_X402,
          paths: {
            "/render": {
              post: {
                "x-payment-info": { price: { mode: "dynamic", currency: "USD", min: "0.02", max: "2.00" } },
              },
            },
          },
        },
      },
    });

    const body = await (await probe("https://agent.example")).json() as ProbeResult;
    expect(body.priceUsd).toBe(0.02);
  });

  it("strips path parameters out of a derived service name", async () => {
    mockFetch({
      "https://agent.example/openapi.json": {
        body: {
          ...SPEC_WITH_X402,
          paths: {
            "/v1/render/{jobId}": {
              post: { "x-payment-info": { price: { mode: "fixed", amount: "0.05" } } },
            },
          },
        },
      },
    });

    const body = await (await probe("https://agent.example")).json() as ProbeResult;
    expect(body.services[0].name).toBe("v1-render");
  });
});

describe("GET /probe-openapi — falling back to a live 402", () => {
  it("recovers payTo by probing when the spec omits x-x402", async () => {
    const { "x-x402": _dropped, ...specNoX402 } = SPEC_WITH_X402;
    mockFetch({
      "https://agent.example/openapi.json": { body: specNoX402 },
      "https://agent.example/render": {
        status: 402,
        body: {
          x402Version: 1,
          accepts: [{
            scheme: "exact",
            network: "base-mainnet",
            maxAmountRequired: "50000",
            payTo: PAY_TO,
            asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          }],
        },
      },
    });

    const body = await (await probe("https://agent.example")).json() as ProbeResult;
    expect(body.payTo).toBe(PAY_TO);
    expect(body.chainId).toBe(8453);
  });
});

describe("GET /probe-openapi — a hostile spec cannot redirect our fetches", () => {
  // servers[0].url arrives inside a third-party document. Before this guard it
  // was used verbatim: probePayTo() fetched it, and it was stored as the agent
  // endpoint that /generate later forwards paid requests to.
  it.each([
    ["cloud metadata", "http://169.254.169.254/latest/meta-data"],
    ["private network", "https://192.168.1.1/admin"],
    ["loopback", "https://127.0.0.1:8787/internal"],
    ["plaintext http", "http://agent.example"],
  ])("refuses a spec whose servers[0].url points at %s", async (_label, evil) => {
    const fetchFn = mockFetch({
      "https://agent.example/openapi.json": {
        body: { ...SPEC_WITH_X402, servers: [{ url: evil }] },
      },
    });

    const res = await probe("https://agent.example");
    expect(res.status).toBe(422);

    // and crucially, we never actually reached it
    const called = fetchFn.mock.calls.map((c) => String(c[0]));
    expect(called.some((u) => u.startsWith(evil))).toBe(false);
  });

  it("refuses a url param pointing at a private host", async () => {
    const fetchFn = mockFetch({});
    const res = await probe("https://169.254.169.254/openapi.json");

    expect(res.status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("GET /probe-openapi — outbound calls are bounded", () => {
  it("gives every probe a timeout and refuses to follow redirects", async () => {
    const fetchFn = mockFetch({ "https://agent.example/openapi.json": { body: SPEC_WITH_X402 } });

    await probe("https://agent.example");

    expect(fetchFn).toHaveBeenCalled();
    for (const call of fetchFn.mock.calls) {
      const init = call[1] as RequestInit | undefined;
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.redirect).toBe("manual");
    }
  });
});

describe("GET /probe-openapi — rejecting unusable specs", () => {
  it("explains itself when no spec can be found", async () => {
    mockFetch({});
    const res = await probe("https://agent.example");
    expect(res.status).toBe(422);
    expect((await res.json() as { error: string }).error).toContain("openapi.json");
  });

  it("rejects a spec that is not JSON", async () => {
    mockFetch({ "https://agent.example/openapi.json": { body: "<html>nope</html>" } });
    const res = await probe("https://agent.example");
    expect(res.status).toBe(422);
  });

  it("tells the builder what is missing when no route is payable", async () => {
    mockFetch({
      "https://agent.example/openapi.json": {
        body: { info: { title: "Free API" }, servers: [{ url: "https://agent.example" }], paths: { "/ping": { get: {} } } },
      },
    });

    const res = await probe("https://agent.example");
    expect(res.status).toBe(422);
    expect((await res.json() as { error: string }).error).toContain("x-payment-info");
  });

  it("refuses to register a payable agent with no payment address", async () => {
    const { "x-x402": _dropped, ...specNoX402 } = SPEC_WITH_X402;
    // Spec is payable, but nothing answers 402 — there is nobody to pay.
    mockFetch({ "https://agent.example/openapi.json": { body: specNoX402 } });

    const res = await probe("https://agent.example");
    expect(res.status).toBe(422);
    expect((await res.json() as { error: string }).error).toContain("payment address");
  });

  it("ignores a zero or negative price rather than listing a free 'paid' route", async () => {
    mockFetch({
      "https://agent.example/openapi.json": {
        body: {
          ...SPEC_WITH_X402,
          paths: { "/render": { post: { "x-payment-info": { price: { mode: "fixed", amount: "0" } } } } },
        },
      },
    });

    const res = await probe("https://agent.example");
    expect(res.status).toBe(422);
  });
});
