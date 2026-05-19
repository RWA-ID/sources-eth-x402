"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import type { AgentManifest, AgentCategory, AgentRating } from "@sources-eth/agent-manifest";
import { SearchBar } from "../components/SearchBar";
import { AgentCard, Erc8004AgentCard } from "../components/AgentCard";
import { InlineAgentPanel } from "../components/InlineAgentPanel";
import { Erc8004AgentPanel } from "../components/Erc8004AgentPanel";
import { searchAgents, discoverAgents, getRating, getAgent, getStats } from "../lib/api";
import type { Erc8004Agent, PlatformStats } from "../lib/api";

const SHORTCUTS = [
  { label: "Generative Media", q: "generative media image video" },
  { label: "Text & Content", q: "text content writing" },
  { label: "Audio & Voice", q: "audio voice transcription" },
  { label: "Coding & Dev Tools", q: "code developer tools" },
  { label: "AI Tasks & Assistants", q: "AI assistant task automation" },
];

const CATEGORY_GLYPH: Record<AgentCategory, string> = {
  "generative-media": "🎨",
  "text-content": "✍️",
  "ai-assistants": "🤖",
  "coding-dev": "⌨️",
  "data-analytics": "📊",
  "payments-finance": "💸",
  "identity-verification": "🪪",
  "security-compliance": "🛡️",
  "audio-voice": "🔊",
  "ecommerce": "🛒",
  "workflow-automation": "⚙️",
  "knowledge-search": "🔎",
  "legal-ai": "⚖️",
  "medical-health": "🩺",
  "real-estate": "🏠",
  "accounting-finance": "🧾",
  "other": "✨",
};

const CATEGORY_LABEL: Record<AgentCategory, string> = {
  "generative-media": "Media",
  "text-content": "Text",
  "ai-assistants": "Agent",
  "coding-dev": "Code",
  "data-analytics": "Data",
  "payments-finance": "Pay",
  "identity-verification": "ID",
  "security-compliance": "Sec",
  "audio-voice": "Audio",
  "ecommerce": "Shop",
  "workflow-automation": "Flow",
  "knowledge-search": "Search",
  "legal-ai": "Legal",
  "medical-health": "Health",
  "real-estate": "Real Estate",
  "accounting-finance": "Finance",
  "other": "Other",
};

const FAQ_ITEMS = [
  {
    q: "Do I need a wallet?",
    a: "Yes — any mobile wallet that holds USDC on Base will work (Rainbow, Coinbase Wallet, MetaMask Mobile, Phantom, etc.). You don't connect it to us. You just scan the QR code and pay, the same way you'd pay a friend on Venmo.",
  },
  {
    q: "Is this safe?",
    a: "Your payment goes directly to the agent — we never touch your money. You don't make an account, give us an email, or sign anything. The QR code encodes a one-shot USDC transfer to the agent's address. Every payment is logged on-chain.",
  },
  {
    q: "What happens to my money?",
    a: "100% of your payment goes to the agent's wallet, instantly. There's no platform cut on usage, no held balance, no escrow. sources.eth makes money on a one-time listing fee paid by builders, not by skimming your transactions.",
  },
  {
    q: "How is this different from ChatGPT Plus?",
    a: "ChatGPT Plus is one subscription for one company's models. sources.eth is a marketplace of specialist agents — and you pay per request, in pennies, instead of $20 a month. No login. No commitment. If you only need a logo once, you pay $0.15 and you're done.",
  },
  {
    q: "What if the agent doesn't deliver?",
    a: "Every agent has a public on-chain history. If a request fails, the result is logged and the agent's rating drops. Repeated failures get delisted. Since manifests are on IPFS, the marketplace can't quietly hide bad actors — the receipts are permanent.",
  },
];

function LiveTickerEyebrow({ agents }: { agents: AgentManifest[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (agents.length === 0) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % agents.length), 2400);
    return () => clearInterval(id);
  }, [agents.length]);
  const current = agents[idx];
  return (
    <div className="inline-flex items-center gap-3.5 px-3.5 py-1.5 bg-white/[0.03] border border-white/[0.07] rounded-full text-[12px] font-mono text-white/40 max-w-[calc(100vw-56px)] overflow-hidden whitespace-nowrap">
      <span className="text-white/55">x402 marketplace</span>
      <span className="text-white/20">·</span>
      <span className="inline-flex items-center gap-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4fd8b8] animate-pulse" />
        {current ? (
          <>
            <span className="text-[#4fd8b8]">${current.price_usd.toFixed(2)}</span>
            <span className="text-white/20">·</span>
            <span className="text-[#7c6aff]">{current.name}</span>
          </>
        ) : (
          <span className="text-white/55">live</span>
        )}
      </span>
    </div>
  );
}

function FloatingReceipt({ agent }: { agent: AgentManifest | null }) {
  if (!agent) return null;
  return (
    <div
      className="hidden xl:block absolute pointer-events-none"
      style={{
        right: -10,
        top: 340,
        width: 210,
        transform: "rotate(4deg)",
        animation: "float-y 6s ease-in-out infinite",
      }}
    >
      <div className="p-4 bg-[#16161f] border border-white/[0.07] rounded-xl font-mono text-[11px] text-white/55 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.5)]">
        <div className="flex justify-between text-white/35 text-[10px]">
          <span>receipt · base</span>
          <span className="text-[#4fd8b8]">● paid</span>
        </div>
        <div className="h-px bg-white/[0.07] my-2.5" />
        <div className="flex justify-between text-white/90">
          <span className="truncate pr-2">{agent.name}</span>
          <span className="text-[#4fd8b8] shrink-0">${agent.price_usd.toFixed(2)}</span>
        </div>
        <div className="text-white/35 text-[10px] mt-1.5">tx 0x82c…f9a3 · just now</div>
        <div className="flex gap-1 mt-2.5">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 h-[2px] rounded-[1px]"
              style={{ background: i % 3 === 0 ? "#7c6aff" : "rgba(255,255,255,0.14)" }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function FauxQR({ size = 168 }: { size?: number }) {
  const cells = 25;
  const cell = size / cells;
  const pattern = useMemo(() => {
    const grid: number[][] = [];
    let seed = 982451653;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let r = 0; r < cells; r++) {
      const row: number[] = [];
      for (let c = 0; c < cells; c++) {
        const inMarker = (r < 7 && c < 7) || (r < 7 && c >= cells - 7) || (r >= cells - 7 && c < 7);
        if (inMarker) {
          let rr = r, cc = c;
          if (rr >= cells - 7) rr = rr - (cells - 7);
          if (cc >= cells - 7) cc = cc - (cells - 7);
          const ring = rr === 0 || rr === 6 || cc === 0 || cc === 6;
          const center = rr >= 2 && rr <= 4 && cc >= 2 && cc <= 4;
          row.push(ring || center ? 1 : 0);
        } else {
          row.push(rand() > 0.55 ? 1 : 0);
        }
      }
      grid.push(row);
    }
    return grid;
  }, []);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="block">
      <rect width={size} height={size} fill="#16161f" rx="6" />
      {pattern.flatMap((row, r) =>
        row.map((v, c) =>
          v ? (
            <rect
              key={`${r}-${c}`}
              x={c * cell + 0.5}
              y={r * cell + 0.5}
              width={cell - 1}
              height={cell - 1}
              fill="#ffffff"
              rx="0.5"
            />
          ) : null
        )
      )}
    </svg>
  );
}

function HowItWorks({ heroAgent }: { heroAgent: AgentManifest | null }) {
  return (
    <section id="how" className="py-24 px-7 border-t border-white/[0.07]">
      <div className="max-w-5xl mx-auto">
        <div className="text-center">
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-white/40">how it works</div>
          <h2 className="mt-3.5 text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.08]">
            Three steps. <span className="text-[#7c6aff] italic font-medium">No accounts.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-4 mt-12 md:[grid-template-columns:1fr_1.25fr_1fr]">
          {/* Step 1 — Search */}
          <Step number="01" title="Search" body="Type what you need. The marketplace returns agents that can do it, each priced in cents.">
            <div className="p-4">
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-lg px-3 py-2.5 flex items-center gap-2.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(240,240,248,0.32)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <div className="flex-1 text-[13px] text-white">
                  make a logo
                  <span className="inline-block w-px h-3.5 bg-[#7c6aff] ml-0.5 align-middle" style={{ animation: "blink 1s steps(2) infinite" }} />
                </div>
              </div>
              <div className="mt-2.5 flex flex-col gap-1.5">
                {[
                  { name: "logo-spark", price: 0.15, highlight: true },
                  { name: "brandai", price: 0.1, highlight: false },
                ].map((a) => (
                  <div
                    key={a.name}
                    className={`flex justify-between items-center px-3 py-2 rounded-lg ${
                      a.highlight ? "bg-[#7c6aff]/14 border border-[#7c6aff]/35" : "bg-white/[0.025] border border-white/[0.07]"
                    }`}
                  >
                    <span className="font-mono text-xs text-white/55">{a.name}</span>
                    <span className="font-mono text-xs text-[#4fd8b8]">${a.price.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </Step>

          {/* Step 2 — Scan QR (featured) */}
          <Step number="02" title="Scan the QR" body="One QR code = one payment = one result. Use any wallet that holds USDC on Base." featured>
            <div className="flex justify-center px-4 pb-5 pt-2">
              <div className="relative p-3 bg-[#0a0a0f] border border-white/[0.07] rounded-2xl">
                <FauxQR size={168} />
                <div
                  className="absolute left-4 right-4 top-4 h-0.5"
                  style={{
                    background: "linear-gradient(90deg, transparent, #7c6aff, transparent)",
                    boxShadow: "0 0 16px 2px #7c6aff",
                    animation: "scan-line 2.2s ease-in-out infinite",
                  }}
                />
                <div className="absolute inset-3 border border-[#7c6aff]/30 rounded-md pointer-events-none" />
              </div>
            </div>
            <div className="px-4 pb-4 text-center font-mono text-xs">
              <div className="text-[#4fd8b8] text-base mb-0.5">
                ${(heroAgent?.price_usd ?? 0.05).toFixed(2)} USDC
              </div>
              <div className="text-white/35">
                to {heroAgent?.name ?? "an agent"} on sources.eth
              </div>
            </div>
          </Step>

          {/* Step 3 — Result */}
          <Step number="03" title="Get the result" body="Payment confirmed on-chain in ~2 seconds. Your result streams back instantly.">
            <div className="p-4">
              <div
                className="aspect-square rounded-lg border border-white/[0.07] relative overflow-hidden"
                style={{
                  background:
                    "linear-gradient(135deg, color-mix(in oklab, #7c6aff 40%, #1c1c2a), color-mix(in oklab, #7c6aff 5%, #0e0e14))",
                }}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "radial-gradient(circle at 30% 30%, rgba(255,255,255,0.3), transparent 40%), radial-gradient(circle at 70% 65%, color-mix(in oklab, #4fd8b8 40%, transparent), transparent 50%)",
                  }}
                />
                <div className="absolute bottom-2 left-2 right-2 flex items-center gap-1.5 text-[10px] font-mono text-white/80">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4fd8b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 4 4L19 6" />
                  </svg>
                  generated · 2.4s
                </div>
              </div>
            </div>
          </Step>
        </div>

        <p className="text-center mt-12 text-sm font-mono text-white/35">
          Works on a desktop, a phone, someone else&apos;s laptop. The QR is the whole story.
        </p>
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  body,
  featured,
  children,
}: {
  number: string;
  title: string;
  body: string;
  featured?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border overflow-hidden relative ${
        featured
          ? "bg-gradient-to-b from-[#7c6aff]/[0.06] to-[#16161f] border-[#7c6aff]/30 shadow-[0_30px_80px_-40px_rgba(124,106,255,0.4)]"
          : "bg-[#16161f] border-white/[0.07]"
      }`}
    >
      <div className="px-5 pt-5 pb-1.5">
        <div className="flex items-center gap-2.5 mb-3">
          <span className={`font-mono text-[11px] tracking-wider ${featured ? "text-[#7c6aff]" : "text-white/35"}`}>{number}</span>
          <div className="flex-1 h-px bg-white/[0.07]" />
        </div>
        <h3 className="m-0 text-xl font-semibold tracking-tight">{title}</h3>
        <p className="mt-2 mb-4 text-sm text-white/55 leading-relaxed">{body}</p>
      </div>
      <div className="mt-auto">{children}</div>
    </div>
  );
}

function FAQ() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className="py-24 px-7 border-t border-white/[0.07]">
      <div className="max-w-2xl mx-auto">
        <div className="text-center">
          <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-white/40">frequently asked</div>
          <h2 className="mt-3.5 text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.08]">
            Questions, <span className="text-[#7c6aff] italic font-medium">answered plainly.</span>
          </h2>
        </div>
        <div className="mt-11 flex flex-col gap-2">
          {FAQ_ITEMS.map((item, i) => (
            <FAQRow
              key={item.q}
              item={item}
              isOpen={open === i}
              onToggle={() => setOpen(open === i ? -1 : i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function FAQRow({ item, isOpen, onToggle }: { item: { q: string; a: string }; isOpen: boolean; onToggle: () => void }) {
  return (
    <div
      className={`rounded-xl overflow-hidden transition-all border ${
        isOpen ? "bg-[#16161f] border-[#7c6aff]/20" : "bg-white/[0.018] border-white/[0.07]"
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-base font-medium text-white">{item.q}</span>
        <span className="w-7 h-7 rounded-full bg-white/[0.04] grid place-items-center text-[#7c6aff] shrink-0">
          {isOpen ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14M5 12h14" /></svg>
          )}
        </span>
      </button>
      {isOpen && (
        <div className="px-5 pb-5 text-[15px] text-white/55 leading-[1.65]" style={{ animation: "fade-in 200ms ease" }}>
          {item.a}
        </div>
      )}
    </div>
  );
}

function FeaturedAgentCard({ agent }: { agent: AgentManifest }) {
  const glyph = CATEGORY_GLYPH[agent.category] ?? CATEGORY_GLYPH.other;
  const label = CATEGORY_LABEL[agent.category] ?? "Other";
  return (
    <a
      href={`/agent/${agent.ens}`}
      className="group flex flex-col gap-4 p-[18px] bg-[#16161f] border border-white/[0.07] hover:border-[#7c6aff]/30 rounded-2xl transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-20px_rgba(124,106,255,0.22)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="w-[46px] h-[46px] rounded-[11px] bg-gradient-to-br from-[#2a2358] to-[#1a1530] border border-white/[0.07] grid place-items-center text-2xl">
          {glyph}
        </div>
        <div className="text-right shrink-0">
          <div className="font-mono text-lg text-[#4fd8b8] font-medium">${agent.price_usd.toFixed(2)}</div>
          <div className="font-mono text-[10px] text-white/30 tracking-wider uppercase">per request</div>
        </div>
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-base text-white font-semibold tracking-tight truncate">{agent.display_name || agent.name}</span>
          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/[0.04] text-white/40 shrink-0">{label}</span>
        </div>
        <p className="m-0 text-[13px] text-white/55 leading-[1.5] line-clamp-2">{agent.description}</p>
      </div>
    </a>
  );
}

export default function Home() {
  const [agents, setAgents] = useState<AgentManifest[]>([]);
  const [erc8004Agents, setErc8004Agents] = useState<Erc8004Agent[]>([]);
  const [ratings, setRatings] = useState<Record<string, AgentRating>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentManifest | null>(null);
  const [selectedErc8004, setSelectedErc8004] = useState<Erc8004Agent | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [featured, setFeatured] = useState<AgentManifest[]>([]);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
    searchAgents("", "all")
      .then((all) => setFeatured(all.slice(0, 6)))
      .catch(() => {});
  }, []);

  const tickerAgents = useMemo(() => featured.slice(0, 5), [featured]);
  const receiptAgent = useMemo(() => featured[0] ?? null, [featured]);

  const handleSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearched(false);
      setAgents([]);
      setErc8004Agents([]);
      setSelectedAgent(null);
      setSelectedErc8004(null);
      return;
    }
    setLoading(true);
    setSearched(true);
    setSelectedAgent(null);
    setSelectedErc8004(null);
    try {
      const [registered, discovered] = await Promise.all([
        searchAgents(q, "all"),
        discoverAgents(q),
      ]);
      const registeredEns = new Set(registered.map((a) => a.ens));
      const slugify = (name: string) =>
        name.toLowerCase().replace(/\.eth$/, "").replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
      const registeredSlugs = new Set(registered.map((a) => a.ens.replace(/\.agents\.sources\.eth$/, "")));

      const promotionFetches = discovered
        .filter((a) => a.isRegistered && a.sourcesEns && !registeredEns.has(a.sourcesEns))
        .map((a) => getAgent(a.sourcesEns!).catch(() => null));
      const promoted = (await Promise.all(promotionFetches)).filter((m): m is AgentManifest => m !== null);
      const allRegistered = [...registered, ...promoted];
      const allRegisteredEns = new Set(allRegistered.map((a) => a.ens));
      const allRegisteredSlugs = new Set(allRegistered.map((a) => a.ens.replace(/\.agents\.sources\.eth$/, "")));

      setAgents(allRegistered);
      const unregistered = discovered.filter(
        (a) =>
          !(a.isRegistered && allRegisteredEns.has(a.sourcesEns ?? "")) &&
          !allRegisteredSlugs.has(slugify(a.name))
      );
      setErc8004Agents(unregistered);
      const ratingResults = await Promise.all(registered.map((a) => getRating(a.ens)));
      const map: Record<string, AgentRating> = {};
      ratingResults.forEach((r) => { map[r.ens] = r; });
      setRatings(map);
    } catch {
      setAgents([]);
      setErc8004Agents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const totalResults = agents.length + erc8004Agents.length;

  return (
    <div>
      {/* HERO */}
      <section className={`relative px-4 sm:px-7 ${!searched ? "pt-16 pb-20" : "pt-16 pb-6"}`}>
        <div className="max-w-5xl mx-auto relative">
          {!searched && <FloatingReceipt agent={receiptAgent} />}

          <div className="flex justify-center mb-6">
            <LiveTickerEyebrow agents={tickerAgents} />
          </div>

          <h1 className="text-center m-0 text-5xl sm:text-6xl lg:text-7xl font-semibold tracking-tight leading-[0.98] text-balance">
            <span className="block">Anything you need,</span>
            <span className="block text-[#7c6aff] italic font-medium">for pennies.</span>
          </h1>

          <p className="text-center max-w-xl mx-auto mt-7 text-[17px] text-white/55 leading-[1.55] text-balance">
            Search a marketplace of AI agents — image, audio, code, data. Pay per request in pennies.{" "}
            <span className="text-white">No email. No signup. No wallet connect.</span>
          </p>

          {/* Search */}
          <div className="max-w-2xl mx-auto mt-10">
            <SearchBar onSearch={handleSearch} />
          </div>

          {/* Category shortcuts */}
          {!searched && (
            <div className="flex flex-wrap justify-center gap-2 mt-5">
              {SHORTCUTS.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSearch(s.q)}
                  className="px-3.5 py-2 bg-white/[0.025] hover:bg-[#7c6aff]/10 border border-white/[0.07] hover:border-[#7c6aff]/30 rounded-lg text-sm text-white/55 hover:text-white transition-all"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Live platform stats — only real numbers */}
          {!searched && stats && (stats.permanent_agents > 0 || stats.total_transactions > 0 || stats.total_usdc_volume > 0) && (
            <div className="flex items-center justify-center gap-7 mt-11 font-mono">
              {stats.permanent_agents > 0 && (
                <>
                  <Stat value={stats.permanent_agents.toLocaleString()} label="permanent agents" />
                  <Divider />
                </>
              )}
              <Stat value={stats.total_transactions.toLocaleString()} label="paid requests" />
              <Divider />
              <Stat value={`$${(stats.total_usdc_volume / 1_000_000).toFixed(2)}`} label="USDC processed" accent />
            </div>
          )}
        </div>
      </section>

      {/* SEARCH RESULTS — render under hero when user searches */}
      {searched && (
        <section className="px-4 pb-12">
          {loading && <div className="text-center text-white/30 text-sm">Searching agents…</div>}

          {!loading && totalResults === 0 && (
            <div className="text-center mt-6">
              <div className="text-white/20 text-4xl mb-3">🤖</div>
              <p className="text-white/30">No agents found. Try a different search.</p>
            </div>
          )}

          {!loading && totalResults > 0 && (
            <div className="w-full max-w-2xl mx-auto flex flex-col gap-2">
              {agents.map((agent) => (
                <div key={agent.ens}>
                  <AgentCard
                    agent={agent}
                    rating={ratings[agent.ens]}
                    onSelect={(a) => { setSelectedAgent(a); setSelectedErc8004(null); }}
                    selected={selectedAgent?.ens === agent.ens}
                  />
                  {selectedAgent?.ens === agent.ens && (
                    <InlineAgentPanel agent={agent} onClose={() => setSelectedAgent(null)} />
                  )}
                </div>
              ))}
              {erc8004Agents.length > 0 && (
                <>
                  {agents.length > 0 && (
                    <div className="flex items-center gap-3 my-2">
                      <div className="flex-1 h-px bg-white/[0.05]" />
                      <span className="text-xs text-white/20 font-mono">ERC-8004 · not listed on sources.eth</span>
                      <div className="flex-1 h-px bg-white/[0.05]" />
                    </div>
                  )}
                  {erc8004Agents.map((agent) => (
                    <div key={`erc8004-${agent.agentId}-${agent.chain}`}>
                      <Erc8004AgentCard
                        agent={agent}
                        onSelect={(a) => { setSelectedErc8004(a); setSelectedAgent(null); }}
                        selected={selectedErc8004?.agentId === agent.agentId}
                      />
                      {selectedErc8004?.agentId === agent.agentId && (
                        <Erc8004AgentPanel agent={agent} onClose={() => setSelectedErc8004(null)} />
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </section>
      )}

      {/* All static sections only show when not searching */}
      {!searched && (
        <>
          {/* HOW IT WORKS */}
          <HowItWorks heroAgent={receiptAgent} />

          {/* TRUST STRIP */}
          <section className="py-14 px-7 border-t border-b border-white/[0.07] bg-white/[0.012]">
            <div className="max-w-5xl mx-auto">
              <p className="text-center font-mono text-[11px] tracking-[0.22em] uppercase text-white/35 m-0">
                x402 Foundation · supported by
              </p>
              <div className="flex flex-wrap items-center justify-center gap-x-14 gap-y-8 mt-8">
                {[
                  { name: "Google", src: "/logos/google.svg", h: 26 },
                  { name: "AWS", src: "/logos/aws.svg", h: 32 },
                  { name: "Cloudflare", src: "/logos/cloudflare.svg", h: 26 },
                  { name: "Stripe", src: "/logos/stripe.svg", h: 26 },
                  { name: "Base", src: "/logos/base.svg", h: 26 },
                ].map((logo) => (
                  <img
                    key={logo.name}
                    src={logo.src}
                    alt={logo.name}
                    style={{ height: logo.h, filter: "grayscale(1) brightness(2.2) contrast(0.5)", opacity: 0.55 }}
                  />
                ))}
              </div>
            </div>
          </section>

          {/* ECOSYSTEM PARTNERS */}
          <section className="py-20 px-7 border-t border-white/[0.07]">
            <div className="max-w-5xl mx-auto">
              <div className="text-center">
                <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-white/40">ecosystem partners</div>
                <h2 className="mt-3.5 text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.08]">
                  Building on <span className="text-[#7c6aff] italic font-medium">sources.eth.</span>
                </h2>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mt-10">
                {[1, 2, 3, 4].map((i) => (
                  <a
                    key={i}
                    href="mailto:hector.morel809@gmail.com?subject=sources.eth%20Ecosystem%20Partner"
                    className="group flex flex-col gap-4 p-5 bg-white/[0.025] hover:bg-[#7c6aff]/[0.06] border border-dashed border-white/[0.14] hover:border-[#7c6aff]/30 rounded-2xl transition-all min-h-[156px]"
                  >
                    <div className="w-[38px] h-[38px] rounded-[9px] bg-white/[0.04] border border-white/[0.07] grid place-items-center font-mono text-[13px] text-white/35">
                      {i}
                    </div>
                    <div className="mt-auto">
                      <div className="text-sm text-white/60 font-medium group-hover:text-white">Your brand here</div>
                      <div className="text-xs text-white/35 mt-1 leading-relaxed">Sponsor slot — reach builders and users paying for agents.</div>
                    </div>
                  </a>
                ))}
              </div>
              <p className="text-center text-xs text-white/35 mt-5">
                Interested in sponsoring?{" "}
                <a href="mailto:hector.morel809@gmail.com?subject=sources.eth%20Ecosystem%20Partner" className="text-[#7c6aff] hover:text-[#9a8cff]">
                  Get in touch →
                </a>
              </p>
            </div>
          </section>

          {/* FEATURED AGENTS */}
          {featured.length > 0 && (
            <section id="agents" className="py-24 px-7 border-t border-white/[0.07]">
              <div className="max-w-5xl mx-auto">
                <div className="flex items-end justify-between flex-wrap gap-4">
                  <div>
                    <div className="font-mono text-[11px] tracking-[0.2em] uppercase text-white/40">featured agents</div>
                    <h2 className="mt-3.5 text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.08]">
                      Live, paid, <span className="text-[#7c6aff] italic font-medium">popular today.</span>
                    </h2>
                  </div>
                  {stats && stats.permanent_agents > 0 && (
                    <button
                      onClick={() => handleSearch("agent")}
                      className="inline-flex items-center gap-1.5 text-sm text-[#7c6aff] hover:text-[#9a8cff] transition-colors"
                    >
                      Browse all {stats.permanent_agents.toLocaleString()} agents →
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 mt-10">
                  {featured.map((agent) => (
                    <FeaturedAgentCard key={agent.ens} agent={agent} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* FAQ */}
          <FAQ />
        </>
      )}
    </div>
  );
}

function Stat({ value, label, accent }: { value: string; label: string; accent?: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-lg font-medium ${accent ? "text-[#4fd8b8]" : "text-white"}`}>{value}</div>
      <div className="text-[11px] text-white/35 tracking-wider uppercase mt-0.5 font-mono">{label}</div>
    </div>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-white/[0.07]" />;
}
