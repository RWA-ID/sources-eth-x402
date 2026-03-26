// Generates seed-bulk.json for wrangler kv bulk put
// Run: node seed/seed.mjs && npx wrangler kv bulk put seed/seed-bulk.json --namespace-id=e289e3c6dac2440186bdf923f35eea00
import { writeFileSync } from "fs";

const NOW = Date.now();
const TREASURY = "0x116fC3Bb1E3b48d39718b0D19D286f6B44DC7ED3";

// ─── Agent definitions ────────────────────────────────────────────────────────

const agents = [
  {
    name: "flux-ultra-gen",
    display_name: "FLUX Ultra",
    description: "Photorealistic image generation using the FLUX.1 Ultra model. Fast, detailed, and accurate to your prompt.",
    category: "generative-media",
    price_usd: 0.05,
    tags: ["photorealistic", "fast", "flux", "image-generation"],
    output_type: "image",
    output_format: "png",
    favicon_url: "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/FLUX.1_logo.png/240px-FLUX.1_logo.png",
  },
  {
    name: "pixeldream",
    display_name: "PixelDream",
    description: "Dreamlike surrealist artwork and concept illustrations generated in seconds using SDXL Turbo.",
    category: "generative-media",
    price_usd: 0.03,
    tags: ["surrealist", "illustration", "concept-art", "sdxl", "fast"],
    output_type: "image",
    output_format: "png",
  },
  {
    name: "code-sage",
    display_name: "Code Sage",
    description: "AI code reviewer that catches bugs, suggests improvements, and explains complex logic in plain English.",
    category: "coding-dev",
    price_usd: 0.02,
    tags: ["code-review", "debugging", "refactor", "typescript", "python"],
    output_type: "text",
    output_format: "markdown",
  },
  {
    name: "legalysis",
    display_name: "Legalysis",
    description: "Analyzes contracts and legal documents, flags risky clauses, and summarizes key terms in plain language.",
    category: "legal-ai",
    price_usd: 0.15,
    tags: ["contracts", "legal", "NDA", "compliance", "terms"],
    output_type: "text",
    output_format: "markdown",
  },
  {
    name: "voicescribe",
    display_name: "VoiceScribe",
    description: "Transcribes audio files to text with speaker diarization and punctuation in under 30 seconds.",
    category: "audio-voice",
    price_usd: 0.03,
    tags: ["transcription", "audio", "speech-to-text", "diarization", "whisper"],
    output_type: "text",
    output_format: "json",
  },
  {
    name: "dataweave",
    display_name: "DataWeave",
    description: "Upload a CSV and ask questions in plain English — get charts, summaries, and instant insights.",
    category: "data-analytics",
    price_usd: 0.08,
    tags: ["csv", "analytics", "charts", "data", "insights"],
    output_type: "data",
    output_format: "json",
  },
  {
    name: "pencraft",
    display_name: "PenCraft",
    description: "SEO-optimized blog posts, product descriptions, and ad copy written in your brand voice.",
    category: "text-content",
    price_usd: 0.04,
    tags: ["SEO", "copywriting", "blog", "content", "marketing"],
    output_type: "text",
    output_format: "markdown",
  },
  {
    name: "auditron",
    display_name: "Auditron",
    description: "Static analysis and vulnerability scanner for Solidity smart contracts with line-level findings.",
    category: "security-compliance",
    price_usd: 0.25,
    tags: ["solidity", "smart-contracts", "security", "audit", "EVM"],
    output_type: "text",
    output_format: "json",
  },
  {
    name: "briefbot",
    display_name: "BriefBot",
    description: "Paste a meeting transcript or document and get a structured summary with action items in seconds.",
    category: "workflow-automation",
    price_usd: 0.02,
    tags: ["summarize", "meetings", "transcripts", "action-items", "productivity"],
    output_type: "text",
    output_format: "markdown",
  },
  {
    name: "tradescout",
    display_name: "TradeScout",
    description: "Market sentiment analysis and risk scoring for any crypto token or equity ticker using on-chain and social signals.",
    category: "payments-finance",
    price_usd: 0.10,
    tags: ["trading", "sentiment", "crypto", "finance", "risk"],
    output_type: "data",
    output_format: "json",
  },
];

// ─── Build KV entries ─────────────────────────────────────────────────────────

const kvEntries = [];

// Category → ENS list (accumulated)
const categoryLists = {};
const tagLists = {};
const allList = [];

agents.forEach((a, i) => {
  const ens = `${a.name}.agents.sources.eth`;
  const daysAgo = (agents.length - i) * 3; // spread registrations over past month
  const registeredAt = Math.floor((NOW - daysAgo * 86400000) / 1000);

  // Agent manifest
  const manifest = {
    name: a.name,
    display_name: a.display_name,
    description: a.description,
    ens,
    version: "1.0.0",
    endpoint: `https://${a.name}.xyz/generate`,
    method: "POST",
    price_usd: a.price_usd,
    payment_address: TREASURY,
    payment_chain: 8453,
    payment_token: "USDC",
    category: a.category,
    tags: a.tags,
    input: { prompt: { type: "string", required: true, maxLength: 1000 } },
    output: { type: a.output_type, format: a.output_format, delivery: "url" },
    ipfs_cid: `Qm${Buffer.from(a.name).toString("hex").padEnd(44, "0").slice(0, 44)}`,
    registered_at: registeredAt,
    manifest_version: "1.0",
    ...(a.favicon_url ? { favicon_url: a.favicon_url } : {}),
  };

  // Registration record (all active, permanent)
  const registration = {
    ens,
    tx_hash_trial: `0x${Buffer.from(a.name + "seed").toString("hex").padEnd(64, "0").slice(0, 64)}`,
    fee_paid_total: 49000000,
    status: "active",
    trial_started_at: registeredAt * 1000,
    trial_expires_at: 9999999999999,
    upgraded_at: registeredAt * 1000,
  };

  kvEntries.push({ key: `agents:${ens}`, value: JSON.stringify(manifest) });
  kvEntries.push({ key: `registrations:${ens}`, value: JSON.stringify(registration) });

  // Accumulate lists
  allList.push(ens);
  if (!categoryLists[a.category]) categoryLists[a.category] = [];
  categoryLists[a.category].push(ens);
  for (const tag of a.tags) {
    const t = tag.toLowerCase();
    if (!tagLists[t]) tagLists[t] = [];
    tagLists[t].push(ens);
  }
});

// List keys
kvEntries.push({ key: "agents:list:all", value: JSON.stringify(allList) });
for (const [cat, list] of Object.entries(categoryLists)) {
  kvEntries.push({ key: `agents:list:${cat}`, value: JSON.stringify(list) });
}
for (const [tag, list] of Object.entries(tagLists)) {
  kvEntries.push({ key: `tags:${tag}`, value: JSON.stringify(list) });
}

writeFileSync("seed/seed-bulk.json", JSON.stringify(kvEntries, null, 2));
console.log(`✓ Generated seed/seed-bulk.json with ${kvEntries.length} KV entries`);
console.log(`  ${agents.length} agents across ${Object.keys(categoryLists).length} categories`);
console.log(`\nNow run:`);
console.log(`  npx wrangler kv bulk put seed/seed-bulk.json --namespace-id=e289e3c6dac2440186bdf923f35eea00`);
