"use client";

import { useState, useCallback, useEffect } from "react";
import type { AgentManifest, AgentRating } from "@sources-eth/agent-manifest";
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

export default function Home() {
  const [agents, setAgents] = useState<AgentManifest[]>([]);
  const [erc8004Agents, setErc8004Agents] = useState<Erc8004Agent[]>([]);
  const [ratings, setRatings] = useState<Record<string, AgentRating>>({});
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<AgentManifest | null>(null);
  const [selectedErc8004, setSelectedErc8004] = useState<Erc8004Agent | null>(null);
  const [stats, setStats] = useState<PlatformStats | null>(null);

  useEffect(() => {
    getStats().then(setStats).catch(() => {});
  }, []);

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
      <div className={`flex flex-col items-center w-full ${!searched ? "min-h-[75vh] justify-center pb-8" : "pt-16 pb-6"}`}>
        <div className="text-center mb-6">
          <p className="text-xs font-light tracking-[0.2em] text-white/60 uppercase mb-3">x402 Marketplace</p>
          <h1 className="text-5xl sm:text-7xl font-bold tracking-tight leading-tight mb-4">
            Anything You Need,{" "}
            <span className="text-[#7c6aff]">For Pennies.</span>
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
