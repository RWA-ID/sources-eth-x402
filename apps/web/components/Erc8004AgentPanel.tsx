"use client";

import { useState, useEffect } from "react";
import type { AgentManifest } from "@sources-eth/agent-manifest";
import type { Erc8004Agent } from "../lib/api";
import { getAgent } from "../lib/api";
import { InlineAgentPanel } from "./InlineAgentPanel";

function serviceTypeBadge(name: string): string {
  switch (name.toLowerCase()) {
    case "mcp":   return "bg-[#7c6aff]/10 border-[#7c6aff]/30 text-[#7c6aff]";
    case "a2a":   return "bg-[#f59e0b]/10 border-[#f59e0b]/30 text-[#f59e0b]";
    case "oasf":  return "bg-[#3b82f6]/10 border-[#3b82f6]/30 text-[#3b82f6]";
    case "web":   return "bg-[#4fd8b8]/10 border-[#4fd8b8]/30 text-[#4fd8b8]";
    case "email": return "bg-white/[0.05] border-white/[0.12] text-white/40";
    default:      return "bg-white/[0.05] border-white/[0.08] text-white/50";
  }
}

interface Erc8004AgentPanelProps {
  agent: Erc8004Agent;
  onClose: () => void;
}

export function Erc8004AgentPanel({ agent, onClose }: Erc8004AgentPanelProps) {
  const [registeredManifest, setRegisteredManifest] = useState<AgentManifest | null>(null);
  const [fetchingManifest, setFetchingManifest] = useState(agent.isRegistered && !!agent.sourcesEns);

  useEffect(() => {
    if (!agent.isRegistered || !agent.sourcesEns) return;
    getAgent(agent.sourcesEns)
      .then((m) => setRegisteredManifest(m))
      .catch(() => {})
      .finally(() => setFetchingManifest(false));
  }, [agent.isRegistered, agent.sourcesEns]);

  // If agent is registered on sources.eth, hand off to full interaction panel
  if (fetchingManifest) {
    return (
      <div className="mt-2 bg-[#16161f] border border-[#7c6aff]/30 rounded-xl p-5 flex items-center gap-3 text-white/30 text-sm animate-pulse">
        <svg className="w-4 h-4 animate-spin flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
        Loading agent interface...
      </div>
    );
  }

  if (registeredManifest) {
    return <InlineAgentPanel agent={registeredManifest} onClose={onClose} />;
  }

  const registerUrl = `/register?prefill=${encodeURIComponent(
    JSON.stringify({
      name: agent.name,
      description: agent.description,
      image: agent.image,
    })
  )}`;

  return (
    <div className="mt-2 bg-[#16161f] border border-white/[0.12] rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          {agent.image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agent.image} alt="" className="w-7 h-7 rounded-md object-cover" />
          )}
          <span className="font-semibold text-sm text-white/80">{agent.name}</span>
          <span className="px-1.5 py-0.5 bg-white/[0.04] border border-white/[0.08] rounded text-[10px] text-white/30 font-mono">
            ERC-8004 #{agent.agentId}
          </span>
          {agent.x402Support && (
            <span className="px-1.5 py-0.5 bg-[#4fd8b8]/10 border border-[#4fd8b8]/20 rounded text-[10px] font-mono text-[#4fd8b8]">
              x402 native
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white transition-colors p-1"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Description */}
        <p className="text-sm text-white/50">{agent.description}</p>

        {/* Services */}
        {agent.services.length > 0 && (
          <div>
            <div className="text-xs text-white/30 mb-2">Services</div>
            <div className="space-y-1.5">
              {agent.services.map((s) => (
                <div key={s.name} className="flex items-center gap-2 text-sm">
                  <span className={`font-mono text-[10px] rounded px-2 py-0.5 border flex-shrink-0 ${serviceTypeBadge(s.name)}`}>
                    {s.name.toUpperCase()}
                  </span>
                  <span className="text-xs text-white/25 font-mono truncate">{s.endpoint}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Owner */}
        <div>
          <div className="text-xs text-white/30 mb-1">Owner</div>
          <div className="font-mono text-xs text-white/40 truncate">{agent.owner}</div>
        </div>

        {/* Not registered CTA */}
        <div className="bg-[#7c6aff]/10 border border-[#7c6aff]/20 rounded-xl p-4 space-y-3">
          <div className="text-sm font-medium text-white/80">
            This agent is on ERC-8004 but not listed on sources.eth
          </div>
          <p className="text-xs text-white/40 leading-relaxed">
            List it to make it discoverable and usable through sources.eth. Users will be able to pay and use it directly — no setup on their end.
            {agent.x402Support && (
              <> Since it already supports x402 payments, your payment address will be set automatically.</>
            )}
          </p>
          <a
            href={registerUrl}
            className="block w-full text-center py-2.5 bg-[#7c6aff] hover:bg-[#6b59ee] rounded-lg text-sm font-medium transition-all"
          >
            List this agent — free 15-day trial →
          </a>
        </div>
      </div>
    </div>
  );
}
