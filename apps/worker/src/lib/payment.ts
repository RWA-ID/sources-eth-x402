import type { AgentManifest } from "@sources-eth/agent-manifest";
import type { Env } from "./registry";

export const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const BASE_CHAIN_ID = 8453;

export function build402Response(
  agent: AgentManifest,
  resourceUrl: string
): Response {
  const amountRaw = Math.round(agent.price_usd * 1_000_000).toString(); // USDC 6 decimals

  const body = {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "base-mainnet",
        maxAmountRequired: amountRaw,
        resource: resourceUrl,
        description: `${agent.display_name} — ${agent.description}`,
        mimeType: "application/json",
        payTo: agent.payment_address,
        maxTimeoutSeconds: 300,
        asset: USDC_BASE,
        extra: {
          name: "USD Coin",
          version: "2",
        },
      },
    ],
  };

  return new Response(JSON.stringify(body), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function buildRegistration402Response(
  amount: string,
  resourceUrl: string,
  treasury: string,
  description: string
): Response {
  const body = {
    x402Version: 1,
    accepts: [
      {
        scheme: "exact",
        network: "base-mainnet",
        maxAmountRequired: amount,
        resource: resourceUrl,
        description,
        mimeType: "application/json",
        payTo: treasury,
        maxTimeoutSeconds: 300,
        asset: USDC_BASE,
        extra: {
          name: "USD Coin",
          version: "2",
        },
      },
    ],
  };

  return new Response(JSON.stringify(body), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

interface PreVerified {
  payTo: string;
  amount: number;
  detectedAt: number;
}

export async function verifyPayment(
  paymentHeader: string,
  env: Env,
  expected?: { payTo: string; amountRaw: string }
): Promise<{ valid: boolean; txHash?: string; error?: string }> {
  try {
    // Decode the base64 payment header
    const decoded = atob(paymentHeader);
    const payload = JSON.parse(decoded);
    const txHash: string = payload.transaction || payload.txHash || payload.tx_hash;

    if (!txHash) {
      return { valid: false, error: "No transaction hash in payment header" };
    }

    const kv = env.AGENTS_KV as KVNamespace;

    // Check for replay (payment already used)
    const existing = await kv.get(`payments:${txHash}`);
    if (existing) {
      return { valid: false, error: "Payment already used" };
    }

    // Fast path: payment was pre-verified by /detect-payment and cached in KV —
    // no second RPC call needed. This keeps all payment logic in the worker.
    const preVerified = await kv.get<PreVerified>(`payments:pre-verified:${txHash}`, "json");
    if (preVerified) {
      if (expected) {
        if (preVerified.payTo.toLowerCase() !== expected.payTo.toLowerCase()) {
          return { valid: false, error: "Payment recipient mismatch" };
        }
        if (preVerified.amount < parseInt(expected.amountRaw, 10)) {
          return { valid: false, error: "Payment amount insufficient" };
        }
      }
      return { valid: true, txHash };
    }

    // Fallback: verify on-chain via Base RPC (for payments submitted without going
    // through /detect-payment, e.g. x402-native wallet clients)
    const rpcResponse = await fetch(env.BASE_RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getTransactionReceipt",
        params: [txHash],
        id: 1,
      }),
    });

    const rpcData = await rpcResponse.json() as {
      result: {
        status: string;
        logs: Array<{ address: string; topics: string[]; data: string }>;
      } | null;
    };

    if (!rpcData.result || rpcData.result.status !== "0x1") {
      return { valid: false, error: "Transaction not confirmed" };
    }

    if (expected) {
      // Find a USDC Transfer log that matches the expected recipient and amount
      const transferLog = rpcData.result.logs.find((log) => {
        if (log.address.toLowerCase() !== USDC_BASE.toLowerCase()) return false;
        if (log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) return false;
        if (!log.topics[2]) return false;
        const toAddr = "0x" + log.topics[2].slice(26).toLowerCase();
        if (toAddr !== expected.payTo.toLowerCase()) return false;
        return BigInt(log.data) >= BigInt(expected.amountRaw);
      });

      if (!transferLog) {
        return { valid: false, error: "No matching USDC transfer found in transaction" };
      }
    }

    return { valid: true, txHash };
  } catch {
    return { valid: false, error: "Payment verification failed" };
  }
}

export async function markPaymentUsed(
  txHash: string,
  ens: string,
  kv: KVNamespace
): Promise<void> {
  await kv.put(
    `payments:${txHash}`,
    JSON.stringify({ ens, timestamp: Date.now(), used: true }),
    { expirationTtl: 3600 } // 1 hour TTL
  );
}
