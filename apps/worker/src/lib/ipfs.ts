export class PinataError extends Error {
  constructor(public reason: string, public status: number) {
    super(`Pinata ${status}: ${reason}`);
  }
}

export async function pinJSON(
  data: unknown,
  name: string,
  pinatJwt: string
): Promise<string> {
  const response = await fetch("https://api.pinata.cloud/pinning/pinJSONToIPFS", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${pinatJwt}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      pinataContent: data,
      pinataMetadata: { name },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    // Surface Pinata's own reason. A bare "pinning failed" hid a six-week
    // outage: the key had been revoked and every registration 500'd with
    // nothing in the response or the logs saying why.
    let reason = body.slice(0, 200);
    try {
      const parsed = JSON.parse(body) as { error?: { reason?: string; details?: string } | string };
      if (typeof parsed.error === "string") reason = parsed.error;
      else if (parsed.error?.reason) reason = parsed.error.reason;
    } catch {
      // not JSON — keep the truncated raw body
    }
    throw new PinataError(reason, response.status);
  }

  const result = await response.json() as { IpfsHash: string };
  return result.IpfsHash;
}

/**
 * Read order matters. gateway.pinata.cloud refuses content by policy and is
 * the slowest of the three, so it goes last; our dedicated gateway answers in
 * about a second where ipfs.io routinely takes twenty-five.
 */
export const IPFS_GATEWAYS = [
  "https://ipfs.onchain-id.id/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://gateway.pinata.cloud/ipfs/",
] as const;

/** The gateway to hand back to clients in an ipfs_url field. */
export const PUBLIC_IPFS_GATEWAY = IPFS_GATEWAYS[0];

export async function fetchFromIPFS(cid: string): Promise<unknown> {
  const failures: string[] = [];

  for (const gateway of IPFS_GATEWAYS) {
    try {
      const response = await fetch(`${gateway}${cid}`, {
        headers: { Accept: "application/json" },
        // A fresh pin can take a while to become servable; never hang forever.
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) {
        failures.push(`${gateway} -> ${response.status}`);
        continue;
      }
      return await response.json();
    } catch (e) {
      failures.push(`${gateway} -> ${e instanceof Error ? e.name : "error"}`);
    }
  }

  throw new Error(`IPFS fetch failed for CID ${cid}: ${failures.join(", ")}`);
}
