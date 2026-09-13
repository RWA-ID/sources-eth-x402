"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { useAppKit, useAppKitAccount, useDisconnect } from "@reown/appkit/react";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";

type VerifyStatus = "idle" | "checking" | "verified" | "not-found" | "error";

interface Props {
  /** Renders a compact inline version for embedding inside a form */
  compact?: boolean;
  /** If provided, shows a hint asking builder to connect this specific address */
  paymentAddress?: string;
}

export function HumanVerifyWidget({ compact = false, paymentAddress }: Props) {
  const { open } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { disconnect } = useDisconnect();
  const [status, setStatus] = useState<VerifyStatus>("idle");
  const [checkedAddress, setCheckedAddress] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const runCheck = useCallback(async (addr: string) => {
    setStatus("checking");
    try {
      const res = await fetch(`${WORKER_URL}/world/verify?address=${encodeURIComponent(addr)}`);
      // A failed lookup answers 502. Reading the body regardless would report
      // a broken verification service as "this person is not a human" — the
      // same conflation the worker used to make.
      if (!res.ok) {
        setStatus("error");
        return;
      }
      const data = (await res.json()) as { verified: boolean };
      setStatus(data.verified ? "verified" : "not-found");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    if (!isConnected || !address) {
      setStatus("idle");
      setCheckedAddress(null);
      return;
    }
    if (address === checkedAddress) return;
    setCheckedAddress(address);
    void runCheck(address);
  }, [isConnected, address, checkedAddress, runCheck]);

  const registerCmd = `npx @worldcoin/agentkit-cli register ${address ?? ""}`;

  const copyCmd = async () => {
    try {
      await navigator.clipboard.writeText(registerCmd);
    } catch {
      // Clipboard is blocked in some contexts; fall back to a selection.
      const ta = document.createElement("textarea");
      ta.value = registerCmd;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* nothing else to try */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const addressHint = paymentAddress
    ? `${paymentAddress.slice(0, 6)}…${paymentAddress.slice(-4)}`
    : null;

  const content = (
    <>
      <div className="flex items-center gap-3 mb-2">
        <Image
          src="/human-verified.png"
          alt="Human Verified"
          width={compact ? 90 : 120}
          height={compact ? 60 : 80}
          className="object-contain flex-shrink-0"
          unoptimized
        />
        <div>
          <div className={compact ? "text-xs font-medium text-white/80 leading-tight" : "font-semibold text-white leading-tight"}>
            Human Verified Badge{" "}
            <span className="text-white/30 font-normal text-xs">— optional</span>
          </div>
          <div className="text-[10px] text-white/30 font-medium tracking-wide uppercase mt-0.5">
            Powered by World ID
          </div>
        </div>
      </div>

      {!compact && (
        <p className="text-sm text-white/40 mb-4">
          Agents backed by a real World ID human show a verified badge in search results.
          Connect the wallet you&apos;ll use as your payment address to check your status.
        </p>
      )}

      {compact && !isConnected && (
        <p className="text-xs text-white/35 mb-2">
          {addressHint
            ? `Connect wallet ${addressHint} to add a Human Verified badge to your listing.`
            : "Connect your payment wallet to check your World ID verification status."}
        </p>
      )}

      {!isConnected ? (
        <button
          onClick={() => open({ view: "Connect" })}
          className={
            compact
              ? "flex items-center gap-1.5 px-3 py-1.5 bg-[#f97316]/15 hover:bg-[#f97316]/25 border border-[#f97316]/40 rounded-lg text-xs text-[#fdba74] hover:text-white transition-all font-medium"
              : "flex items-center gap-2 px-4 py-2.5 bg-[#f97316]/15 hover:bg-[#f97316]/25 border border-[#f97316]/40 hover:border-[#f97316]/60 rounded-xl text-sm text-[#fdba74] hover:text-white transition-all font-medium"
          }
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="2" y="7" width="20" height="14" rx="2" />
            <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            <line x1="12" y1="12" x2="12" y2="16" />
            <line x1="10" y1="14" x2="14" y2="14" />
          </svg>
          Connect owner wallet
        </button>
      ) : status === "checking" ? (
        <div className="flex items-center gap-2 text-xs text-white/40">
          <span className="inline-block w-3 h-3 border-2 border-white/20 border-t-[#f97316] rounded-full animate-spin" />
          Checking AgentBook for{" "}
          <span className="font-mono text-white/60">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
        </div>
      ) : status === "verified" ? (
        <div className="space-y-2">
          <div className={`flex items-center gap-2 ${compact ? "px-3 py-2" : "px-4 py-3"} bg-[#14532d]/40 border border-[#22c55e]/30 rounded-xl`}>
            <Image src="/human-verified.png" alt="Human Verified" width={compact ? 20 : 28} height={compact ? 20 : 28} unoptimized />
            <div>
              <div className={`${compact ? "text-xs" : "text-sm"} font-semibold text-[#4ade80]`}>Human Verified ✓</div>
              <div className="text-xs text-white/50 font-mono truncate max-w-[220px]">{address}</div>
            </div>
          </div>
          {!compact && (
            <p className="text-xs text-white/35">
              Use <span className="font-mono text-white/50">{address}</span> as your payment address to display the badge on your listing.
            </p>
          )}
          <button onClick={() => disconnect()} className="text-xs text-white/25 hover:text-white/45 transition-colors">
            Disconnect
          </button>
        </div>
      ) : status === "not-found" ? (
        <div className="space-y-2">
          <div className={`${compact ? "px-3 py-2" : "px-4 py-3"} bg-white/[0.03] border border-white/[0.08] rounded-xl`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-white/40 truncate">{address?.slice(0, 10)}…</span>
              <span className="text-xs text-white/25">— not in AgentBook</span>
            </div>
            <p className="text-xs text-white/35 mb-1.5">
              Run this once to link this wallet to your World ID. It opens a World App
              verification, then registers the wallet on-chain — you only do it once per wallet.
            </p>
            <div className="relative">
              <code className="block text-xs text-[#fdba74] bg-black/30 rounded px-2 py-1.5 pr-16 font-mono break-all">
                {registerCmd}
              </code>
              <button
                type="button"
                onClick={copyCmd}
                aria-label="Copy the registration command"
                className="absolute top-1 right-1 px-2 py-1 rounded-md bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] font-mono text-[10px] text-white/60 hover:text-white transition-colors"
              >
                {copied ? "Copied!" : "Copy"}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => address && runCheck(address)}
              className="px-3 py-1.5 rounded-lg bg-[#f97316]/15 hover:bg-[#f97316]/25 border border-[#f97316]/40 text-xs text-[#fdba74] hover:text-white transition-all font-medium"
            >
              Check again
            </button>
            <span className="text-[11px] text-white/25">after running the command</span>
            <button onClick={() => disconnect()} className="ml-auto text-xs text-white/25 hover:text-white/45 transition-colors">
              Try a different wallet
            </button>
          </div>
        </div>
      ) : status === "error" ? (
        <div className="space-y-1.5">
          <p className="text-xs text-red-400/70">
            Could not reach the verification service — this is not a verdict on your wallet.
            You can still list your agent without the badge.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => address && runCheck(address)}
              className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.10] text-xs text-white/70 hover:text-white transition-all font-medium"
            >
              Retry
            </button>
            <button onClick={() => disconnect()} className="text-xs text-white/25 hover:text-white/45 transition-colors">
              Disconnect
            </button>
          </div>
        </div>
      ) : null}
    </>
  );

  if (compact) {
    return <div className="space-y-1">{content}</div>;
  }

  return (
    <div className="max-w-3xl mx-auto mb-12">
      <div className="bg-[#17130f] border border-white/[0.07] rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <Image src="/human-verified.png" alt="Human Verified" width={48} height={48} unoptimized />
          </div>
          <div className="flex-1 min-w-0">{content}</div>
        </div>
      </div>
    </div>
  );
}
