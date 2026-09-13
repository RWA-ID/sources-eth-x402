import { describe, it, expect } from "vitest";
import { assertSafeAgentUrl, isSafeAgentUrl, UnsafeUrlError } from "../src/lib/safe-url";

describe("assertSafeAgentUrl — accepts real agent hosts", () => {
  it.each([
    "https://agent.example",
    "https://api.agent.example/v1/openapi.json",
    "https://agent.example:8443/render",
    "https://8.8.8.8/openapi.json", // public IP literal is fine
  ])("accepts %s", (url) => {
    expect(isSafeAgentUrl(url)).toBe(true);
  });
});

describe("assertSafeAgentUrl — rejects non-https", () => {
  it.each(["http://agent.example", "ftp://agent.example", "file:///etc/passwd", "not-a-url"])(
    "rejects %s",
    (url) => {
      expect(isSafeAgentUrl(url)).toBe(false);
    }
  );

  it("rejects the javascript: scheme", () => {
    expect(isSafeAgentUrl("javascript:alert(1)")).toBe(false);
  });
});

describe("assertSafeAgentUrl — rejects private and special addresses", () => {
  it.each([
    ["loopback", "https://127.0.0.1/x"],
    ["loopback range", "https://127.99.1.2/x"],
    ["localhost", "https://localhost/x"],
    ["localhost subdomain", "https://foo.localhost/x"],
    ["cloud metadata", "https://169.254.169.254/latest/meta-data/"],
    ["private 10/8", "https://10.0.0.1/x"],
    ["private 192.168/16", "https://192.168.1.1/x"],
    ["private 172.16/12", "https://172.20.10.5/x"],
    ["CGNAT", "https://100.64.0.1/x"],
    ["unspecified", "https://0.0.0.0/x"],
    ["multicast", "https://239.255.255.250/x"],
    [".internal", "https://vault.internal/x"],
    [".local", "https://printer.local/x"],
    ["GCP metadata", "https://metadata.google.internal/x"],
    ["IPv6 loopback", "https://[::1]/x"],
    ["IPv6 unique-local", "https://[fd00::1]/x"],
    ["IPv6 link-local", "https://[fe80::1]/x"],
    ["IPv4-mapped IPv6", "https://[::ffff:127.0.0.1]/x"],
    ["IPv4-mapped private", "https://[::ffff:10.0.0.1]/x"],
    ["IPv4-mapped, already in hex form", "https://[::ffff:7f00:1]/x"],
  ])("rejects %s", (_label, url) => {
    expect(isSafeAgentUrl(url)).toBe(false);
  });

  // The URL parser rewrites ::ffff:127.0.0.1 to ::ffff:7f00:1, so a guard that
  // only understands the dotted spelling waves the mapped address straight through.
  it("still allows a public IPv4-mapped address", () => {
    expect(isSafeAgentUrl("https://[::ffff:8.8.8.8]/x")).toBe(true);
  });

  it("rejects 172.16/12 without catching the public neighbours", () => {
    expect(isSafeAgentUrl("https://172.15.0.1/x")).toBe(true);
    expect(isSafeAgentUrl("https://172.16.0.1/x")).toBe(false);
    expect(isSafeAgentUrl("https://172.31.255.254/x")).toBe(false);
    expect(isSafeAgentUrl("https://172.32.0.1/x")).toBe(true);
  });
});

describe("assertSafeAgentUrl — rejects credential smuggling", () => {
  // https://trusted.example@evil.example/ fetches evil.example, but reads as trusted.
  it("rejects a userinfo prefix that disguises the real host", () => {
    expect(isSafeAgentUrl("https://agent.example@evil.example/x")).toBe(false);
  });

  it("rejects user:password form", () => {
    expect(isSafeAgentUrl("https://user:pass@agent.example/x")).toBe(false);
  });
});

describe("assertSafeAgentUrl — error messages", () => {
  it("throws UnsafeUrlError naming what was rejected", () => {
    expect(() => assertSafeAgentUrl("http://agent.example", "servers[0].url"))
      .toThrow(UnsafeUrlError);
    expect(() => assertSafeAgentUrl("http://agent.example", "servers[0].url"))
      .toThrow(/servers\[0\]\.url must use https/);
  });

  it("names the offending host so a builder can fix their spec", () => {
    expect(() => assertSafeAgentUrl("https://10.0.0.1/x", "servers[0].url"))
      .toThrow(/10\.0\.0\.1/);
  });
});
