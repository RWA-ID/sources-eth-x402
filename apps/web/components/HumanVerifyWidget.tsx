"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useAppKit, useAppKitAccount, useDisconnect } from "@reown/appkit/react";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";

type VerifyStatus = "idle" | "checking" | "verified" | "not-found" | "error";

export function HumanVerifyWidget() {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [checkedAddress, setCheckedAddress] = useState<string | null>(null);

  // Auto-check AgentBook whenever a wallet connects
  useEffect(() => {
    if (!isConnected || !address) {
      setStatus("idle");
      setCheckedAddress(null);
      return;
    }
    if (address === checkedAddress) return; // already checked this address
    setCheckedAddress(address);
    setStatus("checking");

    fetch(`${WORKER_URL}/world/verify?address=${encodeURIComponent(address)}`)
      .then((r) => r.json() as Promise<{ verified: boolean }>)
      .then((data) => setStatus(data.verified ? "verified" : "not-found"))
      .catch(() => setStatus("error"));
  }, [isConnected, address, checkedAddress]);

  return (
    <div className="max-w-3xl mx-auto mb-12">
      <div className="bg-[#16161f] border border-white/[0.07] rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Image src="/human-verified.png" alt="Human Verified" width={48} height={48} unoptimized />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white mb-1">Human Verified badge <span className="text-white/30 font-normal text-sm">— optional</span></h3>
            <p className="text-sm text-white/40 mb-4">
              Agents backed by a real World ID human show a verified badge in search results.
              Connect the wallet you&apos;ll use as your payment address to check your status.
            </p>

            {!isConnected ? (
              <button
                onClick={() => open({ view: "Connect" })}
                className="flex items-center gap-2 px-4 py-2.5 bg-[#7c6aff]/15 hover:bg-[#7c6aff]/25 border border-[#7c6aff]/40 hover:border-[#7c6aff]/60 rounded-xl text-sm text-[#a598ff] hover:text-white transition-all font-medium"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <line x1="12" y1="12" x2="12" y2="16" />
                  <line x1="10" y1="14" x2="14" y2="14" />
                </svg>
                Connect payment wallet
              </button>
            ) : status === "checking" ? (
              <div className="flex items-center gap-3 text-sm text-white/40">
                <span className="inline-block w-4 h-4 border-2 border-white/20 border-t-[#7c6aff] rounded-full animate-spin" />
                Checking AgentBook for <span className="font-mono text-white/60">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
              </div>
            ) : status === "verified" ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3 px-4 py-3 bg-[#14532d]/40 border border-[#22c55e]/30 rounded-xl">
                  <Image src="/human-verified.png" alt="Human Verified" width={28} height={28} unoptimized />
                  <div>
                    <div className="text-sm font-semibold text-[#4ade80]">Human Verified</div>
                    <div className="text-xs text-white/50 font-mono">{address}</div>
                  </div>
                </div>
                <p className="text-xs text-white/35">
                  Use <span className="font-mono text-white/50">{address}</span> as your payment address in the form below to display the badge on your listing.
                </p>
                <button onClick={() => disconnect()} className="text-xs text-white/25 hover:text-white/45 transition-colors">
                  Disconnect
                </button>
              </div>
            ) : status === "not-found" ? (
              <div className="space-y-3">
                <div className="px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-mono text-xs text-white/40 truncate">{address}</span>
                    <span className="text-xs text-white/25">— not in AgentBook</span>
                  </div>
                  <p className="text-xs text-white/40 mb-2">
                    To get verified, register your wallet via the World ID Agent Kit CLI:
                  </p>
                  <code className="block text-xs text-[#4fd8b8] bg-black/30 rounded-lg px-3 py-2 font-mono break-all">
                    npx @worldcoin/agentkit-cli register {address}
                  </code>
                </div>
                <button onClick={() => disconnect()} className="text-xs text-white/25 hover:text-white/45 transition-colors">
                  Try a different wallet
                </button>
              </div>
            ) : status === "error" ? (
              <div className="space-y-2">
                <p className="text-xs text-red-400/70">Could not reach verification service. You can still register — verification is checked automatically.</p>
                <button onClick={() => disconnect()} className="text-xs text-white/25 hover:text-white/45 transition-colors">
                  Disconnect
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
