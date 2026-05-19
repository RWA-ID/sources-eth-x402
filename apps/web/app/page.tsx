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

function LiveTickerEyebrow({ agents }: { agents: AgentManifest[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (agents.length === 0) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % agents.length), 2400);
    return () => clearInterval(id);
  }, [agents.length]);
  const current = agents[idx];
  return (
    <div className="inline-flex items-center gap-3 px-3.5 py-1.5 bg-white/[0.03] border border-white/[0.07] rounded-full text-[12px] font-mono text-white/40 max-w-[calc(100vw-56px)] overflow-hidden whitespace-nowrap">
      <span className="text-white/55">x402 marketplace</span>
      {current && (
        <>
          <span className="text-white/18">·</span>
          <span className="inline-flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#4fd8b8] animate-pulse" />
            <span className="text-[#4fd8b8]">${current.price_usd.toFixed(2)}</span>
            <span className="text-white/18">·</span>
            <span className="text-[#7c6aff]">{current.name}</span>
          </span>
        </>
      )}
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
    // Featured agents — pull a broad sample, take top 6
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
      // Also track slugs so we can filter stale-cached discover results
      const registeredSlugs = new Set(
        registered.map((a) => a.ens.replace(/\.agents\.sources\.eth$/, ""))
      );

      // Promote isRegistered ERC-8004 agents into the registered section if not already there
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
    <div className="flex flex-col items-center px-4">

      {/* Hero — vertically centered when not searching, compact when results show */}
      <div className={`relative flex flex-col items-center w-full ${!searched ? "min-h-[75vh] justify-center pb-8" : "pt-16 pb-6"}`}>
        {!searched && <FloatingReceipt agent={receiptAgent} />}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-5">
            <LiveTickerEyebrow agents={tickerAgents} />
          </div>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-tight mb-4">
            Anything You Need,{" "}
            <span className="text-[#7c6aff] italic font-medium">For Pennies.</span>
          </h1>
          <p className="text-white/30 text-base max-w-sm mx-auto">
            No email. No Connect Wallet. Just pay and go.
          </p>
        </div>

        {/* Search */}
        <div className="w-full max-w-2xl">
          <SearchBar onSearch={handleSearch} />
        </div>

        {/* Category shortcuts */}
        {!searched && (
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {SHORTCUTS.map((s) => (
              <button
                key={s.label}
                onClick={() => handleSearch(s.q)}
                className="px-3 py-1.5 bg-white/[0.04] hover:bg-[#7c6aff]/10 border border-white/[0.07] hover:border-[#7c6aff]/30 rounded-lg text-sm text-white/50 hover:text-white/80 transition-all"
              >
                {s.label}
              </button>
            ))}
          </div>
        )}

        {/* Platform stats */}
        {!searched && stats && (
          <div className="flex items-center gap-6 mt-6 text-center">
            <div>
              <div className="text-lg font-semibold text-white">{stats.permanent_agents.toLocaleString()}</div>
              <div className="text-xs text-white/30 tracking-wide">Permanent Agents</div>
            </div>
            <div className="w-px h-8 bg-white/[0.07]" />
            <div>
              <div className="text-lg font-semibold text-white">{stats.total_transactions.toLocaleString()}</div>
              <div className="text-xs text-white/30 tracking-wide">Paid Requests</div>
            </div>
            <div className="w-px h-8 bg-white/[0.07]" />
            <div>
              <div className="text-lg font-semibold text-[#4fd8b8]">
                ${(stats.total_usdc_volume / 1_000_000).toFixed(2)}
              </div>
              <div className="text-xs text-white/30 tracking-wide">USDC Processed</div>
            </div>
          </div>
        )}

        {/* Below-search tagline */}
        {!searched && (
          <div className="text-center mt-14">
            <p className="text-xl sm:text-2xl font-semibold text-white/80 mb-3">
              Pay AI Agents Like You Pay For Coffee
            </p>
            <p className="text-white/40 text-sm max-w-lg mx-auto leading-relaxed">
              Search, scan a QR code, send USDC on Base, and get your result. No accounts, no API keys, no wallet setup.
            </p>
          </div>
        )}

        {/* x402 Foundation backers */}
        {!searched && (
          <div className="w-full max-w-4xl mt-16">
            <p className="text-center text-xs font-light tracking-[0.2em] text-white/40 uppercase mb-6">
              x402 Foundation Supported By
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
              {[
                { name: "Google", src: "/logos/google.svg", h: "h-7" },
                { name: "AWS", src: "/logos/aws.svg", h: "h-8" },
                { name: "Cloudflare", src: "/logos/cloudflare.svg", h: "h-7" },
                { name: "Stripe", src: "/logos/stripe.svg", h: "h-7" },
                { name: "Base", src: "/logos/base.svg", h: "h-7" },
              ].map((logo) => (
                <img
                  key={logo.name}
                  src={logo.src}
                  alt={logo.name}
                  className={`${logo.h} w-auto opacity-60 hover:opacity-100 transition-opacity`}
                />
              ))}
            </div>
          </div>
        )}

        {/* sources.eth Ecosystem Partners */}
        {!searched && (
          <div className="w-full max-w-5xl mt-16 mb-8">
            <div className="text-center mb-6">
              <p className="text-xs font-light tracking-[0.2em] text-white/40 uppercase mb-2">
                Ecosystem Partners
              </p>
              <h2 className="text-2xl sm:text-3xl font-semibold text-white/90">
                Building on sources.eth
              </h2>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <a
                  key={i}
                  href="mailto:hector.morel809@gmail.com?subject=sources.eth%20Ecosystem%20Partner"
                  className="group block bg-white/[0.03] hover:bg-[#7c6aff]/[0.06] border border-white/[0.07] hover:border-[#7c6aff]/30 rounded-xl p-5 transition-all"
                >
                  <div className="h-10 w-10 rounded-lg bg-white/[0.04] border border-white/[0.05] mb-3 flex items-center justify-center text-white/30 text-xs font-mono">
                    {i}
                  </div>
                  <div className="text-sm font-medium text-white/60 group-hover:text-white/90 mb-1">
                    Your brand here
                  </div>
                  <div className="text-xs text-white/30 leading-relaxed">
                    Sponsor slot — reach builders and users paying for AI agents.
                  </div>
                </a>
              ))}
            </div>
            <p className="text-center text-xs text-white/30 mt-4">
              Interested in sponsoring?{" "}
              <a
                href="mailto:hector.morel809@gmail.com?subject=sources.eth%20Ecosystem%20Partner"
                className="text-[#7c6aff] hover:text-[#9a8cff] transition-colors"
              >
                Get in touch →
              </a>
            </p>
          </div>
        )}

        {/* Featured agents */}
        {!searched && featured.length > 0 && (
          <div className="w-full max-w-5xl mt-16 mb-8">
            <div className="flex items-end justify-between flex-wrap gap-4 mb-10">
              <div>
                <p className="text-xs font-light tracking-[0.2em] text-white/40 uppercase mb-3">
                  Featured Agents
                </p>
                <h2 className="text-2xl sm:text-4xl font-semibold tracking-tight text-white/90">
                  Live, paid, popular today.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {featured.map((agent) => (
                <FeaturedAgentCard key={agent.ens} agent={agent} />
              ))}
            </div>
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-12 text-white/30 text-sm">Searching agents...</div>
      )}

      {!loading && searched && totalResults === 0 && (
        <div className="mt-12 text-center">
          <div className="text-white/20 text-4xl mb-3">🤖</div>
          <p className="text-white/30">No agents found. Try a different search.</p>
        </div>
      )}

      {!loading && searched && totalResults > 0 && (
        <div className="w-full max-w-2xl mt-8 flex flex-col gap-2">
          {agents.map((agent) => (
            <div key={agent.ens}>
              <AgentCard
                agent={agent}
                rating={ratings[agent.ens]}
                onSelect={(a) => { setSelectedAgent(a); setSelectedErc8004(null); }}
                selected={selectedAgent?.ens === agent.ens}
              />
              {selectedAgent?.ens === agent.ens && (
                <InlineAgentPanel
                  agent={agent}
                  onClose={() => setSelectedAgent(null)}
                />
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
                    <Erc8004AgentPanel
                      agent={agent}
                      onClose={() => setSelectedErc8004(null)}
                    />
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      )}

    </div>
  );
}
