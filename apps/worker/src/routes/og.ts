import type { AgentManifest } from "@sources-eth/agent-manifest";
import type { Env } from "../lib/registry";

const CATEGORY_LABELS: Record<string, string> = {
  "generative-media": "Generative Media",
  "text-content": "Text & Content",
  "ai-assistants": "AI Assistants",
  "coding-dev": "Coding & Dev",
  "data-analytics": "Data & Analytics",
  "payments-finance": "Payments & Finance",
  "identity-verification": "Identity",
  "security-compliance": "Security",
  "audio-voice": "Audio & Voice",
  "ecommerce": "E-commerce",
  "workflow-automation": "Automation",
  "knowledge-search": "Knowledge",
  "legal-ai": "Legal AI",
  "medical-health": "Medical AI",
  "real-estate": "Real Estate",
  "accounting-finance": "Accounting",
  "other": "Other",
};

function truncate(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if ((current + " " + word).trim().length > maxChars) {
      if (current) lines.push(current.trim());
      current = word;
    } else {
      current = (current + " " + word).trim();
    }
    if (lines.length === 2) break;
  }
  if (current && lines.length < 3) lines.push(current.trim());
  return lines.slice(0, 2);
}

function buildSvg(agent: AgentManifest): string {
  const name = truncate(agent.display_name, 32);
  const descLines = wrapText(agent.description, 58);
  const price = `$${agent.price_usd.toFixed(2)} / generation`;
  const category = CATEGORY_LABELS[agent.category] ?? agent.category;
  const handle = agent.ens;

  const descY1 = 290;
  const descY2 = 340;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0a0a0f"/>
      <stop offset="100%" stop-color="#13121f"/>
    </linearGradient>
    <linearGradient id="glow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#7c6aff" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#7c6aff" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Purple glow top-right -->
  <ellipse cx="1050" cy="80" rx="380" ry="220" fill="#7c6aff" opacity="0.07"/>

  <!-- Top border accent -->
  <rect x="0" y="0" width="1200" height="2" fill="#7c6aff" opacity="0.6"/>

  <!-- Left accent bar -->
  <rect x="60" y="160" width="4" height="280" rx="2" fill="#7c6aff" opacity="0.8"/>

  <!-- sources.eth brand — top left -->
  <text x="60" y="72" font-family="ui-monospace,monospace" font-size="22" fill="#7c6aff" opacity="0.9" font-weight="500">sources.eth</text>

  <!-- Agent name -->
  <text x="84" y="210" font-family="-apple-system,system-ui,sans-serif" font-size="72" font-weight="700" fill="#ffffff">${name}</text>

  <!-- Description lines -->
  <text x="84" y="${descY1}" font-family="-apple-system,system-ui,sans-serif" font-size="30" fill="rgba(255,255,255,0.5)">${descLines[0] ?? ""}</text>
  ${descLines[1] ? `<text x="84" y="${descY2}" font-family="-apple-system,system-ui,sans-serif" font-size="30" fill="rgba(255,255,255,0.5)">${descLines[1]}</text>` : ""}

  <!-- Bottom row -->
  <!-- Price badge -->
  <rect x="84" y="510" width="${price.length * 14 + 32}" height="52" rx="10" fill="#4fd8b8" opacity="0.12"/>
  <rect x="84" y="510" width="${price.length * 14 + 32}" height="52" rx="10" fill="none" stroke="#4fd8b8" stroke-opacity="0.3" stroke-width="1"/>
  <text x="${84 + (price.length * 14 + 32) / 2}" y="543" font-family="-apple-system,system-ui,sans-serif" font-size="22" font-weight="600" fill="#4fd8b8" text-anchor="middle">${price}</text>

  <!-- Category badge -->
  <rect x="${84 + price.length * 14 + 32 + 16}" y="510" width="${category.length * 13 + 28}" height="52" rx="10" fill="#7c6aff" opacity="0.12"/>
  <rect x="${84 + price.length * 14 + 32 + 16}" y="510" width="${category.length * 13 + 28}" height="52" rx="10" fill="none" stroke="#7c6aff" stroke-opacity="0.3" stroke-width="1"/>
  <text x="${84 + price.length * 14 + 32 + 16 + (category.length * 13 + 28) / 2}" y="543" font-family="-apple-system,system-ui,sans-serif" font-size="22" fill="#7c6aff" text-anchor="middle">${category}</text>

  <!-- Handle — bottom right -->
  <text x="1140" y="575" font-family="ui-monospace,monospace" font-size="20" fill="rgba(255,255,255,0.2)" text-anchor="end">${truncate(handle, 48)}</text>
</svg>`;
}

export async function handleOgAgent(ens: string, env: Env): Promise<Response> {
  // Try to fetch the manifest — fall back to a branded placeholder if not found
  const manifest = await env.AGENTS_KV.get<AgentManifest>(`agents:${ens}`, "json");

  if (!manifest) {
    // Generic sources.eth card
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0f"/>
  <rect x="0" y="0" width="1200" height="2" fill="#7c6aff" opacity="0.6"/>
  <ellipse cx="1050" cy="80" rx="380" ry="220" fill="#7c6aff" opacity="0.07"/>
  <text x="600" y="285" font-family="-apple-system,system-ui,sans-serif" font-size="80" font-weight="700" fill="#ffffff" text-anchor="middle">sources.eth</text>
  <text x="600" y="355" font-family="-apple-system,system-ui,sans-serif" font-size="32" fill="rgba(255,255,255,0.4)" text-anchor="middle">AI Agent Marketplace</text>
  <text x="600" y="430" font-family="-apple-system,system-ui,sans-serif" font-size="24" fill="rgba(255,255,255,0.2)" text-anchor="middle">Anything you need, for pennies.</text>
</svg>`;
    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  const svg = buildSvg(manifest);
  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
