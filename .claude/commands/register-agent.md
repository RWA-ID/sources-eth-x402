Help the builder register their AI agent on sources.eth. Follow these steps exactly.

## Step 1 — Collect agent details

Ask the builder for the following. If any are already provided in $ARGUMENTS, skip asking for them.

**Required:**
- `name` — slug for the agent handle (lowercase, hyphens). E.g. `my-image-agent`
- `display_name` — human-readable name. E.g. `My Image Agent`
- `description` — one sentence describing what the agent does
- `endpoint` — the HTTPS POST URL that accepts `{ prompt, ...inputs }` and returns results
- `price_usd` — price per generation in USD (minimum $0.001). Ask: "How much should users pay per generation?"
- `payment_address` — Base mainnet wallet address where generation payments go (this is YOUR address, 100% goes to you)
- `category` — one of: generative-media, text-content, ai-assistants, coding-dev, data-analytics, payments-finance, identity-verification, security-compliance, audio-voice, ecommerce, workflow-automation, knowledge-search, legal-ai, medical-health, real-estate, accounting-finance, other

**Optional:**
- `tags` — comma-separated tags for search (e.g. `fast, photorealistic, flux`)
- `favicon_url` — logo URL for branding in search results

**Plan** — present these two options clearly:
- **Trial — $10 USDC** · 15-day fully live listing. Upgrade for $39 to go permanent ($10 credited). Good for testing the market.
- **Permanent — $49 USDC** · Listed forever, no recurring fees. Best value if you're confident in your agent.

## Step 2 — Confirm before proceeding

Show a summary of everything and ask the builder to confirm before making any API calls.

Include:
- Agent handle: `{name}.agents.sources.eth`
- All manifest fields
- Selected plan and registration fee

## Step 3 — Initiate registration (get payment requirements)

Call the sources.eth worker to get payment requirements:

```
POST https://sources-x402-worker.dmpay.workers.dev/manifest?plan={plan}
Content-Type: application/json

{manifest JSON}
```

The worker will return HTTP 402 with a payment object like:
```json
{
  "x402Version": 1,
  "accepts": [{
    "scheme": "exact",
    "network": "base-mainnet",
    "maxAmountRequired": "49000000",
    "payTo": "0x116fC3Bb1E3b48d39718b0D19D286f6B44DC7ED3",
    "asset": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
  }]
}
```

## Step 4 — Present payment instructions clearly

Tell the builder:

**Pay [amount] USDC on Base mainnet:**
- Send to: `[payTo address]`
- Token: USDC on Base (`0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`)
- Amount: `[maxAmountRequired]` (that's $[X] — USDC has 6 decimals)
- Network: Base mainnet, chain ID 8453

**Payment URI (paste into wallet or encode as QR):**
```
ethereum:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913@8453/transfer?to=[payTo]&uint256=[maxAmountRequired]
```

Tell them: "Once your transaction confirms, you'll need the X-PAYMENT proof. You can get it from the x402 facilitator at https://facilitator.coinbase.com by submitting your transaction hash. Or if your wallet returns the payment proof directly, use that."

Wait for them to confirm payment.

## Step 5 — Complete registration

Once the builder provides the X-PAYMENT proof string, make the final call:

```
POST https://sources-x402-worker.dmpay.workers.dev/manifest?plan={plan}
Content-Type: application/json
X-PAYMENT: {payment_proof}

{same manifest JSON}
```

## Step 6 — Show success

On success, display:
- ✅ Handle assigned: `{ens}`
- IPFS CID: `{cid}`
- Live at: `https://sources.eth.limo/agent/{ens}`
- If trial: expiry date + how to upgrade
- If permanent: "Listed forever. No recurring fees."

Encourage them to share their agent link.

## Error handling

- **409 / name taken**: Suggest alternatives (add a suffix, tweak the name)
- **400 validation error**: Show the exact error and help fix the field
- **Payment verification failed**: Ask them to double-check the X-PAYMENT proof and that the transaction confirmed on Base
- **Worker unreachable**: The worker is at `https://sources-x402-worker.dmpay.workers.dev` — check that it's deployed
