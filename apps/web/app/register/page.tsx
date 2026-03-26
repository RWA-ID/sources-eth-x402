"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { RegisterForm } from "../../components/RegisterForm";
import { HumanVerifyWidget } from "../../components/HumanVerifyWidget";

const CARDS: { img: string; title: string; body: string }[] = [
  {
    img: "/icon-golive.png",
    title: "Bring your endpoint",
    body: "Any HTTPS POST endpoint",
  },
  {
    img: "/usdc.png",
    title: "Set your price",
    body: "Min $0.001 per generation",
  },
  {
    img: "/icon-endpoint.png",
    title: "Go live in minutes",
    body: "Free 15-day trial, $49 permanent",
  },
];

type Plan = "trial" | "permanent" | "developer";

export default function RegisterPage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const selectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setTimeout(() => {
      document.getElementById("register-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const planCard = (plan: Plan) =>
    selectedPlan === plan
      ? "ring-2 ring-[#7c6aff] border-[#7c6aff]/60 shadow-[0_0_30px_rgba(124,106,255,0.2)]"
      : "border-white/[0.07] hover:border-white/20";

  return (
    <div className="px-4 py-16">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-bold mb-3">List your AI agent</h1>
        <p className="text-white/40 max-w-md mx-auto">
          Register once, get paid forever. No API keys, no accounts, no platform custody.
          100% of generation fees go directly to your wallet.
        </p>
      </div>

      {/* Pricing tiers */}
      <div className="max-w-3xl mx-auto mb-12">
        <p className="text-center text-white/35 text-sm mb-6">
          Choose a plan to get started.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Trial */}
          <div className={`bg-[#16161f] border rounded-2xl p-6 flex flex-col transition-all cursor-pointer ${planCard("trial")}`} onClick={() => selectPlan("trial")}>
            <div className="text-sm text-white/40 mb-1">Trial</div>
            <div className="text-4xl font-bold mb-1">Free</div>
            <div className="text-white/30 text-sm mb-6">15 days, no credit card</div>
            <ul className="space-y-2.5 text-sm text-white/60 mb-6 mt-auto">
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Real traffic from day one</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Unique agent handle on sources.eth</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> IPFS manifest pinned permanently</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Full x402 payment infrastructure</li>
              <li className="flex items-start gap-2"><span className="text-white/20 mt-0.5">↑</span> <span className="text-white/30">$49 to go permanent after trial</span></li>
            </ul>
            <button
              onClick={(e) => { e.stopPropagation(); selectPlan("trial"); }}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all border ${selectedPlan === "trial" ? "bg-[#7c6aff] border-[#7c6aff] text-white" : "bg-white/[0.06] hover:bg-white/[0.1] border-white/[0.07] text-white/70"}`}
            >
              {selectedPlan === "trial" ? "Selected ✓" : "Start free trial"}
            </button>
          </div>

          {/* Permanent */}
          <div className={`bg-[#16161f] border rounded-2xl p-6 relative flex flex-col transition-all cursor-pointer ${selectedPlan === "permanent" ? planCard("permanent") : "border-[#7c6aff]/30 shadow-[0_0_30px_rgba(124,106,255,0.1)]"}`} onClick={() => selectPlan("permanent")}>
            {selectedPlan !== "permanent" && <div className="absolute top-4 right-4 px-2 py-0.5 bg-[#7c6aff] rounded text-xs font-medium">Most popular</div>}
            <div className="text-sm text-white/40 mb-1">Permanent</div>
            <div className="text-4xl font-bold mb-1">$49</div>
            <div className="text-white/30 text-sm mb-6">One-time, no recurring fees</div>
            <ul className="space-y-2.5 text-sm text-white/60 mb-6 mt-auto">
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Everything in trial</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Listed permanently, forever</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> 100% of generation fees to you</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Priority for featured placement</li>
            </ul>
            <button
              onClick={(e) => { e.stopPropagation(); selectPlan("permanent"); }}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all border ${selectedPlan === "permanent" ? "bg-[#7c6aff] border-[#7c6aff] text-white" : "bg-[#7c6aff] hover:bg-[#6b59ee] border-[#7c6aff] text-white"}`}
            >
              {selectedPlan === "permanent" ? "Selected ✓" : "Register permanently"}
            </button>
          </div>

          {/* Developer API */}
          <div className={`bg-[#16161f] border rounded-2xl p-6 relative flex flex-col transition-all cursor-pointer ${selectedPlan === "developer" ? planCard("developer") : "border-[#4fd8b8]/30 shadow-[0_0_30px_rgba(79,216,184,0.08)]"}`} onClick={() => selectPlan("developer")}>
            {selectedPlan !== "developer" && <div className="absolute top-4 right-4 px-2 py-0.5 bg-[#4fd8b8]/10 border border-[#4fd8b8]/20 rounded text-xs text-[#4fd8b8] font-medium">Pro</div>}
            <div className="text-sm text-white/40 mb-1">Developer API</div>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-bold">$99</span>
              <span className="text-white/30 text-sm mb-1.5">/year</span>
            </div>
            <div className="text-white/30 text-sm mb-6">Full x402 infrastructure access</div>
            <ul className="space-y-2.5 text-sm text-white/60 mb-6 mt-auto">
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Proxy any AI endpoint via API</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> No listing required</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Unlimited requests</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Usage stats dashboard</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Priority support</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Early access to new features</li>
            </ul>
            <button
              onClick={(e) => { e.stopPropagation(); selectPlan("developer"); }}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-all border ${selectedPlan === "developer" ? "bg-[#7c6aff] border-[#7c6aff] text-white" : "bg-[#4fd8b8]/10 hover:bg-[#4fd8b8]/20 border-[#4fd8b8]/20 text-[#4fd8b8]"}`}
            >
              {selectedPlan === "developer" ? "Selected ✓" : "Get API access"}
            </button>
          </div>
        </div>
        <p className="text-center text-xs text-white/20 mt-4">
          Payment via USDC on Base. No account or wallet connection required to pay.
        </p>
      </div>

      <HumanVerifyWidget />

      <div id="register-form" className="max-w-lg mx-auto scroll-mt-8">
        {selectedPlan && (
          <div className="mb-6 px-4 py-3 bg-[#7c6aff]/10 border border-[#7c6aff]/30 rounded-xl text-sm text-[#a598ff] flex items-center justify-between">
            <span>
              Plan: <span className="font-medium text-white">{selectedPlan === "trial" ? "Free Trial" : selectedPlan === "permanent" ? "Permanent ($49)" : "Developer API ($99/yr)"}</span>
            </span>
            <button onClick={() => setSelectedPlan(null)} className="text-white/30 hover:text-white/60 transition-colors text-xs">change</button>
          </div>
        )}

        <div className="grid grid-cols-3 gap-3 mb-10">
          {CARDS.map(({ img, title, body }) => (
            <div key={title} className="bg-[#16161f] border border-white/[0.07] rounded-xl p-3 text-center">
              <div className="flex justify-center mb-2">
                <Image src={img} alt={title} width={40} height={40} className="object-contain" />
              </div>
              <div className="text-sm font-medium mb-1">{title}</div>
              <div className="text-xs text-white/35">{body}</div>
            </div>
          ))}
        </div>

        <Suspense fallback={null}>
          <RegisterForm />
        </Suspense>
      </div>
    </div>
  );
}
