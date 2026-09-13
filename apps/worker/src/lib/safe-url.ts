/**
 * Guards for URLs that come from outside — a builder's `?url=` param, and more
 * importantly the contents of a third-party OpenAPI spec, which we fetch and
 * then store in a manifest that /generate later forwards paid requests to.
 *
 * What this stops: a spec that points us at plaintext http, at credentials-in-URL,
 * or at a literal private/loopback/link-local address.
 *
 * What this does NOT stop: a public hostname whose DNS resolves to a private
 * address (DNS rebinding). Defeating that needs resolve-then-pin, which the
 * Workers runtime does not expose. Treat this as narrowing the target set, not
 * as complete SSRF protection.
 */

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "metadata.google.internal",
  "metadata",
]);

const BLOCKED_SUFFIXES = [".localhost", ".local", ".internal", ".home.arpa"];

function isBlockedIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;

  const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
  if (m.slice(1).some((o) => parseInt(o, 10) > 255)) return true; // malformed → refuse

  if (a === 0) return true;                        // 0.0.0.0/8
  if (a === 10) return true;                       // private
  if (a === 127) return true;                      // loopback
  if (a === 169 && b === 254) return true;         // link-local / cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true;         // private
  if (a === 192 && b === 0) return true;           // IETF protocol assignments
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a === 198 && (b === 18 || b === 19)) return true; // benchmarking
  if (a >= 224) return true;                       // multicast + reserved

  return false;
}

function isBlockedIpv6(host: string): boolean {
  // URL parsing leaves IPv6 hosts bracketed.
  if (!host.startsWith("[") || !host.endsWith("]")) return false;
  const addr = host.slice(1, -1).toLowerCase();

  if (addr === "::1" || addr === "::") return true;        // loopback / unspecified
  if (/^f[cd]/.test(addr)) return true;                    // fc00::/7 unique-local
  if (/^fe[89ab]/.test(addr)) return true;                 // fe80::/10 link-local

  // IPv4-mapped. The URL parser rewrites ::ffff:127.0.0.1 into its hex form
  // ::ffff:7f00:1, so checking only the dotted spelling misses the mapped
  // address entirely — decode the two hex groups back into octets.
  const hex = addr.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hex) {
    const hi = parseInt(hex[1], 16);
    const lo = parseInt(hex[2], 16);
    return isBlockedIpv4(`${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`);
  }
  if (addr.startsWith("::ffff:")) {
    return isBlockedIpv4(addr.slice("::ffff:".length));     // dotted spelling
  }
  return false;
}

export class UnsafeUrlError extends Error {}

/**
 * Returns the parsed URL, or throws UnsafeUrlError with a message safe to show
 * the builder. `label` names what we were reading, so the error says which URL
 * was rejected — the typed one or one out of their spec.
 */
export function assertSafeAgentUrl(raw: string, label = "URL"): URL {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError(`${label} is not a valid absolute URL`);
  }

  if (url.protocol !== "https:") {
    throw new UnsafeUrlError(`${label} must use https (got ${url.protocol.replace(":", "") || "no scheme"})`);
  }

  if (url.username || url.password) {
    throw new UnsafeUrlError(`${label} must not embed credentials`);
  }

  const host = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.has(host) || BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    throw new UnsafeUrlError(`${label} must be a public host (got ${host})`);
  }

  if (isBlockedIpv4(host) || isBlockedIpv6(host)) {
    throw new UnsafeUrlError(`${label} must be a public host (got ${host})`);
  }

  return url;
}

/** True/false form for validation paths that collect errors rather than throw. */
export function isSafeAgentUrl(raw: string): boolean {
  try {
    assertSafeAgentUrl(raw);
    return true;
  } catch {
    return false;
  }
}

/** Every outbound probe gets the same 8s budget the rest of the worker uses. */
export const PROBE_TIMEOUT_MS = 8_000;

export function probeFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, {
    ...init,
    redirect: "manual", // a 3xx could hop to a blocked host after our check
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
}
