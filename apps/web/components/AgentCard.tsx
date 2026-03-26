"use client";

import { useState, useRef, useEffect } from "react";
import type { AgentManifest } from "@sources-eth/agent-manifest";
import type { Erc8004Agent } from "../lib/api";
import Image from "next/image";
import Link from "next/link";
import { StarRating } from "./StarRating";

function ShareMenu({ agent }: { agent: AgentManifest }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const link = `https://sources.eth.limo/agent?ens=${encodeURIComponent(agent.ens)}`;
  const price = `$${agent.price_usd.toFixed(2)}`;
  const text = `Just found "${agent.display_name}" on sources.eth → ${agent.description} · ${price} per use, no wallet needed`;

  const share = (e: React.MouseEvent, platform: "x" | "facebook" | "instagram") => {
    e.preventDefault();
    e.stopPropagation();
    if (platform === "x") {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text + "\n\n" + link)}`, "_blank");
    } else if (platform === "facebook") {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`, "_blank");
    } else {
      navigator.clipboard.writeText(text + "\n\n" + link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative flex-shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen((v) => !v); }}
        className="p-1.5 rounded-lg text-white/20 hover:text-white/60 hover:bg-white/[0.05] transition-all"
        aria-label="Share"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
          <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-50 bg-[#1a1a27] border border-white/[0.1] rounded-xl shadow-2xl overflow-hidden w-40">
          <button onClick={(e) => share(e, "x")} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/70 hover:text-white">
            <span className="font-bold text-white/50 w-4 text-center">𝕏</span> Post on X
          </button>
          <button onClick={(e) => share(e, "facebook")} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/70 hover:text-white">
            <span className="text-[#1877f2] w-4 text-center font-bold">f</span> Facebook
          </button>
          <button onClick={(e) => share(e, "instagram")} className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-white/[0.06] transition-colors text-sm text-white/70 hover:text-white">
            <span className="w-4 text-center">📸</span> {copied ? "Copied!" : "Instagram"}
          </button>
        </div>
      )}
    </div>
  );
}

const CATEGORY_ICONS: Record<string, string> = {
  "generative-media": "🎨",
  "text-content": "✍️",
  "ai-assistants": "🤖",
  "coding-dev": "💻",
  "data-analytics": "📊",
  "payments-finance": "💸",
  "identity-verification": "🪪",
  "security-compliance": "🔒",
  "audio-voice": "🎵",
  "ecommerce": "🛒",
  "workflow-automation": "⚙️",
  "knowledge-search": "🔍",
  "legal-ai": "⚖️",
  "medical-health": "🩺",
  "real-estate": "🏠",
  "accounting-finance": "🧾",
  other: "✨",
};

interface AgentCardProps {
  agent: AgentManifest;
  rating?: { avg: number; count: number };
  onSelect?: (agent: AgentManifest) => void;
  selected?: boolean;
}

function serviceTypeBadge(name: string): string {
  switch (name.toLowerCase()) {
    case "mcp":   return "bg-[#7c6aff]/10 border-[#7c6aff]/30 text-[#7c6aff]";
    case "a2a":   return "bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]";
    case "oasf":  return "bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]";
    case "web":   return "bg-[#4fd8b8]/10 border-[#4fd8b8]/30 text-[#4fd8b8]";
    case "email": return "bg-white/[0.05] border-white/[0.12] text-white/40";
    default:      return "bg-white/[0.03] border-white/[0.07] text-white/25";
  }
}

interface Erc8004AgentCardProps {
  agent: Erc8004Agent;
  onSelect?: (agent: Erc8004Agent) => void;
  selected?: boolean;
}

export function Erc8004AgentCard({ agent, onSelect, selected }: Erc8004AgentCardProps) {
  const cls = `flex items-center gap-4 px-5 py-4 bg-[#16161f] border rounded-xl transition-all group w-full text-left ${
    selected
      ? "border-[#7c6aff]/60 shadow-[0_0_24px_rgba(124,106,255,0.15)]"
      : "border-white/[0.07] hover:border-white/20"
  }`;

  const inner = (
    <>
      {/* Avatar */}
      <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center overflow-hidden">
        {agent.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={agent.image} alt={agent.name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xl">🤖</span>
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
          <span className="font-semibold text-white/80 group-hover:text-white transition-colors truncate">
            {agent.name}
          </span>
          {agent.x402Support && (
            <span className="px-1.5 py-0.5 bg-[#4fd8b8]/10 border border-[#4fd8b8]/20 rounded text-[10px] font-mono text-[#4fd8b8] flex-shrink-0">
              x402
            </span>
          )}
          <span className="px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.08] rounded text-[10px] text-white/30 flex-shrink-0">
            ERC-8004
          </span>
        </div>
        <p className="text-sm text-white/40 truncate mb-1.5">{agent.description}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {agent.services.slice(0, 5).map((s) => (
            <span key={s.name} className={`font-mono text-[10px] rounded px-1.5 py-0.5 border ${serviceTypeBadge(s.name)}`}>
              {s.name.toUpperCase()}
            </span>
          ))}
        </div>
      </div>

      {/* Not registered badge */}
      <div className="flex-shrink-0 text-right">
        <div className="text-xs text-white/30 border border-white/[0.08] rounded-lg px-2 py-1 font-mono">
          Not listed
        </div>
        <div className="text-xs text-white/20 mt-1">chain: {agent.chain}</div>
      </div>
    </>
  );

  if (onSelect) {
    return <button onClick={() => onSelect(agent)} className={cls}>{inner}</button>;
  }

  return (
    <a
      href={`/register?prefill=${encodeURIComponent(JSON.stringify({ name: agent.name, description: agent.description, image: agent.image }))}`}
      className={cls}
    >
      {inner}
    </a>
  );
}

export function AgentCard({ agent, rating, onSelect, selected }: AgentCardProps) {
  const icon = CATEGORY_ICONS[agent.category] ?? "✨";
  // Show per-service prices if available, otherwise fall back to base price
  const services = (agent as AgentManifest & { services?: Array<{ name: string; price_usd?: number }> }).services;
  const servicePrices = services?.filter((s) => s.price_usd !== undefined).map((s) => s.price_usd!) ?? [];
  const minPrice = servicePrices.length > 0 ? Math.min(...servicePrices) : agent.price_usd;
  const maxPrice = servicePrices.length > 0 ? Math.max(...servicePrices) : agent.price_usd;
  const priceLabel = servicePrices.length > 1 && maxPrice !== minPrice
    ? `$${minPrice.toFixed(2)}–$${maxPrice.toFixed(2)}`
    : `$${minPrice.toFixed(2)}`;

  const inner = (
    <>
      {/* Avatar: favicon or category emoji */}
      <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-white/[0.05] border border-white/[0.07] flex items-center justify-center overflow-hidden">
        {agent.favicon_url ? (
          <Image
            src={agent.favicon_url}
            alt={agent.display_name}
            width={44}
            height={44}
            className="object-cover w-full h-full"
            unoptimized
          />
        ) : (
          <span className="text-xl">{icon}</span>
        )}
      </div>

      {/* Main info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="font-semibold text-white group-hover:text-[#7c6aff] transition-colors truncate">
            {agent.display_name}
          </span>
          {agent.human_verified && (
            <Image
              src="/human-verified.png"
              alt="Human Verified"
              width={18}
              height={18}
              className="flex-shrink-0"
              title="Human Verified by World ID"
              unoptimized
            />
          )}
          {agent.avg_latency_ms && (
            <span className="text-xs text-white/20 flex-shrink-0">
              ~{(agent.avg_latency_ms / 1000).toFixed(1)}s
            </span>
          )}
        </div>
        <p className="text-sm text-white/45 truncate mb-1.5">{agent.description}</p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-[#7c6aff]/60 truncate">{agent.ens}</span>
          {rating && (
            <StarRating avg={rating.avg} count={rating.count} size="sm" />
          )}
        </div>
      </div>

      {/* Price + share */}
      <div className="flex-shrink-0 flex items-center gap-1.5">
        <div className="text-right">
          <div className="font-mono font-semibold text-[#4fd8b8]">{priceLabel}</div>
          <div className="text-xs text-white/25 mt-0.5">per gen</div>
        </div>
        <ShareMenu agent={agent} />
      </div>
    </>
  );

  const cls = `flex items-center gap-4 px-5 py-4 bg-[#16161f] border rounded-xl transition-all group ${
    selected
      ? "border-[#7c6aff]/60 shadow-[0_0_24px_rgba(124,106,255,0.15)]"
      : "border-white/[0.07] hover:border-[#7c6aff]/30 hover:shadow-[0_0_24px_rgba(124,106,255,0.08)]"
  }`;

  if (onSelect) {
    return (
      <button onClick={() => onSelect(agent)} className={`${cls} w-full text-left`}>
        {inner}
      </button>
    );
  }

  return (
    <Link href={`/agent?ens=${encodeURIComponent(agent.ens)}`} className={cls}>
      {inner}
    </Link>
  );
}
