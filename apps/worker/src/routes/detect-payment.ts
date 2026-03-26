import type { Env } from "../lib/registry";
import { USDC_BASE } from "../lib/payment";

interface AlchemyTransfer {
  hash: string;
  to: string;
  value: string;
  rawContract?: { value?: string; address?: string };
}

/**
 * GET /detect-payment?payTo=0x...&amount=100000&after=1234567890
 *
 * Scans the last ~200 Base blocks (~7 min) for a USDC transfer to `payTo`
 * with at least `amount` raw USDC units. Returns { found, txHash }.
 * Called by PaymentModal every 3 s — no manual tx hash entry needed.
 */
export async function handleDetectPayment(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const payTo = url.searchParams.get("payTo")?.toLowerCase();
  const amount = parseInt(url.searchParams.get("amount") ?? "0", 10);

  if (!payTo || !amount) {
    return json({ found: false });
  }

  try {
    // Step 1: get current block
    const blockRes = await fetch(env.BASE_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "eth_blockNumber", params: [], id: 1 }),
      signal: AbortSignal.timeout(5_000),
    });
    const blockData = await blockRes.json() as { result?: string };
    const latestBlock = parseInt(blockData.result ?? "0x0", 16);
    if (!latestBlock) return json({ found: false });

    const fromBlock = `0x${Math.max(0, latestBlock - 200).toString(16)}`;

    // Step 2: scan for USDC transfers to payTo in last 200 blocks
    const res = await fetch(env.BASE_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "alchemy_getAssetTransfers",
        params: [{
          fromBlock,
          toBlock: "latest",
          toAddress: payTo,
          contractAddresses: [USDC_BASE],
          category: ["erc20"],
          withMetadata: false,
          excludeZeroValue: true,
          maxCount: "0x14",
          order: "desc",
        }],
      }),
      signal: AbortSignal.timeout(8_000),
    });

    const data = await res.json() as { result?: { transfers: AlchemyTransfer[] } };
    const transfers = data.result?.transfers ?? [];

    for (const tx of transfers) {
      if (tx.to?.toLowerCase() !== payTo) continue;
      const rawValue = tx.rawContract?.value
        ? parseInt(tx.rawContract.value, 16)
        : Math.round(parseFloat(tx.value) * 1_000_000);
      if (rawValue >= amount) {
        // Atomically claim this txHash so concurrent pollers don't get the same tx.
        // First writer wins — KV TTL matches the payment replay protection window.
        const claimKey = `detect-claim:${tx.hash}`;
        const alreadyClaimed = await env.AGENTS_KV.get(claimKey, "text");
        if (alreadyClaimed) continue; // another user already claimed this tx
        await env.AGENTS_KV.put(claimKey, "1", { expirationTtl: 3600 });

        // Pre-cache payment verification in KV so the subsequent /generate call
        // doesn't need to hit the RPC again — payment logic stays in the worker.
        await env.AGENTS_KV.put(
          `payments:pre-verified:${tx.hash}`,
          JSON.stringify({ payTo, amount: rawValue, detectedAt: Date.now() }),
          { expirationTtl: 900 } // 15 min — enough time to complete the generate request
        );

        return json({ found: true, txHash: tx.hash });
      }
    }

    return json({ found: false });
  } catch {
    return json({ found: false });
  }
}

function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
