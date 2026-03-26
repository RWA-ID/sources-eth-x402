"use client";

import { useEffect, useState } from "react";
import type { AgentManifest } from "@sources-eth/agent-manifest";
import { getAgent, initiateGenerate, generateWithPayment, upgradeAgent, getRating, submitRating } from "../../lib/api";
import { PaymentModal } from "../../components/PaymentModal";

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
import { ResultStream } from "../../components/ResultStream";
import { StarRating } from "../../components/StarRating";
import type { AgentRating } from "@sources-eth/agent-manifest";

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

export default function AgentPageClient({ ens }: { ens: string }) {
  const [agent, setAgent] = useState<AgentManifest | null>(null);
  const [expired, setExpired] = useState(false);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [pendingProof, setPendingProof] = useState<string | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [upgradePaymentRequest, setUpgradePaymentRequest] = useState<PaymentRequest | null>(null);
  const [rating, setRating] = useState<AgentRating | null>(null);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    getAgent(ens)
      .then((a) => {
        if (!a) setExpired(true);
        else {
          setAgent(a);
          getRating(ens).then(setRating);
        }
      })
      .catch((e) => setFetchError(e instanceof Error ? e.message : "Failed to load agent"))
      .finally(() => setLoading(false));
  }, [ens]);

  const handleRate = async (stars: number) => {
    const updated = await submitRating(ens, stars);
    setRating(updated);
  };

  const handleGenerate = async () => {
    if (!agent || !prompt) return;
    setGenerating(true);
    setError("");
    try {
      const res = await initiateGenerate(agent.ens, prompt);
      if ("requires402" in res) {
        setPaymentRequest(res.paymentRequest as PaymentRequest);
      } else {
        setResult(res.result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handlePayment = async (proof: string) => {
    setPaymentRequest(null);
    if (!agent) return;
    setGenerating(true);
    try {
      const res = await generateWithPayment(agent.ens, prompt, proof);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed after payment");
    } finally {
      setGenerating(false);
    }
  };

  const handleUpgrade = async () => {
    const res = await upgradeAgent(ens);
    if ("requires402" in res) {
      setUpgradePaymentRequest(res.paymentRequest as PaymentRequest);
    }
  };

  const handleUpgradePayment = async (proof: string) => {
    setUpgradePaymentRequest(null);
    await upgradeAgent(ens, proof);
    window.location.reload();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-white/30">
        Loading agent...
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <h1 className="text-xl font-semibold mb-2">Could not load agent</h1>
        <p className="text-white/40 text-sm mb-4 font-mono">{fetchError}</p>
        <a href="/" className="text-[#7c6aff] text-sm hover:underline">← Back to search</a>
      </div>
    );
  }

  if (expired) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <div className="text-4xl mb-4">⏰</div>
        <h1 className="text-xl font-semibold mb-2">Trial expired</h1>
        <p className="text-white/40 text-sm mb-6">
          This agent&apos;s trial period has ended. Upgrade for $39 to restore it permanently.
        </p>
        <button
          onClick={handleUpgrade}
          className="px-6 py-3 bg-[#7c6aff] hover:bg-[#6b59ee] rounded-lg font-medium transition-all"
        >
          Upgrade for $39
        </button>
        {upgradePaymentRequest && (
          <PaymentModal
            paymentRequest={upgradePaymentRequest}
            agentName="Upgrade to Permanent"
            onPaid={handleUpgradePayment}
            onClose={() => setUpgradePaymentRequest(null)}
          />
        )}
      </div>
    );
  }

  if (!agent) return null;

  const icon = CATEGORY_ICONS[agent.category] ?? "✨";

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Back */}
      <a
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-white/30 hover:text-white/70 transition-colors mb-8"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
        Back to search
      </a>

      {/* Header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center overflow-hidden flex-shrink-0">
          {agent.favicon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agent.favicon_url} alt={agent.display_name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">{icon}</span>
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-1">{agent.display_name}</h1>
          <p className="text-white/50 mb-2">{agent.description}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-[#7c6aff]">{agent.ens}</span>
            <span className="font-mono text-sm text-[#4fd8b8]">${agent.price_usd.toFixed(2)}</span>
            {agent.avg_latency_ms && (
              <span className="text-sm text-white/25">~{(agent.avg_latency_ms / 1000).toFixed(1)}s</span>
            )}
          </div>
          {rating !== null && (
            <div className="mt-2">
              <StarRating avg={rating.avg} count={rating.count} size="md" />
            </div>
          )}
        </div>
      </div>

      {/* Tags */}
      {agent.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-8">
          {agent.tags.map((tag) => (
            <span key={tag} className="px-2 py-1 bg-white/[0.05] rounded text-xs text-white/40">
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Prompt */}
      {!result && (
        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your prompt..."
            rows={4}
            maxLength={1000}
            className="w-full px-4 py-3 bg-[#16161f] border border-white/[0.07] rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#7c6aff]/50 focus:ring-1 focus:ring-[#7c6aff]/30 transition-all resize-none"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleGenerate}
            disabled={!prompt || generating}
            className="w-full py-3 bg-[#7c6aff] hover:bg-[#6b59ee] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium transition-all"
          >
            {generating ? "Generating..." : `Pay $${agent.price_usd.toFixed(2)} & generate`}
          </button>
          <p className="text-xs text-center text-white/25">
            You&apos;ll scan a QR code to pay. No wallet connection needed.
          </p>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          <ResultStream result={result} agent={agent} />
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30">Rate this agent</span>
              <StarRating
                avg={0}
                count={0}
                interactive
                size="md"
                onRate={handleRate}
              />
            </div>
          </div>
          <button
            onClick={() => { setResult(null); setPrompt(""); }}
            className="w-full py-2.5 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-sm text-white/50 hover:text-white transition-all"
          >
            Generate another
          </button>
        </div>
      )}

      {/* Payment modal */}
      {paymentRequest && (
        <PaymentModal
          paymentRequest={paymentRequest}
          agentName={agent.display_name}
          onPaid={handlePayment}
          onClose={() => setPaymentRequest(null)}
        />
      )}
    </div>
  );
}
