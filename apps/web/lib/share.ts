import type { AgentManifest, SharePayload, ShareTarget } from "@sources-eth/agent-manifest";

export function buildShareText(payload: SharePayload): Record<ShareTarget, string> {
  const link = `https://sources.eth.limo/agent/${payload.agentEns}`;

  return {
    twitter: `Just generated this with ${payload.agentName} on @sourceseth\nCost me ${payload.price} — no account, no wallet connect, just a QR code\n\nTry it → ${link}`,
    tiktok: `AI generation for ${payload.price} 👀 No signup needed ${link}`,
    instagram: `Generated with ${payload.agentName} on sources.eth\n${payload.price} · No account needed\n🔗 Link in bio`,
    facebook: `I just used an AI agent on sources.eth to generate this for ${payload.price}. No account, no wallet setup — just scanned a QR code and paid. Try it: ${link}`,
  };
}

export function buildAgentShareText(manifest: AgentManifest): Record<ShareTarget, string> {
  const link = `https://sources.eth.limo/agent/${manifest.ens}`;
  const price = `$${manifest.price_usd.toFixed(2)}`;

  return {
    twitter: `My AI agent "${manifest.display_name}" is now live on sources.eth\n\n→ ${manifest.description}\n→ ${price} per generation\n→ No account needed to use it\n\nTry it: ${link}`,
    tiktok: `My AI agent is live 🤖 ${price} per use, no signup needed ${link}`,
    instagram: `"${manifest.display_name}" is live on sources.eth\n${manifest.description}\n${price} per generation · no account needed\n🔗 Link in bio`,
    facebook: `I just listed my AI agent "${manifest.display_name}" on sources.eth. Anyone can use it for ${price} with no account or wallet setup — just scan a QR code. Check it out: ${link}`,
  };
}

export function share(target: ShareTarget, text: string, link?: string): void {
  switch (target) {
    case "twitter": {
      const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener");
      break;
    }
    case "facebook": {
      const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link ?? "https://sources.eth.limo")}&quote=${encodeURIComponent(text)}`;
      window.open(url, "_blank", "noopener");
      break;
    }
    case "tiktok":
    case "instagram": {
      // No web share URL — use native share sheet on mobile, clipboard on desktop
      if (typeof navigator !== "undefined" && navigator.share) {
        navigator.share({ text, url: link }).catch(() => {});
      } else {
        navigator.clipboard.writeText(text + (link ? `\n\n${link}` : "")).catch(() => {});
      }
      break;
    }
  }
}
