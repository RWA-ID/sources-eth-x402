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

export async function fetchFromIPFS(cid: string): Promise<unknown> {
  const url = `https://gateway.pinata.cloud/ipfs/${cid}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`IPFS fetch failed for CID ${cid}: ${response.status}`);
  }
  return response.json();
}
