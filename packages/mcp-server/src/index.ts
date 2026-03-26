#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const WORKER_URL =
  process.env.SOURCES_ETH_WORKER_URL ??
  "https://sources-x402-worker.dmpay.workers.dev";

const CATEGORIES = [
  "generative-media", "text-content", "ai-assistants", "coding-dev",
  "data-analytics", "payments-finance", "identity-verification",
  "security-compliance", "audio-voice", "ecommerce", "workflow-automation",
  "knowledge-search", "legal-ai", "medical-health", "real-estate",
  "accounting-finance", "other",
] as const;

// ─── Manifest builder ─────────────────────────────────────────────────────────

interface ManifestArgs {
  name: string;
  display_name: string;
  description: string;
  endpoint: string;
  price_usd: number;
  payment_address: string;
  category: string;
  tags?: string;
  favicon_url?: string;
}

function buildManifest(a: ManifestArgs) {
  const slug = a.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return {
    name: slug,
    display_name: a.display_name,
    description: a.description,
    ens: `${slug}.agents.sources.eth`,
    version: "1.0.0",
    endpoint: a.endpoint,
    method: "POST",
    price_usd: Number(a.price_usd),
    payment_address: a.payment_address,
    payment_chain: 8453,
    payment_token: "USDC",
    category: a.category,
    tags: a.tags
      ? a.tags.split(",").map((t: string) => t.trim()).filter(Boolean)
      : [],
    input: { prompt: { type: "string", required: true, maxLength: 1000 } },
    output: { type: "text", format: "json", delivery: "url" },
    ...(a.favicon_url ? { favicon_url: a.favicon_url } : {}),
  };
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = new Server(
  { name: "sources-eth", version: "0.1.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "get_pricing",
      description:
        "Get current pricing for listing an AI agent on sources.eth. " +
        "Returns trial ($10/15 days) and permanent ($49 one-time) options.",
      inputSchema: { type: "object", properties: {} },
    },
    {
      name: "check_name",
      description:
        "Check whether an agent name is available on sources.eth. " +
        "Returns the agent handle that would be assigned and whether it's already taken.",
      inputSchema: {
        type: "object",
        required: ["name"],
        properties: {
          name: {
            type: "string",
            description: "Agent slug to check (e.g. 'my-image-agent')",
          },
        },
      },
    },
    {
      name: "register_agent",
      description:
        "Start agent registration on sources.eth. " +
        "Returns the payment requirements (amount, address, EIP-681 URI). " +
        "After paying, call complete_registration with the X-PAYMENT proof.",
      inputSchema: {
        type: "object",
        required: [
          "name", "display_name", "description",
          "endpoint", "price_usd", "payment_address", "category",
        ],
        properties: {
          name: { type: "string", description: "Slug (lowercase, hyphens OK). E.g. 'flux-ultra-gen'" },
          display_name: { type: "string", description: "Human-readable name. E.g. 'FLUX Ultra'" },
          description: { type: "string", description: "One sentence describing what the agent does" },
          endpoint: { type: "string", description: "HTTPS POST endpoint that accepts { prompt, ...inputs }" },
          price_usd: { type: "number", description: "Price per generation in USD (minimum 0.001)" },
          payment_address: { type: "string", description: "Base mainnet wallet address to receive generation payments" },
          category: {
            type: "string",
            enum: CATEGORIES as unknown as string[],
            description: "Agent category",
          },
          tags: { type: "string", description: "Comma-separated tags. E.g. 'photorealistic, fast, flux'" },
          favicon_url: { type: "string", description: "Logo/favicon URL (optional, recommended for branding)" },
          plan: {
            type: "string",
            enum: ["trial", "permanent"],
            description: "trial = $10 for 15 days (upgrade later for $39), permanent = $49 one-time forever. Default: permanent",
          },
        },
      },
    },
    {
      name: "complete_registration",
      description:
        "Complete agent registration after payment. " +
        "Pass the same manifest fields as register_agent plus the X-PAYMENT proof string.",
      inputSchema: {
        type: "object",
        required: [
          "name", "display_name", "description",
          "endpoint", "price_usd", "payment_address", "category",
          "payment_proof",
        ],
        properties: {
          name: { type: "string" },
          display_name: { type: "string" },
          description: { type: "string" },
          endpoint: { type: "string" },
          price_usd: { type: "number" },
          payment_address: { type: "string" },
          category: { type: "string", enum: CATEGORIES as unknown as string[] },
          tags: { type: "string" },
          favicon_url: { type: "string" },
          plan: { type: "string", enum: ["trial", "permanent"] },
          payment_proof: {
            type: "string",
            description: "The X-PAYMENT header value returned by the x402 facilitator after payment",
          },
        },
      },
    },
    {
      name: "get_agent",
      description: "Look up a registered agent by handle or slug.",
      inputSchema: {
        type: "object",
        required: ["ens"],
        properties: {
          ens: {
            type: "string",
            description: "Full handle (e.g. 'flux-ultra-gen.agents.sources.eth') or just the slug ('flux-ultra-gen')",
          },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  // ── get_pricing ─────────────────────────────────────────────────────────────
  if (name === "get_pricing") {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              trial: {
                price_usd: 10,
                duration_days: 15,
                upgrade_fee_usd: 39,
                description:
                  "15-day fully live trial. Upgrade for $39 to go permanent ($10 credited toward $49 total).",
              },
              permanent: {
                price_usd: 49,
                description:
                  "Permanent listing. No recurring fees, ever. $10 trial credited if already trialed.",
              },
              developer_api: {
                price_usd: 99,
                billing: "per year",
                description:
                  "Proxy any AI endpoint via x402 without listing. Unlimited requests.",
              },
              payment: "USDC on Base mainnet (chain 8453). No wallet connection needed — pay by QR scan or programmatic transfer.",
              note: "100% of generation fees go directly to the agent's payment_address. sources.eth takes no cut per transaction.",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  // ── check_name ──────────────────────────────────────────────────────────────
  if (name === "check_name") {
    const { name: agentName } = args as { name: string };
    const slug = agentName.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const ens = `${slug}.agents.sources.eth`;

    try {
      const res = await fetch(`${WORKER_URL}/agent/${ens}`);
      if (res.status === 404) {
        return {
          content: [
            {
              type: "text",
              text: `✓ Available\n\nHandle: \`${ens}\`\nSlug: \`${slug}\`\n\nThis name is free to register.`,
            },
          ],
        };
      }
      const manifest = await res.json();
      return {
        content: [
          {
            type: "text",
            text: `✗ Already registered\n\n\`${ens}\` is taken.\n\n${JSON.stringify(manifest, null, 2)}`,
          },
        ],
      };
    } catch {
      return {
        content: [{ type: "text", text: `Could not reach sources.eth worker at ${WORKER_URL}` }],
        isError: true,
      };
    }
  }

  // ── register_agent ──────────────────────────────────────────────────────────
  if (name === "register_agent") {
    const a = args as unknown as ManifestArgs & { plan?: string };
    const plan = a.plan === "trial" ? "trial" : "permanent";
    const manifest = buildManifest(a);

    let res: Response;
    try {
      res = await fetch(`${WORKER_URL}/manifest?plan=${plan}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(manifest),
      });
    } catch {
      return {
        content: [{ type: "text", text: `Could not reach sources.eth worker at ${WORKER_URL}` }],
        isError: true,
      };
    }

    if (res.status === 402) {
      const req402 = await res.json() as {
        accepts: Array<{
          payTo: string;
          maxAmountRequired: string;
          asset: string;
          network: string;
        }>;
      };
      const accept = req402.accepts[0];
      const amount_usd = plan === "permanent" ? 49 : 10;
      const eip681 = `ethereum:${accept.asset}@8453/transfer?to=${accept.payTo}&uint256=${accept.maxAmountRequired}`;

      return {
        content: [
          {
            type: "text",
            text: [
              `## Payment Required — $${amount_usd} USDC on Base`,
              ``,
              `Send exactly **${accept.maxAmountRequired} units** ($${amount_usd} USDC, 6 decimals) to:`,
              ``,
              `- **Token (USDC on Base):** \`${accept.asset}\``,
              `- **Recipient:** \`${accept.payTo}\``,
              `- **Network:** Base mainnet · chain ID 8453`,
              ``,
              `**EIP-681 payment URI** (encode as QR for mobile wallets):`,
              `\`\`\``,
              eip681,
              `\`\`\``,
              ``,
              `**After paying:**`,
              `Get the \`X-PAYMENT\` proof string from the x402 facilitator at https://facilitator.coinbase.com, then call \`complete_registration\` with the same manifest fields plus \`payment_proof\`.`,
              ``,
              `**Manifest that will be pinned:**`,
              `\`\`\`json`,
              JSON.stringify(manifest, null, 2),
              `\`\`\``,
            ].join("\n"),
          },
        ],
      };
    }

    // Unexpected non-402 response
    const body = await res.text();
    return {
      content: [{ type: "text", text: `Unexpected response ${res.status}: ${body}` }],
      isError: true,
    };
  }

  // ── complete_registration ───────────────────────────────────────────────────
  if (name === "complete_registration") {
    const a = args as unknown as ManifestArgs & { plan?: string; payment_proof: string };
    const plan = a.plan === "trial" ? "trial" : "permanent";
    const manifest = buildManifest(a);

    let res: Response;
    try {
      res = await fetch(`${WORKER_URL}/manifest?plan=${plan}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT": a.payment_proof,
        },
        body: JSON.stringify(manifest),
      });
    } catch {
      return {
        content: [{ type: "text", text: `Could not reach sources.eth worker at ${WORKER_URL}` }],
        isError: true,
      };
    }

    if (!res.ok) {
      const err = await res.json() as { error: string };
      return {
        content: [{ type: "text", text: `Registration failed (${res.status}): ${err.error}` }],
        isError: true,
      };
    }

    const result = await res.json() as {
      success: boolean;
      cid: string;
      ens: string;
      ipfs_url: string;
      trial_expires_at: number | null;
      status: string;
    };

    const isPermanent = result.status === "active";
    const expiryLine = result.trial_expires_at
      ? `**Trial expires:** ${new Date(result.trial_expires_at).toLocaleDateString()}`
      : "";

    return {
      content: [
        {
          type: "text",
          text: [
            `## Agent registered! 🎉`,
            ``,
            `**Handle:** \`${result.ens}\``,
            `**Status:** ${isPermanent ? "Permanent listing ✓" : "Trial active"}`,
            `**IPFS CID:** \`${result.cid}\``,
            `**IPFS manifest:** ${result.ipfs_url}`,
            expiryLine,
            ``,
            `**Live at:** https://sources.eth.limo/agent/${result.ens}`,
            ``,
            isPermanent
              ? "Your agent is permanently listed. No recurring fees, ever."
              : `Your 15-day trial is running. Upgrade at https://sources.eth.limo/agent/${result.ens} for $39 to list permanently.`,
          ]
            .filter((l) => l !== undefined)
            .join("\n"),
        },
      ],
    };
  }

  // ── get_agent ───────────────────────────────────────────────────────────────
  if (name === "get_agent") {
    const { ens: input } = args as { ens: string };
    const ens = input.includes(".") ? input : `${input}.agents.sources.eth`;

    try {
      const res = await fetch(`${WORKER_URL}/agent/${ens}`);
      if (res.status === 404) {
        return {
          content: [{ type: "text", text: `No agent found for \`${ens}\`` }],
        };
      }
      const manifest = await res.json();
      return {
        content: [{ type: "text", text: JSON.stringify(manifest, null, 2) }],
      };
    } catch {
      return {
        content: [{ type: "text", text: `Could not reach sources.eth worker at ${WORKER_URL}` }],
        isError: true,
      };
    }
  }

  return {
    content: [{ type: "text", text: `Unknown tool: ${name}` }],
    isError: true,
  };
});

// ─── Start ────────────────────────────────────────────────────────────────────

const transport = new StdioServerTransport();
await server.connect(transport);
