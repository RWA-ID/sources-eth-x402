# CLAUDE.md — sources.eth x402 Agent Marketplace

## Project Overview

You are building **sources.eth** — a decentralized AI agent search engine and marketplace powered by the x402 micropayment protocol. Humans search for AI agents (image gen, video, audio, code, data), select one, enter a prompt, and pay a micropayment via QR code. No wallet connection. No email sign-up. No redirects. Just pay and get the result.

**Brand architecture:**
- `sources.eth` → primary brand, consumer-facing search UI, hosted on IPFS via ENS contenthash
- `x402.sources.eth` → developer/agent subdomain, registration portal, protocol docs
- `pennies.ai` → future normie-facing domain, same backend, Phase 2

**Payment protocol:** x402 (HTTP 402 Payment Required) — USDC on Base (chain ID 8453), Lightning in v2.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), Tailwind CSS, TypeScript |
| Backend / 402 middleware | Cloudflare Workers (TypeScript) |
| Agent registry | Cloudflare Workers KV |
| Agent manifests | IPFS (pinned via Pinata API) |
| ENS / IPFS hosting | ENS contenthash → IPFS (same pattern as existing projects) |
| Payments | x402 protocol — USDC on Base via Coinbase x402 SDK |
| Identity | ENS names (agents register as `agentname.agents.sources.eth` subdomains) |
| Search index | Cloudflare Workers KV (MVP) → D1 SQLite (v2) |

---

## Repository Structure

```
sources-eth/
├── CLAUDE.md                    # This file
├── apps/
│   ├── web/                     # Next.js 14 frontend (sources.eth)
│   │   ├── app/
│   │   │   ├── page.tsx         # Search home
│   │   │   ├── agent/[ens]/     # Agent detail + prompt page
│   │   │   ├── register/        # Agent registration UI (x402.sources.eth)
│   │   │   └── layout.tsx
│   │   ├── components/
│   │   │   ├── SearchBar.tsx
│   │   │   ├── AgentCard.tsx
│   │   │   ├── PaymentModal.tsx  # QR code + 402 payment flow
│   │   │   ├── ResultStream.tsx  # SSE result streaming
│   │   │   └── RegisterForm.tsx
│   │   ├── lib/
│   │   │   ├── x402.ts          # x402 client helpers
│   │   │   ├── ipfs.ts          # IPFS/Pinata helpers
│   │   │   └── ens.ts           # ENS resolution helpers
│   │   └── public/
│   └── worker/                  # Cloudflare Workers backend
│       ├── src/
│       │   ├── index.ts         # Worker entry point + routing
│       │   ├── routes/
│       │   │   ├── search.ts    # GET /search?q=&category=
│       │   │   ├── agent.ts     # GET /agent/:ens
│       │   │   ├── register.ts  # POST /register (submit CID)
│       │   │   ├── generate.ts  # POST /generate — the 402-gated proxy
│       │   │   └── manifest.ts  # POST /manifest — generate + pin agent.json
│       │   ├── middleware/
│       │   │   └── x402.ts      # 402 request/verify middleware
│       │   └── lib/
│       │       ├── registry.ts  # KV read/write for agent index
│       │       ├── payment.ts   # Payment verification logic
│       │       └── ipfs.ts      # IPFS pinning via Pinata
│       └── wrangler.toml
├── packages/
│   └── agent-manifest/          # Shared TypeScript types for agent.json schema
│       └── src/
│           └── index.ts
└── package.json                 # Monorepo root (pnpm workspaces)
```

---

## Agent Manifest Schema

Every agent registered on sources.eth is an IPFS-pinned JSON file conforming to this schema. This is the core data primitive of the entire system.

```typescript
// packages/agent-manifest/src/index.ts

export interface AgentManifest {
  // Identity
  name: string                    // "flux-ultra-gen"
  display_name: string            // "FLUX Ultra"
  description: string             // One sentence, plain language
  ens: string                     // "flux-ultra.agents.sources.eth"
  version: string                 // "1.0.0"
  
  // Endpoint
  endpoint: string                // "https://your-agent.xyz/generate"
  method: "POST"                  // Always POST for MVP
  
  // Payment
  price_usd: number               // 0.05
  payment_address: string         // "0x..." or ENS name
  payment_chain: number           // 8453 (Base mainnet)
  payment_token: "USDC"           // USDC only for MVP
  
  // Categorization
  category: AgentCategory
  tags: string[]                  // ["photorealistic", "fast", "flux"]
  
  // I/O schema (simple for MVP)
  input: {
    prompt: { type: "string"; required: true; maxLength: 1000 }
    [key: string]: InputField
  }
  output: {
    type: "image" | "audio" | "video" | "text" | "code" | "data"
    format: string                // "png", "mp3", "mp4", "markdown", etc.
    delivery: "url" | "stream" | "base64"
  }
  
  // Quality signals
  sample_outputs?: string[]       // IPFS CIDs of sample outputs
  avg_latency_ms?: number
  
  // Metadata
  author_address?: string         // Optional, for attribution
  ipfs_cid: string                // Self-referential CID after pinning
  registered_at: number           // Unix timestamp
  manifest_version: "1.0"
}

export type AgentCategory = 
  | "image-generation"
  | "video-generation"
  | "audio-generation"
  | "text-generation"
  | "code-generation"
  | "data-analysis"
  | "3d-generation"
  | "other"

export interface InputField {
  type: "string" | "number" | "boolean" | "enum"
  required: boolean
  description?: string
  options?: string[]              // For enum types
  default?: unknown
}
```

---

## x402 Payment Flow (Critical — Read This Carefully)

This is the core protocol. Every paid interaction follows this exact sequence:

```
1. Frontend → POST /generate  { ens, prompt, ...inputs }
             (no payment header on first request — this is intentional)

2. Worker → 402 Payment Required
   {
     "x402Version": 1,
     "accepts": [{
       "scheme": "exact",
       "network": "base-mainnet", 
       "maxAmountRequired": "50000",       // $0.05 in USDC (6 decimals)
       "resource": "https://worker.sources.eth.workers.dev/generate",
       "description": "FLUX Ultra image generation",
       "mimeType": "application/json",
       "payTo": "0xAGENT_PAYMENT_ADDRESS",
       "maxTimeoutSeconds": 300,
       "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",  // USDC on Base
       "extra": {
         "name": "USD Coin",
         "version": "2"
       }
     }]
   }

3. Frontend renders QR code encoding EIP-681 URI:
   ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?
     to=0xAGENT_PAYMENT_ADDRESS&
     uint256=50000

4. Human scans QR with any mobile wallet (Rainbow, MetaMask Mobile, 
   Coinbase Wallet, etc.) and approves the transaction.

5. Frontend polls payment status OR listens for on-chain event.
   Once confirmed, frontend gets the payment proof (tx hash + signature).

6. Frontend → POST /generate  (same request, now with payment header)
   X-PAYMENT: <base64-encoded payment payload with tx proof>

7. Worker verifies payment on-chain via Base RPC → calls agent endpoint
   → streams result back to frontend via SSE or returns JSON with result URL.

8. Frontend displays result. Done.
```

**Key implementation notes:**
- Use `@coinbase/x402` npm package for the facilitator and verification logic
- The Worker acts as a **verified proxy** — it receives the 402, verifies payment, then forwards the request to the registered agent's endpoint
- Agent builders never handle payment verification themselves — the Worker does it
- Payment address in the 402 response is the **agent's** payment address from their manifest, NOT a platform address (non-custodial by design)

---

## Cloudflare Worker — Core Routes

### `GET /search`
```typescript
// Query params: q (string), category (AgentCategory), limit (number, default 20)
// Returns: AgentManifest[] sorted by relevance score
// Implementation: full-text search over KV-stored manifests
// MVP: simple tag/name matching; v2: proper search index via D1
```

### `POST /generate` — The 402-gated proxy
```typescript
// Body: { ens: string, prompt: string, ...agentInputs }
// 
// Step 1: Look up agent manifest from KV by ENS name
// Step 2: If no X-PAYMENT header → return 402 with agent's payment requirements
// Step 3: If X-PAYMENT header present → verify with x402 facilitator
// Step 4: If verified → forward request to agent.endpoint with prompt
// Step 5: Stream or return agent response to client
// 
// CRITICAL: Never accumulate payments. Route directly to agent's address.
// Platform fee (v2): deduct basis points before routing, not from escrow.
```

### `POST /register`
```typescript
// Body: { cid: string }  — the IPFS CID of the agent's manifest JSON
// 
// Step 1: Fetch and validate manifest from IPFS gateway
// Step 2: Validate schema against AgentManifest type
// Step 3: Validate endpoint responds (HEAD request)
// Step 4: Store in KV: key = manifest.ens, value = manifest JSON
// Step 5: Add to search index (tag-based KV keys for MVP)
// Step 6: Return { success: true, ens: manifest.ens }
// 
// No auth required — the manifest CID IS the identity proof
```

### `POST /manifest`
```typescript
// Body: AgentManifest (without ipfs_cid and registered_at)
// 
// Step 1: Validate all required fields
// Step 2: Add registered_at timestamp
// Step 3: Pin to IPFS via Pinata API (Worker → Pinata)
// Step 4: Add returned CID as ipfs_cid field
// Step 5: Auto-register (call /register internally)
// Step 6: Return { cid, ens, ipfs_url }
// 
// This is the "one-click register" path — builders fill the form,
// we handle the IPFS pinning, they get a CID back.
```

---

## Cloudflare Workers KV Schema

```
// Agent registry
kv:agents:{ens}                  → AgentManifest JSON
kv:agents:list:all               → string[] of all ENS keys
kv:agents:list:image-generation  → string[] filtered by category
kv:agents:list:audio-generation  → string[]
// ... one list key per AgentCategory

// Search index (MVP tag-based)
kv:tags:{tag}                    → string[] of ENS names with this tag

// Payment records (for deduplication / replay protection)
kv:payments:{txHash}             → { ens, timestamp, used: true }  TTL: 1 hour
```

---

## Frontend — Key Components

### `PaymentModal.tsx` — Most Important Component
This is where the magic happens for the user. Requirements:
- Receives `PaymentRequest` (the 402 response body) as a prop
- Generates QR code using `qrcode` npm package
- QR encodes the EIP-681 URI for USDC transfer on Base
- Shows: amount in USD, receiving agent name, estimated wait time
- **Payment method tabs**: USDC on Base (default), Lightning (v2/disabled)
- **Polling**: every 3 seconds call `GET /payment/status?txHash=...` 
- On confirmation: emit `onPaid(paymentProof)` event to parent
- No wallet connection UI — the QR IS the payment interface
- Works for crypto natives (they know what to do with a QR)
- Works for normies too — "scan this with your Coinbase Wallet app"

### `SearchBar.tsx`
- Single input, prominent, centered
- Category pills below (all / image / video / audio / text / code / data)
- Real-time search as user types (debounced 300ms)
- No submit button needed — results update live

### `AgentCard.tsx`
- Shows: icon (emoji from category), display_name, ens, description, price, avg_latency
- Click → navigate to `/agent/[ens]`
- Price badge in USDC equivalent always shown as USD ("$0.05")
- Never show raw USDC amounts to users in the search UI

### `RegisterForm.tsx`
- Multi-step form: (1) Basic info → (2) Endpoint + pricing → (3) Category + tags → (4) Pin + publish
- Step 4 calls `POST /manifest` which handles IPFS pinning
- Shows returned CID + IPFS gateway link on success
- Shows ENS subdomain that was assigned: `{name}.agents.sources.eth`
- No wallet required at any step

---

## Monetization Architecture

### Revenue Streams

| Stream | Model | Amount | Timeline |
|---|---|---|---|
| Trial registration | One-time trial fee | $10 USDC | MVP |
| Full registration | One-time permanent fee | $49 USDC ($10 credited) | MVP |
| Featured listings | Recurring sponsorship | TBD | Phase 2 |
| Premium placement | Pay-per-impression | TBD | Phase 3 |

### Trial → Full Registration Flow

Builders enter via a **$10 USDC trial** that activates a 5-day window. During the trial their agent is fully live and searchable. After 5 days they pay an additional **$39 USDC** to make the listing permanent ($10 already credited toward the $49 total). If they don't upgrade, the agent is hidden from search — but the manifest stays on IPFS and the registration record is preserved so upgrading later reactivates instantly without re-pinning.

**Registration state machine:**

```
UNREGISTERED
    ↓ pays $10 via x402
TRIAL_ACTIVE        → listed in search, full functionality, 5-day clock running
    ↓ 5 days pass without upgrade
TRIAL_EXPIRED       → hidden from search, upgrade prompt shown on agent page
    ↓ pays $39 via x402 (at any time, no deadline)
ACTIVE              → permanently listed, no further fees ever
```

**Implementation:**

```typescript
// worker/src/routes/manifest.ts

const TRIAL_FEE_USDC    = 10_000_000   // $10 — USDC has 6 decimals
const UPGRADE_FEE_USDC  = 39_000_000   // $39 — remainder to reach $49 total
const FULL_FEE_USDC     = 49_000_000   // $49 — if paying full without trial
const TRIAL_DURATION_MS = 5 * 24 * 60 * 60 * 1000  // 5 days in ms
const PLATFORM_TREASURY = "0xYOUR_TREASURY_ADDRESS"

// POST /manifest — no X-PAYMENT header:
// → return 402 with TRIAL_FEE_USDC payable to PLATFORM_TREASURY

// POST /manifest — X-PAYMENT header present, amount = TRIAL_FEE_USDC:
// → verify payment → pin manifest → register with status: "trial"
// → set trial_expires_at = now + TRIAL_DURATION_MS

// POST /upgrade/:ens — no X-PAYMENT header:
// → check agent exists and is in TRIAL_ACTIVE or TRIAL_EXPIRED state
// → return 402 with UPGRADE_FEE_USDC payable to PLATFORM_TREASURY

// POST /upgrade/:ens — X-PAYMENT header present:
// → verify payment → update status to "active" → restore search visibility
```

**KV schema for registration lifecycle:**
```
kv:registrations:{ens} → {
  ens: string
  tx_hash_trial: string       // $10 payment tx
  tx_hash_upgrade?: string    // $39 payment tx (set on upgrade)
  fee_paid_total: number      // 10 or 49
  status: "trial" | "trial_expired" | "active"
  trial_started_at: number    // unix ms
  trial_expires_at: number    // unix ms (trial_started_at + 5 days)
  upgraded_at?: number        // unix ms
}

kv:agents:{ens} → AgentManifest  // always present once registered
```

**Trial expiry check — runs on every `GET /search` and `GET /agent/:ens`:**
```typescript
// worker/src/lib/registry.ts

export async function getAgent(ens: string, kv: KVNamespace) {
  const reg = await kv.get(`registrations:${ens}`, 'json') as Registration
  if (!reg) return null

  // Auto-expire trials server-side on read
  if (reg.status === 'trial' && Date.now() > reg.trial_expires_at) {
    await kv.put(`registrations:${ens}`, JSON.stringify({ 
      ...reg, status: 'trial_expired' 
    }))
    return null  // hidden from search
  }

  if (reg.status === 'trial_expired') return null  // hidden

  return await kv.get(`agents:${ens}`, 'json') as AgentManifest
}
```

**No-email notification strategy:**
Since sources.eth has no accounts and collects no email, trial expiry is communicated via:
1. The agent's direct URL (`sources.eth/agent/{ens}`) shows an upgrade banner when trial is expired — builders bookmark this after registration
2. The registration success screen prominently shows the trial expiry date and the upgrade URL
3. The upgrade path works at any time after expiry — no deadline, no data loss

**What $10 trial gets the builder:**
- 5 days fully live in search — real traffic, real payments, real validation
- ENS subdomain: `{name}.agents.sources.eth`
- IPFS manifest pinning (permanent regardless of upgrade)
- Full x402 proxy infrastructure access

**What $49 permanent gets the builder:**
- Everything above, permanently
- No recurring fees, ever
- Priority consideration for featured placement (Phase 2)

**What sources.eth never takes:**
- No cut of per-transaction revenue — 100% of generation payments go to the agent's address
- No escrow, no custody, no platform wallet in the generation payment flow
- Registration fees are the only revenue sources.eth collects

### Featured Listings — Phase 2

Agents can pay to appear in sponsored slots at the top of search results and category pages. Build the KV schema now so it activates without refactoring.

```
kv:featured:{category}  → [{ ens, expires_at, slot: 1|2|3 }]
kv:featured:all         → [{ ens, expires_at, slot: 1|2|3 }]
```

Sponsored results must be visually labeled. Never disguise paid placement as organic ranking.

### Environment Variables for Monetization

```
PLATFORM_TREASURY_ADDRESS=      # Base mainnet address — receives all registration fees
TRIAL_FEE_USDC=10000000         # $10 in USDC (6 decimals)
UPGRADE_FEE_USDC=39000000       # $39 in USDC (6 decimals)
FULL_FEE_USDC=49000000          # $49 in USDC — for direct full registration
TRIAL_DURATION_DAYS=5           # Configurable without redeploy
```

---

## Social Sharing

Sharing is a core growth mechanic. Every result generated and every agent registered is a potential organic impression. Two distinct share surfaces exist: **user result sharing** and **builder agent sharing**.

### User Result Sharing

After a generation completes, the result screen shows share buttons. The share payload is pre-composed and platform-optimized.

**Share targets:** X (Twitter), TikTok, Instagram, Facebook

**Share payload per platform:**

```typescript
// lib/share.ts

export interface SharePayload {
  agentName: string        // "FLUX Ultra"
  agentEns: string         // "flux-ultra.agents.sources.eth"
  category: AgentCategory  // "image-generation"
  price: string            // "$0.05"
  resultUrl?: string       // IPFS URL of result (images/audio only)
  resultPreview?: string   // base64 thumbnail for OG image
}

export function buildShareText(payload: SharePayload): Record<ShareTarget, string> {
  const tag = `sources.eth`
  const link = `https://sources.eth.limo/agent/${payload.agentEns}`

  return {
    twitter: `Just generated this with ${payload.agentName} on @sourceseth\nCost me ${payload.price} — no account, no wallet connect, just a QR code\n\nTry it → ${link}`,
    tiktok:  `AI generation for ${payload.price} 👀 No signup needed ${link}`,
    instagram: `Generated with ${payload.agentName} on sources.eth\n${payload.price} · No account needed\n🔗 Link in bio`,
    facebook: `I just used an AI agent on sources.eth to generate this for ${payload.price}. No account, no wallet setup — just scanned a QR code and paid. Try it: ${link}`
  }
}

export type ShareTarget = 'twitter' | 'tiktok' | 'instagram' | 'facebook'
```

**Share URLs:**
```typescript
// X / Twitter — opens compose with pre-filled text
`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`

// Facebook
`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}&quote=${encodeURIComponent(text)}`

// TikTok — no direct web share API; copy text + open TikTok
// Show "copied to clipboard — open TikTok" UX

// Instagram — no web share API; copy text + show instructions
// Show "copied to clipboard — open Instagram" UX
// On mobile: use Web Share API (navigator.share) which includes Instagram
```

**Implementation notes:**
- On mobile, always try `navigator.share()` first — it opens the native share sheet which includes all installed apps including TikTok and Instagram natively
- Fall back to platform-specific URLs on desktop
- For image results: include the result IPFS URL as the shared image where the platform supports it
- For audio results: share a waveform preview image + the audio IPFS link
- The share component appears on the result screen after successful generation — never before payment confirmation

**`ResultShareBar` component:**
```typescript
// components/ResultShareBar.tsx
// Props: payload: SharePayload
// Renders: row of 4 platform buttons + "Copy link" button
// On click: opens share URL or copies text + shows platform instructions
// Mobile: navigator.share() sheet takes priority
```

### Builder Agent Sharing

After successful registration (trial or full), the success screen shows a dedicated share card for the builder to promote their agent.

**Builder share payload:**
```typescript
export function buildAgentShareText(manifest: AgentManifest): Record<ShareTarget, string> {
  const link = `https://sources.eth.limo/agent/${manifest.ens}`
  const price = `$${manifest.price_usd.toFixed(2)}`

  return {
    twitter: `My AI agent "${manifest.display_name}" is now live on sources.eth\n\n→ ${manifest.description}\n→ ${price} per generation\n→ No account needed to use it\n\nTry it: ${link}`,
    tiktok:  `My AI agent is live 🤖 ${price} per use, no signup needed ${link}`,
    instagram: `"${manifest.display_name}" is live on sources.eth\n${manifest.description}\n${price} per generation · no account needed\n🔗 Link in bio`,
    facebook: `I just listed my AI agent "${manifest.display_name}" on sources.eth. Anyone can use it for ${price} with no account or wallet setup — just scan a QR code. Check it out: ${link}`
  }
}
```

**Builder share card UI (`AgentShareCard` component):**
- Shows agent name, ENS, price, and description in a styled preview card
- "Share your agent" heading with the 4 platform buttons below
- "Copy agent link" button copies the direct sources.eth agent URL
- "Copy embed code" button (Phase 2) — iframe snippet for builders to embed on their own site
- Appears on the registration success screen AND on the agent's management page (`/agent/{ens}/manage`)

### OG Image Generation for Shares

For social shares to render rich previews, each agent page and result needs an OG image. Generate these dynamically via a Cloudflare Worker:

```
GET /og/agent/:ens      → returns a 1200×630 PNG with agent name, price, category icon
GET /og/result/:id      → returns the result itself (image) or a styled card (audio/text)
```

Use `@vercel/og` or Cloudflare's `html-rewriter` + canvas approach. Agent OG images are generated once and cached in KV. Result OG images are ephemeral (generated on demand, not stored).

```
kv:og:{ens}  → PNG buffer (cached agent OG image, regenerated on manifest update)
```

---

## Environment Variables

### Worker (wrangler.toml secrets)
```
PINATA_JWT=                      # Pinata API JWT for IPFS pinning
BASE_RPC_URL=                    # Base mainnet RPC (Alchemy or Infura)
X402_FACILITATOR_URL=            # Coinbase x402 facilitator endpoint
PLATFORM_TREASURY_ADDRESS=       # Base mainnet address — receives all registration fees
TRIAL_FEE_USDC=10000000          # $10 in USDC (6 decimals)
UPGRADE_FEE_USDC=39000000        # $39 in USDC — remainder to reach $49 total
FULL_FEE_USDC=49000000           # $49 in USDC — direct full registration path
TRIAL_DURATION_DAYS=5            # Configurable trial window without redeploy
```

### Web (`.env.local`)
```
NEXT_PUBLIC_WORKER_URL=          # https://sources.workers.dev
NEXT_PUBLIC_CHAIN_ID=8453        # Base mainnet
NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

---

## wrangler.toml

```toml
name = "sources-x402-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"
compatibility_flags = ["nodejs_compat"]

[[kv_namespaces]]
binding = "AGENTS_KV"
id = "YOUR_KV_NAMESPACE_ID"

[vars]
ENVIRONMENT = "production"

[[routes]]
pattern = "x402.sources.eth/*"
zone_name = "sources.eth"
```

---

## IPFS Deployment (Frontend)

The Next.js frontend must be exported as a static site for IPFS hosting:

```json
// next.config.js
{
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true }
}
```

Build and deploy:
```bash
pnpm build
# Upload ./out to IPFS via Pinata or web3.storage
# Update sources.eth ENS contenthash to ipfs://NEW_CID
# Use: ens.setContenthash(node, encode('ipfs', cid))
```

---

## MVP Build Order

Build in this exact sequence. Each step is independently deployable and testable.

### Step 1 — Worker scaffold + KV
- [ ] Init Cloudflare Worker with TypeScript + wrangler
- [ ] Create KV namespace
- [ ] Implement `POST /register` with manifest validation
- [ ] Implement `GET /search` with basic KV lookup
- [ ] Seed KV with 2-3 mock agent manifests for testing
- [ ] Deploy to workers.dev

### Step 2 — x402 middleware
- [ ] Install `@coinbase/x402` 
- [ ] Implement 402 response generation in `POST /generate`
- [ ] Implement payment header verification
- [ ] Implement payment deduplication via KV TTL
- [ ] Test full 402 cycle with a mock agent endpoint
- [ ] Implement proxy forwarding to agent endpoint on verified payment

### Step 3 — Frontend search UI
- [ ] Next.js 14 app with static export config
- [ ] `SearchBar` + `AgentCard` components
- [ ] Wire to Worker `GET /search`
- [ ] Category filtering
- [ ] Agent detail page `/agent/[ens]`

### Step 4 — Payment modal + QR
- [ ] `PaymentModal` component with QR generation
- [ ] EIP-681 URI construction for USDC on Base
- [ ] Payment status polling
- [ ] `ResultStream` component for SSE result display
- [ ] End-to-end test: search → select → prompt → pay → result

### Step 5 — Agent registration + trial flow
- [ ] `RegisterForm` multi-step component
- [ ] `POST /manifest` — 402-gated with TRIAL_FEE_USDC ($10)
- [ ] `POST /upgrade/:ens` — 402-gated with UPGRADE_FEE_USDC ($39)
- [ ] Registration KV lifecycle: trial → trial_expired → active
- [ ] Trial expiry check on every `GET /search` and `GET /agent/:ens`
- [ ] Success screen: CID, ENS subdomain, trial expiry date, upgrade CTA
- [ ] Agent management page `/agent/{ens}/manage` with upgrade prompt when expired
- [ ] `AgentShareCard` component on success screen

### Step 6 — Social sharing
- [ ] `lib/share.ts` — `buildShareText()` and `buildAgentShareText()` helpers
- [ ] `ResultShareBar` component — X, Facebook, TikTok, Instagram — appears after successful generation only
- [ ] X + Facebook via web intent URLs
- [ ] TikTok + Instagram via clipboard copy + instructions; `navigator.share()` on mobile
- [ ] `AgentShareCard` on registration success screen — builder promotes their agent
- [ ] `GET /og/agent/:ens` Worker route — 1200×630 OG image + KV cache
- [ ] OG meta tags on all agent pages for rich social link previews

### Step 7 — IPFS deploy
- [ ] Build static export
- [ ] Pin to IPFS
- [ ] Update sources.eth ENS contenthash
- [ ] Verify via ipfs.io gateway and eth.limo

---

## Design System

Follow the aesthetic established in the prototype:
- **Font**: Sora (display/UI) + DM Mono (addresses, prices, ENS names, technical labels)
- **Colors**: Dark theme first. Background `#0a0a0f`, surface `#111118`, border `rgba(255,255,255,0.07)`
- **Accent**: `#7c6aff` (purple) for interactive elements, `#4fd8b8` (teal) for prices and confirmations
- **Prices always in USD** (`$0.05`) in the UI — never show raw USDC amounts
- **ENS names** always in DM Mono, colored in accent purple
- **Zero jargon in copy**: "Pay", "Generate", "Get result" — not "Sign transaction", "Approve spend", "Gas fee"
- **QR code** is the only crypto-native element visible to end users

---

## Agent Builder Documentation (x402.sources.eth)

When you build the registration page, the copy for builders should explain:

**What you need to register:**
1. An HTTP endpoint that accepts POST requests with `{ prompt, ...inputs }`
2. A wallet address to receive payments (USDC on Base)
3. A price in USD (minimum $0.001)

**What sources.eth handles:**
- Payment collection and verification (x402 protocol)
- Search indexing and discoverability  
- IPFS manifest storage
- QR code generation for end users
- Subdomain: `yourname.agents.sources.eth`

**What you never need:**
- Accounts, API keys for sources.eth, or smart contracts
- Payment processing code (the Worker proxy handles it)
- Frontend or UI of any kind

---

## Key Constraints & Decisions

1. **Non-custodial by design**: The Worker routes payments directly to agent addresses. sources.eth never holds funds. This is architecturally enforced, not just a policy.

2. **No user accounts**: Users are identified only by payment. The payment proof IS the auth token for a single request.

3. **No wallet connect on the search UI**: The QR code is the only payment interface. Wallet connect is a v2 power-user feature, not MVP.

4. **IPFS-first**: Frontend lives on IPFS. Agent manifests live on IPFS. sources.eth is just an ENS pointer to IPFS content. This is censorship resistant by default.

5. **Cloudflare Workers as neutral infrastructure**: The Worker is stateless logic. KV is the only state. No database to manage, no servers to maintain.

6. **x402 is invisible to end users**: Users see "scan QR to pay $0.05". They never see "HTTP 402" or "USDC transfer" in the UI copy.

---

## Commands

```bash
# Install
pnpm install

# Dev
pnpm dev:web          # Next.js dev server
pnpm dev:worker       # wrangler dev --local

# Deploy
pnpm deploy:worker    # wrangler deploy
pnpm deploy:web       # build + pin to IPFS + update ENS contenthash

# Test
pnpm test             # vitest
pnpm test:e2e         # playwright
```

---

## Contact & ENS

- Main domain: `sources.eth`
- Protocol subdomain: `x402.sources.eth`  
- Agent registry subdomain: `agents.sources.eth`
- Future consumer domain: `pennies.ai` (Phase 2)
- Builder: `@ensgianteth`
