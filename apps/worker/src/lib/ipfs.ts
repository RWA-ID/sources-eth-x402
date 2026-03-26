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
    const err = await response.text();
    throw new Error(`Pinata error: ${err}`);
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
