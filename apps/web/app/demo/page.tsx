"use client";

import { useState } from "react";
import { PaymentModal } from "../../components/PaymentModal";
import { StarRating } from "../../components/StarRating";
import { ResultShareBar } from "../../components/ResultShareBar";

const MOCK_AGENT = {
  display_name: "FLUX Ultra",
  ens: "flux-ultra-gen.agents.sources.eth",
  description: "Photorealistic image generation using FLUX.1 Ultra model.",
  category: "generative-media" as const,
  price_usd: 0.05,
  avg_latency_ms: 8000,
  tags: ["photorealistic", "fast", "flux"],
  favicon_url: undefined as string | undefined,
};

const MOCK_402 = {
  x402Version: 1,
  accepts: [
    {
      scheme: "exact",
      network: "base-mainnet",
      maxAmountRequired: "50000",
      resource: "https://sources-x402-worker.dmpay.workers.dev/generate",
      description: "FLUX Ultra image generation",
      mimeType: "application/json",
      payTo: "0x116fC3Bb1E3b48d39718b0D19D286f6B44DC7ED3",
      maxTimeoutSeconds: 300,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      extra: { name: "USD Coin", version: "2" },
    },
  ],
};

const MOCK_RESULT = {
  url: "https://images.unsplash.com/photo-1717501219905-2711c58ab655?w=800&q=80",
};

type Step = "prompt" | "paying" | "result";

export default function DemoPage() {
  const [step, setStep] = useState<Step>("prompt");
  const [prompt, setPrompt] = useState("");
  const [rating, setRating] = useState({ avg: 4.2, count: 38 });

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Demo banner */}
      <div className="mb-8 px-4 py-2.5 bg-[#7c6aff]/10 border border-[#7c6aff]/20 rounded-lg text-sm text-[#7c6aff] text-center">
        UI Preview — this is a demo with mock data
      </div>

      {/* Agent header */}
      <div className="flex items-start gap-4 mb-8">
        <div className="w-14 h-14 rounded-xl bg-white/[0.05] border border-white/[0.07] flex items-center justify-center text-3xl flex-shrink-0">
          🎨
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold mb-1">{MOCK_AGENT.display_name}</h1>
          <p className="text-white/50 mb-2">{MOCK_AGENT.description}</p>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="font-mono text-sm text-[#7c6aff]">{MOCK_AGENT.ens}</span>
            <span className="font-mono text-sm text-[#4fd8b8]">${MOCK_AGENT.price_usd.toFixed(2)}</span>
            <span className="text-sm text-white/25">~8s</span>
          </div>
          <div className="mt-2">
            <StarRating avg={rating.avg} count={rating.count} size="md" />
          </div>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-8">
        {MOCK_AGENT.tags.map((tag) => (
          <span key={tag} className="px-2 py-1 bg-white/[0.05] rounded text-xs text-white/40">
            {tag}
          </span>
        ))}
      </div>

      {/* Step: Prompt */}
      {step === "prompt" && (
        <div className="space-y-3">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="A futuristic city at night with neon lights reflecting on rain-soaked streets..."
            rows={4}
            className="w-full px-4 py-3 bg-[#16161f] border border-white/[0.07] rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#7c6aff]/50 focus:ring-1 focus:ring-[#7c6aff]/30 transition-all resize-none"
          />
          <button
            onClick={() => setStep("paying")}
            disabled={!prompt}
            className="w-full py-3 bg-[#7c6aff] hover:bg-[#6b59ee] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium transition-all"
          >
            Pay $0.05 &amp; generate
          </button>
          <p className="text-xs text-center text-white/25">
            You&apos;ll scan a QR code to pay. No wallet connection needed.
          </p>
        </div>
      )}

      {/* Step: Result */}
      {step === "result" && (
        <div className="space-y-4">
          <div className="bg-[#16161f] border border-white/[0.07] rounded-xl overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={MOCK_RESULT.url} alt="Generated result" className="w-full" />
          </div>

          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/30">Rate this agent</span>
              <StarRating
                avg={0}
                count={0}
                interactive
                size="md"
                onRate={(stars) => {
                  setRating((r) => {
                    const newTotal = r.avg * r.count + stars;
                    const newCount = r.count + 1;
                    return { avg: Math.round((newTotal / newCount) * 10) / 10, count: newCount };
                  });
                }}
              />
            </div>
          </div>

          <ResultShareBar
            payload={{
              agentName: MOCK_AGENT.display_name,
              agentEns: MOCK_AGENT.ens,
              category: MOCK_AGENT.category,
              price: "$0.05",
              resultUrl: MOCK_RESULT.url,
            }}
          />

          <button
            onClick={() => { setStep("prompt"); setPrompt(""); }}
            className="w-full py-2.5 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-sm text-white/50 hover:text-white transition-all"
          >
            Generate another
          </button>
        </div>
      )}

      {/* Payment modal */}
      {step === "paying" && (
        <PaymentModal
          paymentRequest={MOCK_402}
          agentName={MOCK_AGENT.display_name}
          onPaid={() => setStep("result")}
          onClose={() => setStep("prompt")}
        />
      )}
    </div>
  );
}
