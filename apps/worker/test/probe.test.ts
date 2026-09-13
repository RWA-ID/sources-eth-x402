import { describe, it, expect, vi, afterEach } from "vitest";
import { handleProbe } from "../src/routes/probe";
import { makeEnv } from "./helpers";

function probe(url: string) {
  return handleProbe(
    new Request(`https://worker.example/probe?url=${encodeURIComponent(url)}`),
    makeEnv()
  );
}

function mockFetch() {
  const fn = vi.fn(async () => new Response("{}", { status: 404 }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => vi.unstubAllGlobals());

describe("GET /probe — URL guard", () => {
  it("refuses a missing url", async () => {
    const res = await handleProbe(new Request("https://worker.example/probe"), makeEnv());
    expect(res.status).toBe(400);
  });

  it.each([
    ["plaintext http", "http://agent.example"],
    ["cloud metadata", "https://169.254.169.254/latest/meta-data"],
    ["loopback", "https://127.0.0.1:8787/"],
    ["private network", "https://10.1.2.3/"],
    ["localhost", "https://localhost/"],
    ["credential smuggling", "https://agent.example@evil.example/"],
    ["IPv6 loopback", "https://[::1]/"],
  ])("refuses %s without fetching it", async (_label, url) => {
    const fetchFn = mockFetch();

    const res = await probe(url);
    expect(res.status).toBe(400);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("still probes a legitimate public agent", async () => {
    const fetchFn = mockFetch();

    await probe("https://agent.example");
    expect(fetchFn).toHaveBeenCalled();
  });

  it("bounds every probe with a timeout and refuses redirects", async () => {
    const fetchFn = mockFetch();

    await probe("https://agent.example");

    for (const call of fetchFn.mock.calls) {
      const init = (call as unknown as [string, RequestInit | undefined])[1];
      expect(init?.signal).toBeInstanceOf(AbortSignal);
      expect(init?.redirect).toBe("manual");
    }
  });
});
