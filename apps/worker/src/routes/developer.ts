import type { Env } from "../lib/registry";
import { verifyPayment, markPaymentUsed, buildRegistration402Response } from "../lib/payment";

export interface ApiKey {
  key: string;
  label: string;
  payment_address: string;
  tx_hash: string;
  created_at: number;
  requests_total: number;
  active: boolean;
}

// Generate a cryptographically secure random API key
function generateApiKey(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const randomPart = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `sk_live_${randomPart}`;
}

export async function handleDeveloperRegister(
  request: Request,
  env: Env
): Promise<Response> {
  const API_KEY_FEE = "99000000"; // $99 USDC
  const paymentHeader = request.headers.get("X-PAYMENT");
  const resourceUrl = new URL(request.url).href;

  if (!paymentHeader) {
    return buildRegistration402Response(
      API_KEY_FEE,
      resourceUrl,
      env.PLATFORM_TREASURY_ADDRESS,
      "sources.eth — Developer API Key ($99 one-time)"
    );
  }

  const { valid, txHash, error } = await verifyPayment(paymentHeader, env, {
    payTo: env.PLATFORM_TREASURY_ADDRESS,
    amountRaw: API_KEY_FEE,
  });
  if (!valid || !txHash) {
    return new Response(JSON.stringify({ error: error ?? "Payment verification failed" }), {
      status: 402,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const body = await request.json() as { label?: string; payment_address?: string };

  const apiKey: ApiKey = {
    key: generateApiKey(),
    label: body.label ?? "My API Key",
    payment_address: body.payment_address ?? "",
    tx_hash: txHash,
    created_at: Date.now(),
    requests_total: 0,
    active: true,
  };

  await env.AGENTS_KV.put(`apikeys:${apiKey.key}`, JSON.stringify(apiKey));
  await markPaymentUsed(txHash, `apikey:${apiKey.key}`, env.AGENTS_KV);

  return new Response(
    JSON.stringify({ success: true, api_key: apiKey.key, label: apiKey.label }),
    {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    }
  );
}

export async function handleDeveloperKey(request: Request, env: Env): Promise<Response> {
  const apiKey = request.headers.get("X-API-KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "X-API-KEY header required" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const record = await env.AGENTS_KV.get<ApiKey>(`apikeys:${apiKey}`, "json");
  if (!record) {
    return new Response(JSON.stringify({ error: "Invalid API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  return new Response(
    JSON.stringify({
      label: record.label,
      created_at: record.created_at,
      requests_total: record.requests_total,
      active: record.active,
    }),
    {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    }
  );
}

export async function handleProxy(request: Request, env: Env): Promise<Response> {
  // Verify API key
  const apiKey = request.headers.get("X-API-KEY");
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "X-API-KEY header required" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const record = await env.AGENTS_KV.get<ApiKey>(`apikeys:${apiKey}`, "json");
  if (!record || !record.active) {
    return new Response(JSON.stringify({ error: "Invalid or inactive API key" }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const body = await request.json() as {
    endpoint: string;
    prompt: string;
    payment_address: string;
    price_usd: number;
    inputs?: Record<string, unknown>;
  };

  const { endpoint, prompt, payment_address, price_usd, inputs = {} } = body;

  if (!endpoint || !prompt || !payment_address || !price_usd) {
    return new Response(
      JSON.stringify({ error: "endpoint, prompt, payment_address, and price_usd are required" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  if (!endpoint.startsWith("https://")) {
    return new Response(JSON.stringify({ error: "endpoint must use HTTPS" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const paymentHeader = request.headers.get("X-PAYMENT");
  const amountRaw = Math.round(price_usd * 1_000_000).toString();

  // No payment yet — return 402
  if (!paymentHeader) {
    const body402 = {
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "base-mainnet",
          maxAmountRequired: amountRaw,
          resource: new URL(request.url).href,
          description: `x402 proxy → ${endpoint}`,
          mimeType: "application/json",
          payTo: payment_address,
          maxTimeoutSeconds: 300,
          asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          extra: { name: "USD Coin", version: "2" },
        },
      ],
    };

    return new Response(JSON.stringify(body402), {
      status: 402,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Verify payment — check it went to the right address for the right amount
  const { valid, txHash, error } = await verifyPayment(paymentHeader, env, {
    payTo: payment_address,
    amountRaw,
  });
  if (!valid || !txHash) {
    return new Response(JSON.stringify({ error: error ?? "Payment verification failed" }), {
      status: 402,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  await markPaymentUsed(txHash, `proxy:${apiKey}`, env.AGENTS_KV);

  // Increment usage counter
  await env.AGENTS_KV.put(
    `apikeys:${apiKey}`,
    JSON.stringify({ ...record, requests_total: record.requests_total + 1 })
  );

  // Forward to endpoint
  const agentResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-SOURCES-ETH": "1",
      "X-API-KEY-LABEL": record.label,
    },
    body: JSON.stringify({ prompt, ...inputs }),
  });

  if (!agentResponse.ok) {
    return new Response(
      JSON.stringify({ error: "Agent endpoint error", status: agentResponse.status }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  const contentType = agentResponse.headers.get("content-type") ?? "application/json";

  if (contentType.includes("text/event-stream")) {
    return new Response(agentResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const result = await agentResponse.json();
  return new Response(JSON.stringify(result), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
