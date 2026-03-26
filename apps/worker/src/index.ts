import type { Env } from "./lib/registry";
import { handleSearch } from "./routes/search";
import { handleGetAgent } from "./routes/agent";
import { handleGenerate } from "./routes/generate";
import { handleManifest, handleRegister, handleUpgrade } from "./routes/manifest";
import { handleRate, handleGetRating } from "./routes/rating";
import { handleDeveloperRegister, handleDeveloperKey, handleProxy } from "./routes/developer";
import { handleOgAgent } from "./routes/og";
import { handleProbe } from "./routes/probe";
import { handleDiscover } from "./routes/discover";
import { handleDetectPayment } from "./routes/detect-payment";
import { handleImportAgent } from "./routes/import-agent";
import { handleRefreshPricing } from "./routes/refresh-pricing";

function cors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, X-PAYMENT, X-API-KEY");
  return new Response(response.body, { status: response.status, headers });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const method = request.method;

    // CORS preflight
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-PAYMENT, X-API-KEY",
        },
      });
    }

    const path = url.pathname;

    // GET /search
    if (method === "GET" && path === "/search") {
      return cors(await handleSearch(request, env));
    }

    // GET /agent/:ens
    const agentMatch = path.match(/^\/agent\/(.+)$/);
    if (method === "GET" && agentMatch) {
      return cors(await handleGetAgent(agentMatch[1], env));
    }

    // POST /generate
    if (method === "POST" && path === "/generate") {
      return cors(await handleGenerate(request, env));
    }

    // POST /manifest — 402-gated registration
    if (method === "POST" && path === "/manifest") {
      return cors(await handleManifest(request, env));
    }

    // POST /register — register by CID
    if (method === "POST" && path === "/register") {
      return cors(await handleRegister(request, env));
    }

    // POST /upgrade/:ens
    const upgradeMatch = path.match(/^\/upgrade\/(.+)$/);
    if (method === "POST" && upgradeMatch) {
      return cors(await handleUpgrade(upgradeMatch[1], request, env));
    }

    // POST /rate
    if (method === "POST" && path === "/rate") {
      return cors(await handleRate(request, env));
    }

    // GET /rating/:ens
    const ratingMatch = path.match(/^\/rating\/(.+)$/);
    if (method === "GET" && ratingMatch) {
      return cors(await handleGetRating(ratingMatch[1], env));
    }

    // POST /developer/register — 402-gated API key purchase
    if (method === "POST" && path === "/developer/register") {
      return cors(await handleDeveloperRegister(request, env));
    }

    // GET /developer/key — key status + usage
    if (method === "GET" && path === "/developer/key") {
      return cors(await handleDeveloperKey(request, env));
    }

    // POST /x402/proxy — unlisted agent proxy
    if (method === "POST" && path === "/x402/proxy") {
      return cors(await handleProxy(request, env));
    }

    // GET /probe — fetch and parse agent pricing endpoint
    if (method === "GET" && path === "/probe") {
      return cors(await handleProbe(request, env));
    }

    // GET /discover — ERC-8004 registry discovery
    if (method === "GET" && path === "/discover") {
      return cors(await handleDiscover(request, env));
    }

    // GET /detect-payment — auto-detect USDC payment on Base
    if (method === "GET" && path === "/detect-payment") {
      return cors(await handleDetectPayment(request, env));
    }

    // GET /import-agent — fetch ERC-8004 agent data for register form pre-fill
    if (method === "GET" && path === "/import-agent") {
      return cors(await handleImportAgent(request, env));
    }

    // POST /refresh-pricing — probe agent and update per-service prices in KV
    if (method === "POST" && path === "/refresh-pricing") {
      return cors(await handleRefreshPricing(request, env));
    }

    // GET /og/agent/:ens — OG image (SVG card)
    const ogMatch = path.match(/^\/og\/agent\/(.+)$/);
    if (method === "GET" && ogMatch) {
      return await handleOgAgent(ogMatch[1], env);
    }

    // GET /.well-known/x402.json — machine-readable registration manifest
    if (method === "GET" && path === "/.well-known/x402.json") {
      const workerUrl = "https://sources-x402-worker.dmpay.workers.dev";
      return new Response(
        JSON.stringify({
          name: "sources.eth",
          description: "Decentralized AI agent marketplace. List your agent to receive x402 micropayments from humans and other agents.",
          version: "1.0",
          register_endpoint: `${workerUrl}/manifest`,
          plans: {
            trial: {
              description: "Free 15-day trial — fully live in search immediately",
              method: "POST",
              url: `${workerUrl}/manifest`,
              payment_required: false,
              duration_days: parseInt(env.TRIAL_DURATION_DAYS, 10),
            },
            permanent: {
              description: "Permanent listing — no recurring fees, ever",
              method: "POST",
              url: `${workerUrl}/manifest?plan=permanent`,
              payment_required: true,
              fee_usdc: parseInt(env.FULL_FEE_USDC, 10) / 1_000_000,
              payment_chain: 8453,
              payment_asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              payment_network: "base-mainnet",
            },
            upgrade: {
              description: "Upgrade trial to permanent",
              method: "POST",
              url: `${workerUrl}/upgrade/:ens`,
              payment_required: true,
              fee_usdc: parseInt(env.UPGRADE_FEE_USDC, 10) / 1_000_000,
              payment_chain: 8453,
              payment_asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
              payment_network: "base-mainnet",
            },
          },
          manifest_schema: {
            required: ["name", "display_name", "description", "ens", "version", "endpoint", "method", "price_usd", "payment_address", "payment_chain", "payment_token", "category", "tags", "input", "output"],
            ens_format: "{slug}.agents.sources.eth",
            payment_token: "USDC",
            payment_chain: 8453,
            min_price_usd: 0.001,
            endpoint_requirements: "Must return HTTP 402 on GET with x402 payment terms",
          },
          discovery: {
            search: `${workerUrl}/search?q={query}`,
            browse: `${workerUrl}/discover`,
            agent: `${workerUrl}/agent/{ens}`,
          },
          x402_payment_proof_format: "base64(JSON.stringify({ transaction: '0xTX_HASH' }))",
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600",
          },
        }
      );
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  },
} satisfies ExportedHandler<Env>;
