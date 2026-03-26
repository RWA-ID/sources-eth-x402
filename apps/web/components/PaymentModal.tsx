"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import QRCode from "qrcode";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? "";

interface PaymentRequest {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    payTo: string;
    asset: string;
    maxTimeoutSeconds: number;
  }>;
}

interface PaymentModalProps {
  paymentRequest: PaymentRequest;
  agentName: string;
  onPaid: (paymentProof: string) => void;
  onClose: () => void;
}

export function PaymentModal({
  paymentRequest,
  agentName,
  onPaid,
  onClose,
}: PaymentModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copied, setCopied] = useState(false);
  const [polling, setPolling] = useState(false);
  const [detected, setDetected] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const accept = paymentRequest.accepts[0];
  const amountRaw = parseInt(accept.maxAmountRequired, 10);
  const amountUsd = (amountRaw / 1_000_000).toFixed(2);

  useEffect(() => {
    if (canvasRef.current) {
      QRCode.toCanvas(canvasRef.current, accept.payTo, {
        width: 220,
        margin: 2,
        color: { dark: "#ffffff", light: "#16161f" },
      });
    }
  }, [accept.payTo]);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (polling) return;
    setPolling(true);
    startTimeRef.current = Date.now();

    pollRef.current = setInterval(async () => {
      try {
        const params = new URLSearchParams({
          payTo: accept.payTo,
          amount: accept.maxAmountRequired,
          after: startTimeRef.current.toString(),
        });
        const res = await fetch(`${WORKER_URL}/detect-payment?${params}`);
        const data = await res.json() as { found: boolean; txHash?: string };
        if (data.found && data.txHash) {
          stopPolling();
          setDetected(true);
          const proof = btoa(JSON.stringify({ transaction: data.txHash }));
          setTimeout(() => onPaid(proof), 800);
        }
      } catch {
        // keep polling on transient errors
      }
    }, 3000);
  }, [polling, accept.payTo, accept.maxAmountRequired, stopPolling, onPaid]);

  // Clean up on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleCopy = () => {
    navigator.clipboard.writeText(accept.payTo).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-[#16161f] border border-white/[0.07] rounded-2xl p-6 max-w-sm w-full shadow-[0_0_60px_rgba(124,106,255,0.15)]">

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-semibold text-lg">Pay to generate</h2>
          <button onClick={() => { stopPolling(); onClose(); }} className="text-white/30 hover:text-white transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Amount */}
        <div className="text-center mb-5">
          <div className="text-3xl font-bold text-[#4fd8b8] mb-1">${amountUsd} USDC</div>
          <div className="text-sm text-white/40">{agentName} · Base network</div>
        </div>

        {/* QR — plain address, scan with any wallet */}
        <div className="flex justify-center mb-4">
          <div className="block p-3 bg-[#111118] rounded-xl border border-white/[0.07]">
            <canvas ref={canvasRef} className="rounded" />
          </div>
        </div>

        {/* Instructions */}
        <ol className="space-y-1.5 text-xs text-white/40 mb-4 px-1">
          <li><span className="text-white/60">1.</span> Scan QR with your wallet — send <span className="text-[#4fd8b8]">${amountUsd} USDC</span> on <span className="text-white/60">Base</span></li>
          <li><span className="text-white/60">2.</span> Select USDC on Base network and confirm the transfer</li>
          <li><span className="text-white/60">3.</span> Come back here — payment detected automatically</li>
        </ol>

        {/* Address copy */}
        <div className="bg-[#111118] border border-white/[0.07] rounded-lg px-3 py-2.5 mb-3">
          <div className="text-xs text-white/30 mb-1">Or copy address (USDC · Base)</div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-white/60 flex-1 truncate">{accept.payTo}</span>
            <button
              onClick={handleCopy}
              className="flex-shrink-0 text-xs px-2 py-1 bg-white/[0.05] hover:bg-white/[0.08] rounded transition-all text-white/40 hover:text-white"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Status / CTA */}
        {detected ? (
          <div className="w-full py-2.5 bg-[#4fd8b8]/20 border border-[#4fd8b8]/30 rounded-lg text-sm font-medium text-[#4fd8b8] text-center">
            ✓ Payment detected — processing...
          </div>
        ) : polling ? (
          <div className="w-full py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-lg text-sm text-white/40 text-center flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            Watching for payment...
          </div>
        ) : (
          <button
            onClick={startPolling}
            className="w-full py-2.5 bg-[#7c6aff] hover:bg-[#6b59ee] rounded-lg text-sm font-medium transition-all"
          >
            I&apos;ve paid — watch for confirmation
          </button>
        )}

      </div>
    </div>
  );
}
