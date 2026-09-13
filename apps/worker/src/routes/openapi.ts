import type { Env } from "../lib/registry";
import { USDC_BASE } from "../lib/payment";

/**
 * GET /openapi.json — discovery contract for x402scan and other agent crawlers.
 *
 * Declares payable operations with x-payment-info + 402 responses, and an
 * input schema for each invocable route, per agentcash discovery spec.
 */
export async function handleOpenApi(request: Request, env: Env): Promise<Response> {
  const origin = new URL(request.url).origin;
  const fullFeeUsd = (parseInt(env.FULL_FEE_USDC, 10) / 1_000_000).toFixed(2);

  const x402Protocol = [{ x402: {} }];

  const manifestInputSchema = {
    type: "object",
    required: [
      "name",
      "display_name",
      "description",
      "endpoint",
      "price_usd",
      "payment_address",
      "category",
    ],
    properties: {
      name: {
        type: "string",
        description: "Slug for ENS subdomain (a-z, 0-9, hyphen).",
      },
      display_name: { type: "string" },
      description: { type: "string" },
      endpoint: {
        type: "string",
        format: "uri",
        description: "HTTPS URL that accepts POST { prompt, ...inputs }.",
      },
      price_usd: {
        type: "number",
        minimum: 0.001,
        description: "Price per generation, in USD.",
      },
      payment_address: {
        type: "string",
        description: "Base mainnet address to receive USDC payments.",
      },
      payment_chain: { type: "integer", const: 8453 },
      payment_token: { type: "string", const: "USDC" },
      category: {
        type: "string",
        enum: [
          "image-generation",
          "video-generation",
          "audio-generation",
          "text-generation",
          "code-generation",
          "data-analysis",
          "3d-generation",
          "generative-media",
          "other",
        ],
      },
      tags: { type: "array", items: { type: "string" } },
    },
  };

  const spec = {
    openapi: "3.1.0",
    info: {
      title: "sources.eth x402 Marketplace",
      version: "1.0.0",
      description:
        "Decentralized AI agent marketplace powered by x402 micropayments. Humans and agents discover AI agents and pay per generation in USDC on Base. Non-custodial: payments route directly to agent addresses.",
      "x-guidance":
        "Use /search to discover agents (free). Use /agent/{ens} to fetch a manifest (free). Use /generate to invoke an agent — the price is set by the agent's manifest, paid via x402 (USDC on Base, chain 8453). To list a new agent permanently, POST to /x402 or /manifest?plan=permanent with a $49 USDC payment. To upgrade a trial listing, POST to /upgrade/{ens} with $39 USDC. All paid routes return HTTP 402 with x402 v2 payment terms when no X-PAYMENT header is supplied.",
      contact: { name: "sources.eth", url: "https://sources.eth.limo" },
    },
    servers: [{ url: origin }],
    paths: {
      "/x402": {
        post: {
          summary: "Register a permanent agent listing on sources.eth",
          description:
            "Pays $49 USDC on Base for a permanent, non-recurring listing on the sources.eth marketplace. Returns HTTP 402 with x402 v2 payment terms when no X-PAYMENT header is supplied. After paying, POST the same X-PAYMENT header to /manifest?plan=permanent to complete pinning of the AgentManifest to IPFS and registration.",
          requestBody: {
            required: true,
            content: {
              "application/json": { schema: manifestInputSchema },
            },
          },
          "x-payment-info": {
            price: { mode: "fixed", currency: "USD", amount: fullFeeUsd },
            protocols: x402Protocol,
          },
          responses: {
            "200": { description: "Listing created" },
            "402": { description: "Payment Required" },
          },
        },
      },
    },
    components: {
      schemas: {
        AgentManifest: manifestInputSchema,
      },
    },
    "x-x402": {
      version: 2,
      network: "eip155:8453",
      asset: USDC_BASE,
      payTo: env.PLATFORM_TREASURY_ADDRESS,
    },
  };

  return new Response(JSON.stringify(spec), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=300",
    },
  });
}
