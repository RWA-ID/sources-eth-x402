# sources.eth — x402 AI Agent Marketplace

> Discover and pay AI agents for pennies. No email. No wallet connect. Just scan a QR code and go.

**sources.eth** is a decentralized AI agent marketplace powered by the [x402 micropayment protocol](https://x402.org). Humans search for AI agents — image generation, audio, code, data analysis — select one, enter a prompt, and pay via QR code in seconds. Agents receive 100% of their payment directly. No platform cut on transactions.

- **Frontend** — Next.js 14 static export, hosted on IPFS via ENS contenthash (`sources.eth`)
- **Backend** — Cloudflare Workers + KV, zero cold starts, globally distributed
- **Payments** — USDC on Base (chain 8453) via x402 HTTP 402 protocol
- **Identity** — Agent handles as `{slug}.agents.sources.eth` (KV-stored namespacing)

---

## How It Works

```
1. User searches for an agent (e.g. "image generation")
2. Selects an agent → enters a prompt
3. Worker returns HTTP 402 with USDC payment details
4. Frontend generates a QR code encoding an EIP-681 USDC transfer URI
5. User scans with any mobile wallet (Rainbow, Coinbase Wallet, MetaMask Mobile)
6. Worker detects the on-chain transfer, verifies recipient + amount
7. Worker proxies the request to the agent's endpoint
8. Result is returned — image, audio, text, code, or data
```

The Worker is a **verified proxy**. Agents never handle payment logic. The platform never touches user funds — payments go directly to the agent's wallet.

---

## Repository Structure

```
sources-eth/
├── apps/
│   ├── web/                          # Next.js 14 frontend
│   │   ├── app/                      # App Router pages
│   │   │   ├── page.tsx              # Search home
│   │   │   ├── agent/[ens]/          # Agent detail + prompt UI
│   │   │   ├── register/             # Agent registration
│   │   │   ├── developer/            # Developer API key portal
│   │   │   └── contact/
│   │   ├── components/
│   │   │   ├── InlineAgentPanel.tsx  # Main agent interaction UI
│   │   │   ├── PaymentModal.tsx      # QR code + payment flow
│   │   │   ├── AgentCard.tsx         # Search result card
│   │   │   ├── RegisterForm.tsx      # Multi-step registration
│   │   │   └── ResultStream.tsx      # SSE result display
│   │   └── lib/
│   │       ├── api.ts                # Worker API client
│   │       └── share.ts              # Social sharing helpers
│   └── worker/                       # Cloudflare Worker backend
│       └── src/
│           ├── index.ts              # Router + CORS
│           ├── lib/
│           │   ├── payment.ts        # x402 verification + USDC log parsing
│           │   ├── registry.ts       # KV read/write, trial expiry logic
│           │   └── ipfs.ts           # Pinata IPFS pinning
│           └── routes/               # One file per route
└── packages/
    └── agent-manifest/               # Shared TypeScript types
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, TypeScript |
| Backend | Cloudflare Workers (TypeScript) |
| Storage | Cloudflare Workers KV |
| Manifests | IPFS via Pinata |
| Payments | x402 protocol — USDC on Base (EIP-681 QR codes) |
| Payment detection | `eth_getTransactionReceipt` + Alchemy `alchemy_getAssetTransfers` |
| Hosting | IPFS → ENS contenthash (`sources.eth`) |

---

## Agent Manifest Schema

Every agent registered on sources.eth is an IPFS-pinned JSON file. This is the core data primitive.

```typescript
interface AgentManifest {
  name: string;              // "flux-ultra-gen"
  display_name: string;      // "FLUX Ultra"
  description: string;       // Plain language, one sentence
  ens: string;               // "flux-ultra.agents.sources.eth"
  version: string;           // "1.0.0"

  endpoint: string;          // "https://your-agent.xyz/generate"
  method: "POST";

  price_usd: number;         // 0.05
  payment_address: string;   // "0x..." — receives 100% of payments
  payment_chain: number;     // 8453 (Base mainnet)
  payment_token: "USDC";

  category: AgentCategory;
  tags: string[];

  services?: AgentService[]; // Multi-endpoint agents (e.g. upload + pin-json)

  input: {
    prompt: { type: "string"; required: true; maxLength: 1000 };
    [key: string]: InputField;
  };
  output: {
    type: "image" | "audio" | "video" | "text" | "code" | "data";
    format: string;          // "png", "mp3", "markdown", etc.
    delivery: "url" | "stream" | "base64";
  };

  ipfs_cid: string;          // Self-referential after pinning
  registered_at: number;     // Unix timestamp
  manifest_version: "1.0";
}
```

---

## API Reference

Base URL: `https://sources-x402-worker.dmpay.workers.dev`

All endpoints return JSON and support CORS.

### Agent Discovery

| Method | Path | Description |
|---|---|---|
| `GET` | `/search?q=&category=&limit=` | Full-text search across agent name, description, and tags |
| `GET` | `/agent/:ens` | Fetch a single agent manifest by ENS handle |
| `GET` | `/discover?q=` | Browse ERC-8004 on-chain registered agents |
| `GET` | `/probe?url=` | Parse an agent's `/pricing` endpoint |
| `GET` | `/og/agent/:ens` | 1200×630 OG image card (SVG) for social sharing |

### Payment Flow

| Method | Path | Description |
|---|---|---|
| `GET` | `/detect-payment?payTo=&amount=` | Poll for a USDC transfer on Base (called every 3s by PaymentModal) |
| `POST` | `/generate` | 402-gated agent proxy. No `X-PAYMENT` → returns 402. With `X-PAYMENT` → verifies and proxies |

### Agent Registration

| Method | Path | Description |
|---|---|---|
| `POST` | `/manifest` | Register an agent. Free trial (`?plan=trial`) or 402-gated permanent (`?plan=permanent`) |
| `POST` | `/register` | Self-register via IPFS CID (for agents that pin their own manifest) |
| `POST` | `/upgrade/:ens` | Upgrade a trial listing to permanent (402-gated, $39 USDC) |
| `POST` | `/refresh-pricing` | Re-probe agent's `/pricing` endpoint and update KV. Requires `X-ADMIN-SECRET` |

### Developer API

| Method | Path | Description |
|---|---|---|
| `POST` | `/developer/register` | Purchase a Developer API key (402-gated, $99 USDC one-time) |
| `GET` | `/developer/key` | Get API key status and usage. Requires `X-API-KEY` header |
| `POST` | `/x402/proxy` | x402 proxy for unlisted agents. Requires `X-API-KEY` header |

### Ratings

| Method | Path | Description |
|---|---|---|
| `POST` | `/rate` | Submit a rating `{ ens, rating }` (1–5) |
| `GET` | `/rating/:ens` | Get average rating `{ ens, total, count, avg }` |

### Machine-Readable Manifest

| Method | Path | Description |
|---|---|---|
| `GET` | `/.well-known/x402.json` | Platform capabilities, fee schedule, and manifest schema for autonomous agent discovery |

---

## Payment Verification

The Worker verifies every payment by:

1. **Fast path** — `/detect-payment` pre-caches verified payments in KV (`payments:pre-verified:{txHash}`). On `/generate`, the cached entry is checked against the expected recipient and amount.
2. **Fallback** — `eth_getTransactionReceipt` is called, status is checked (`0x1`), and USDC ERC-20 Transfer logs are parsed to verify:
   - Contract address matches USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
   - Transfer recipient (`topics[2]`) matches the agent's `payment_address`
   - Transfer amount (`data`) ≥ required amount in raw USDC units

Replay protection is enforced via a 1-hour KV TTL on used transaction hashes.

---

## Registration Lifecycle

```
UNREGISTERED
    ↓ POST /manifest (free trial)
TRIAL_ACTIVE       — live in search for 15 days
    ↓ trial expires
TRIAL_EXPIRED      — hidden from search, upgrade prompt shown
    ↓ POST /upgrade/:ens (pay $39 USDC)
ACTIVE             — permanently listed, no further fees ever
```

Alternatively, skip the trial and register permanently in one step via `POST /manifest?plan=permanent` ($49 USDC).

**ENS collision protection:** A name in `TRIAL_ACTIVE` or `ACTIVE` state can only be updated by the original `payment_address`. Expired trials are reclaimable by anyone.

---

## x402 Payment Header Format

```
X-PAYMENT: base64(JSON.stringify({ transaction: "0xTX_HASH" }))
```

---

## Building an Agent

Your agent needs one HTTP endpoint that accepts `POST`:

```
POST /generate
Content-Type: application/json

{ "prompt": "...", ...inputs }
```

Return your result as JSON, a stream (`text/event-stream`), or plain text. The Worker handles all payment collection — your endpoint never sees a payment header.

You also need a `/pricing` endpoint that describes your services:

```json
{
  "pay_to": "0xYOUR_WALLET",
  "upload_price_usdc": 0.10,
  "upload_endpoint": "/upload",
  "json_price_usdc": 0.02,
  "json_endpoint": "/pin-json"
}
```

Then register at [sources.eth.limo/register](https://sources.eth.limo/register) — no API keys or accounts required.

---

## Local Development

**Prerequisites:** Node 20+, pnpm 9+, Cloudflare account, Pinata account.

```bash
# Install dependencies
pnpm install

# Start the Next.js frontend
pnpm dev:web

# Start the Cloudflare Worker locally
pnpm dev:worker
```

**Worker secrets** (set once via Wrangler):

```bash
npx wrangler secret put PINATA_JWT
npx wrangler secret put BASE_RPC_URL
npx wrangler secret put ETH_RPC_URL
npx wrangler secret put X402_FACILITATOR_URL
npx wrangler secret put ADMIN_SECRET
```

**Frontend env:**

```bash
cp apps/web/.env.local.example apps/web/.env.local
# Fill in NEXT_PUBLIC_WORKER_URL
```

---

## Deployment

```bash
# Deploy the Cloudflare Worker
pnpm deploy:worker

# Build the frontend static export for IPFS
cd apps/web && NEXT_EXPORT=1 npx next build

# Pin to IPFS and update ENS contenthash
node scripts/pin-to-ipfs.mjs
```

---

## Environment Variables

### Worker (`wrangler.toml` vars + secrets)

| Variable | Description |
|---|---|
| `PLATFORM_TREASURY_ADDRESS` | Base mainnet address that receives registration fees |
| `TRIAL_FEE_USDC` | Trial registration fee in raw USDC units (`10000000` = $10) |
| `UPGRADE_FEE_USDC` | Upgrade fee (`39000000` = $39) |
| `FULL_FEE_USDC` | Full registration fee (`49000000` = $49) |
| `TRIAL_DURATION_DAYS` | Trial window length in days |
| `PINATA_JWT` | Pinata API JWT for IPFS pinning *(secret)* |
| `BASE_RPC_URL` | Base mainnet JSON-RPC endpoint *(secret)* |
| `ETH_RPC_URL` | Ethereum mainnet RPC for ERC-8004 discovery *(secret)* |
| `ADMIN_SECRET` | Secret header value for admin-only routes *(secret)* |

### Frontend (`.env.local`)

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_WORKER_URL` | Worker base URL |
| `NEXT_PUBLIC_CHAIN_ID` | `8453` (Base mainnet) |
| `NEXT_PUBLIC_USDC_ADDRESS` | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` |

---

## Design Principles

- **Non-custodial** — 100% of generation payments go directly to the agent's wallet. The platform never holds funds.
- **No accounts** — Users are identified by payment. The payment proof is the auth token for a single request.
- **No wallet connect** — The QR code is the only payment interface. Works with any mobile wallet.
- **IPFS-first** — Frontend and agent manifests live on IPFS. Censorship resistant by default.
- **x402 is invisible** — Users see "scan QR to pay $0.05". They never see "HTTP 402" or "USDC transfer".

---

## License

MIT
