"use client";

import { useState } from "react";
import { PaymentModal } from "../../components/PaymentModal";

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? "http://localhost:8787";

const CODE_EXAMPLE = `// 1. First request — get the 402 payment requirement
const res = await fetch("${WORKER_URL}/x402/proxy", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-KEY": "sk_live_your_key_here",
  },
  body: JSON.stringify({
    endpoint: "https://your-agent.xyz/generate",
    prompt: "A futuristic city at night",
    payment_address: "0xAGENT_WALLET_ADDRESS",
    price_usd: 0.05,
  }),
});
// res.status === 402 → scan QR, get payment proof

// 2. Second request — with payment proof
const result = await fetch("${WORKER_URL}/x402/proxy", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-KEY": "sk_live_your_key_here",
    "X-PAYMENT": "<base64_payment_proof>",
  },
  body: JSON.stringify({ ... }),
});
const data = await result.json();`;

const MOCK_402 = {
  x402Version: 1,
  accepts: [
    {
      scheme: "exact",
      network: "base-mainnet",
      maxAmountRequired: "99000000",
      resource: `${WORKER_URL}/developer/register`,
      description: "sources.eth — Developer API Key ($99/year)",
      mimeType: "application/json",
      payTo: "0x116fC3Bb1E3b48d39718b0D19D286f6B44DC7ED3",
      maxTimeoutSeconds: 300,
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      extra: { name: "USD Coin", version: "2" },
    },
  ],
};

export default function DeveloperPage() {
  const [label, setLabel] = useState("");
  const [paymentModal, setPaymentModal] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGetKey = async () => {
    // First call — get the 402
    const res = await fetch(`${WORKER_URL}/developer/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: label || "My API Key" }),
    });
    if (res.status === 402) {
      setPaymentModal(true);
    } else {
      setError("Unexpected response from server");
    }
  };

  const handlePayment = async (proof: string) => {
    setPaymentModal(false);
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${WORKER_URL}/developer/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT": proof,
        },
        body: JSON.stringify({ label: label || "My API Key" }),
      });
      const data = await res.json() as { api_key?: string; error?: string };
      if (data.api_key) {
        setApiKey(data.api_key);
      } else {
        setError(data.error ?? "Failed to generate key");
      }
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="px-4 py-16 max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-12">
        <div className="inline-block px-3 py-1 bg-[#7c6aff]/10 border border-[#7c6aff]/20 rounded-full text-xs text-[#7c6aff] mb-4">
          Developer API
        </div>
        <h1 className="text-3xl font-bold mb-3">x402 Proxy API</h1>
        <p className="text-white/45 text-lg max-w-xl">
          Use sources.eth as a payment layer for any AI endpoint — no listing required.
          One API key, any agent, anywhere.
        </p>
      </div>

      {/* How it works */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-12">
        {[
          { step: "1", title: "Get an API key", body: "Pay $99/year. Unlimited requests." },
          { step: "2", title: "Call any endpoint", body: "Pass any HTTPS POST endpoint in your request." },
          { step: "3", title: "We handle x402", body: "Payment verification, replay protection, forwarding." },
        ].map(({ step, title, body }) => (
          <div key={step} className="bg-[#16161f] border border-white/[0.07] rounded-xl p-4">
            <div className="w-6 h-6 rounded-full bg-[#7c6aff]/20 text-[#7c6aff] text-xs font-bold flex items-center justify-center mb-3">
              {step}
            </div>
            <div className="font-medium mb-1">{title}</div>
            <div className="text-sm text-white/35">{body}</div>
          </div>
        ))}
      </div>

      {/* Code example */}
      <div className="mb-12">
        <h2 className="text-lg font-semibold mb-3">Usage</h2>
        <div className="relative bg-[#0d0d14] border border-white/[0.07] rounded-xl p-5 overflow-x-auto">
          <button
            onClick={() => handleCopy(CODE_EXAMPLE)}
            className="absolute top-3 right-3 px-2 py-1 bg-white/[0.05] hover:bg-white/[0.08] rounded text-xs text-white/40 hover:text-white transition-all"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
          <pre className="font-mono text-sm text-white/60 whitespace-pre leading-relaxed">
            {CODE_EXAMPLE}
          </pre>
        </div>
      </div>

      {/* Endpoint reference */}
      <div className="mb-12 space-y-3">
        <h2 className="text-lg font-semibold mb-3">Endpoints</h2>
        {[
          {
            method: "POST",
            path: "/x402/proxy",
            auth: "X-API-KEY",
            desc: "Proxy a payment + request to any agent endpoint",
          },
          {
            method: "GET",
            path: "/developer/key",
            auth: "X-API-KEY",
            desc: "Check your key status and usage count",
          },
          {
            method: "POST",
            path: "/developer/register",
            auth: "X-PAYMENT ($5)",
            desc: "Purchase and generate a new API key",
          },
        ].map(({ method, path, auth, desc }) => (
          <div key={path} className="flex items-start gap-4 bg-[#16161f] border border-white/[0.07] rounded-xl px-4 py-3">
            <span className={`text-xs font-mono font-bold mt-0.5 flex-shrink-0 ${method === "GET" ? "text-[#4fd8b8]" : "text-[#7c6aff]"}`}>
              {method}
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-mono text-sm text-white mb-0.5">{path}</div>
              <div className="text-xs text-white/35">{desc}</div>
            </div>
            <span className="text-xs font-mono text-white/25 flex-shrink-0">{auth}</span>
          </div>
        ))}
      </div>

      {/* Get API key */}
      <div className="bg-[#16161f] border border-[#7c6aff]/20 rounded-2xl p-6 shadow-[0_0_30px_rgba(124,106,255,0.08)]">
        <h2 className="text-lg font-semibold mb-1">Get your API key</h2>
        <p className="text-white/35 text-sm mb-5">
          $99 USDC / year · Unlimited requests · Cancel anytime
        </p>

        {apiKey ? (
          <div className="space-y-3">
            <div className="px-4 py-3 bg-[#111118] border border-[#4fd8b8]/20 rounded-lg">
              <div className="text-xs text-white/30 mb-1">Your API key — save this, it won&apos;t be shown again</div>
              <div className="font-mono text-sm text-[#4fd8b8] break-all">{apiKey}</div>
            </div>
            <button
              onClick={() => handleCopy(apiKey)}
              className="w-full py-2.5 bg-[#4fd8b8]/10 hover:bg-[#4fd8b8]/20 border border-[#4fd8b8]/20 rounded-lg text-sm text-[#4fd8b8] transition-all"
            >
              {copied ? "Copied!" : "Copy API key"}
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-white/50 mb-1.5">Key label <span className="text-white/25">(optional)</span></label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="My project"
                className="w-full px-4 py-3 bg-[#111118] border border-white/[0.07] rounded-lg text-white placeholder-white/25 focus:outline-none focus:border-[#7c6aff]/50 focus:ring-1 focus:ring-[#7c6aff]/30 transition-all"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleGetKey}
              disabled={loading}
              className="w-full py-3 bg-[#7c6aff] hover:bg-[#6b59ee] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium transition-all"
            >
              {loading ? "Generating..." : "Pay $99 & get API key"}
            </button>
            <p className="text-xs text-center text-white/25">
              Scan a QR code to pay. No wallet connection needed.
            </p>
          </div>
        )}
      </div>

      {paymentModal && (
        <PaymentModal
          paymentRequest={MOCK_402}
          agentName="Developer API Key"
          onPaid={handlePayment}
          onClose={() => setPaymentModal(false)}
        />
      )}
    </div>
  );
}
