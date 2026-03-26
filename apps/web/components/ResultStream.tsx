"use client";

import { useState } from "react";
import type { AgentManifest } from "@sources-eth/agent-manifest";
import { ResultShareBar } from "./ResultShareBar";

interface ResultStreamProps {
  result: unknown;
  agent: AgentManifest;
}

const IPFS_CID_PATTERN = /^(Qm[1-9A-HJ-NP-Za-km-z]{44,}|bafy[a-z2-7]{50,}|bafk[a-z2-7]{50,})/;

function extractCid(r: Record<string, unknown>): string | null {
  for (const key of ["cid", "ipfs_cid", "hash", "result"]) {
    const v = r[key];
    if (typeof v === "string" && IPFS_CID_PATTERN.test(v)) return v;
  }
  // Also check if url is an IPFS URL
  if (typeof r.url === "string") {
    const m = r.url.match(/\/ipfs\/(Qm[1-9A-HJ-NP-Za-km-z]{44,}|bafy[a-z2-7]{50,}|bafk[a-z2-7]{50,})/);
    if (m) return m[1];
  }
  return null;
}

function CidResult({ cid }: { cid: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(cid);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-white/30 font-mono uppercase tracking-wider">IPFS CID</span>
        <span className="text-xs text-[#4fd8b8] bg-[#4fd8b8]/10 border border-[#4fd8b8]/20 rounded px-1.5 py-0.5">pinned</span>
      </div>
      <div className="font-mono text-sm text-white/80 bg-black/30 rounded-lg px-4 py-3 break-all border border-white/[0.06]">
        {cid}
      </div>
      <div className="flex gap-2">
        <button
          onClick={copy}
          className="flex-1 py-2 bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.07] rounded-lg text-xs text-white/50 hover:text-white transition-all"
        >
          {copied ? "Copied!" : "Copy CID"}
        </button>
        <a
          href={`https://ipfs.io/ipfs/${cid}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 py-2 bg-[#4fd8b8]/10 hover:bg-[#4fd8b8]/20 border border-[#4fd8b8]/20 rounded-lg text-xs text-[#4fd8b8] text-center transition-all"
        >
          View on IPFS →
        </a>
      </div>
    </div>
  );
}

export function ResultStream({ result, agent }: ResultStreamProps) {
  const r = result as Record<string, unknown>;

  const renderResult = () => {
    // IPFS CID result (data/storage agents)
    const cid = extractCid(r);
    if (cid) return <CidResult cid={cid} />;

    if (r.url && typeof r.url === "string") {
      if (agent.output.type === "image") {
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={r.url} alt="Generated result" className="w-full rounded-lg" />
        );
      }
      if (agent.output.type === "audio") {
        return <audio controls src={r.url} className="w-full" />;
      }
      if (agent.output.type === "video") {
        return <video controls src={r.url} className="w-full rounded-lg" />;
      }
      // Generic URL result
      return (
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full py-2.5 text-center bg-[#7c6aff]/10 hover:bg-[#7c6aff]/20 border border-[#7c6aff]/20 rounded-lg text-sm text-[#7c6aff] transition-all"
        >
          View result →
        </a>
      );
    }

    if (r.text && typeof r.text === "string") {
      return (
        <pre className="whitespace-pre-wrap font-mono text-sm text-white/80 bg-black/20 rounded-lg p-4">
          {r.text}
        </pre>
      );
    }

    if (r.code && typeof r.code === "string") {
      return (
        <pre className="whitespace-pre-wrap font-mono text-sm text-white/80 bg-black/20 rounded-lg p-4 overflow-auto">
          {r.code}
        </pre>
      );
    }

    // Fallback: pretty JSON
    return (
      <pre className="font-mono text-xs text-white/50 bg-black/20 rounded-lg p-4 overflow-auto max-h-64">
        {JSON.stringify(result, null, 2)}
      </pre>
    );
  };

  const cid = extractCid(r);

  return (
    <div className="space-y-4">
      <div className="bg-[#16161f] border border-white/[0.07] rounded-xl p-4">
        {renderResult()}
      </div>
      <ResultShareBar
        payload={{
          agentName: agent.display_name,
          agentEns: agent.ens,
          category: agent.category,
          price: `$${agent.price_usd.toFixed(2)}`,
          resultUrl: typeof r.url === "string" ? r.url : cid ? `https://ipfs.io/ipfs/${cid}` : undefined,
        }}
      />
    </div>
  );
}
