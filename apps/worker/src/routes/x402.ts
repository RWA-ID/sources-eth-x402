import type { Env } from "../lib/registry";
import { USDC_BASE } from "../lib/payment";

/**
 * GET/POST /x402 — Bazaar-discoverable x402 v2 endpoint.
 *
 * Returns HTTP 402 with:
 *   - `PAYMENT-REQUIRED` response header (base64-encoded PaymentRequired payload)
 *   - JSON body mirror of the same payload for clients that read body
 *   - Bazaar extension fields (info, output, schema, example) so it indexes
 *
 * Service offered: permanent agent listing on sources.eth ($49 USDC on Base).
 */
export async function handleX402(request: Request, env: Env): Promise<Response> {
  const resourceUrl = new URL(request.url).href;
  const treasury = env.PLATFORM_TREASURY_ADDRESS;
  const fullFeeUsdc = env.FULL_FEE_USDC; // "49000000" (6-decimal raw)

  const paymentHeader = request.headers.get("X-PAYMENT") ?? request.headers.get("PAYMENT");

  const payload = {
    x402Version: 2,
    error: "Payment required",
    resource: {
      url: resourceUrl,
      description:
        "Permanent agent listing on sources.eth - non-custodial marketplace for x402 AI agents. One-time fee, no recurring charges. Price $49 USDC on Base via x402. Lists your AI agent endpoint with an ENS subdomain and IPFS-pinned manifest. Discoverable on the sources.eth search index forever, no renewal fees.",
      mimeType: "application/json",
    },
    accepts: [
      {
        scheme: "exact",
        network: "eip155:8453",
        amount: fullFeeUsdc,
        asset: USDC_BASE,
        payTo: treasury,
        maxTimeoutSeconds: 300,
        extra: {
          name: "USD Coin",
          version: "2",
        },
      },
    ],
    extensions: {
      bazaar: {
        info: {
          input: {
            type: "http",
            method: "POST",
            bodyType: "json",
            body: {
              name: "my-agent",
              display_name: "My Agent",
              description: "What my agent does in one sentence.",
              endpoint: "https://my-agent.example.com/generate",
              price_usd: 0.05,
              payment_address: "0x0000000000000000000000000000000000000000",
              category: "generative-media",
              tags: ["image", "ai"],
            },
          },
          output: {
            type: "json",
            example: {
              success: true,
              ens: "my-agent.agents.sources.eth",
              cid: "bafybeigdyrzljw5q2zwwxgkkjbfh4xpz4f4qf7mflyhqlbvk2qhpxz5u4q",
              status: "active",
              tx_hash: "0x82c8f9a30000000000000000000000000000000000000000000000000000f9a3",
            },
          },
        },
        schema: {
          $schema: "https://json-schema.org/draft/2020-12/schema",
          type: "object",
          properties: {
            input: {
              type: "object",
              properties: {
                type: { type: "string", const: "http" },
                method: { type: "string", enum: ["POST"] },
                bodyType: { type: "string", enum: ["json", "form-data", "text"] },
                body: {
                  type: "object",
                  properties: {
                    name: { type: "string", description: "Slug for ENS subdomain (a-z, 0-9, hyphen)" },
                    display_name: { type: "string" },
                    description: { type: "string" },
                    endpoint: { type: "string", format: "uri" },
                    price_usd: { type: "number", minimum: 0.001 },
                    payment_address: { type: "string", description: "Base mainnet address to receive USDC" },
                    category: { type: "string" },
                    tags: { type: "array", items: { type: "string" } },
                  },
                  required: ["name", "display_name", "description", "endpoint", "price_usd", "payment_address", "category"],
                },
              },
              required: ["type", "method", "bodyType", "body"],
              additionalProperties: false,
            },
            output: {
              type: "object",
              properties: {
                type: { type: "string" },
                example: { type: "object" },
              },
              required: ["type"],
            },
          },
          required: ["input"],
        },
      },
    },
  };

  // If a payment header was supplied, redirect the client to the real registration endpoint.
  // The Bazaar validator never sends one; this is a courtesy for paid clients.
  if (paymentHeader) {
    return new Response(
      JSON.stringify({
        message:
          "To complete a permanent listing, POST your manifest to /manifest?plan=permanent with the same X-PAYMENT header.",
        next_url: `${new URL(request.url).origin}/manifest?plan=permanent`,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }

  const bodyJson = JSON.stringify(payload);
  // Unicode-safe base64: encode to UTF-8 bytes then to base64.
  // btoa() only accepts Latin-1, so we go through TextEncoder first.
  const bytes = new TextEncoder().encode(bodyJson);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  const headerB64 = btoa(binary);

  return new Response(bodyJson, {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "PAYMENT-REQUIRED": headerB64,
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Expose-Headers": "PAYMENT-REQUIRED",
      "Cache-Control": "no-store",
    },
  });
}
