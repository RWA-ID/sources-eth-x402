"use client";

import { Suspense, useState } from "react";
import { RegisterForm } from "../../components/RegisterForm";

type Plan = "trial" | "permanent" | "developer";

const BULLETS = [
  { t: "Zero-integration listing", d: "One JSON manifest → IPFS → live. No SDK to install." },
  { t: "Instant USDC payouts", d: "100% of each request lands in your wallet directly. No payout schedule." },
  { t: "No platform cut on usage", d: "We don't touch your money. One-time listing fee, that's it." },
  { t: "Spam-free marketplace", d: "Paid listing keeps the index high-quality. Real users find real agents." },
];

function Eyebrow({ children, accent }: { children: React.ReactNode; accent?: boolean }) {
  return (
    <div
      className={`font-mono text-[11px] tracking-[0.2em] uppercase ${
        accent ? "text-[#7c6aff]" : "text-white/40"
      }`}
    >
      {children}
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle?: string;
  align?: "left" | "center";
}) {
  return (
    <div className={align === "center" ? "text-center" : "text-left"}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 className="mt-3.5 text-3xl sm:text-4xl font-semibold tracking-tight leading-[1.08]">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3.5 mx-auto max-w-xl text-base text-white/55 leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
}

function Tok({ c, children }: { c: "key" | "str" | "num" | "brace" | "prompt" | "cmd" | "ok" | "dim"; children: React.ReactNode }) {
  const map: Record<string, string> = {
    key: "text-[#7c6aff]",
    str: "text-[#4fd8b8]",
    num: "text-[#f5b549]",
    brace: "text-white/55",
    prompt: "text-[#7c6aff] font-semibold",
    cmd: "text-white",
    ok: "text-[#4fd8b8]",
    dim: "text-white/35",
  };
  return <span className={map[c]}>{children}</span>;
}

function BuildersTerminal() {
  return (
    <div className="bg-[#16161f] border border-white/[0.14] rounded-2xl overflow-hidden shadow-[0_40px_80px_-40px_rgba(0,0,0,0.6)]">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.07] bg-white/[0.02]">
        <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
        <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-auto font-mono text-[11px] text-white/35">~/my-agent/manifest.json</span>
      </div>
      <pre className="m-0 px-5 py-5 font-mono text-[13px] leading-[1.65] text-white/55 overflow-auto">
<Tok c="brace">{"{"}</Tok>{"\n"}
        <Tok c="key">"name"</Tok>: <Tok c="str">"my-agent"</Tok>,{"\n"}
        <Tok c="key">"endpoint"</Tok>: <Tok c="str">"https://my-agent.xyz/gen"</Tok>,{"\n"}
        <Tok c="key">"price_usd"</Tok>: <Tok c="num">0.05</Tok>,{"\n"}
        <Tok c="key">"payment_address"</Tok>: <Tok c="str">"0x82c…f9a3"</Tok>,{"\n"}
        <Tok c="key">"payment_chain"</Tok>: <Tok c="num">8453</Tok>,{"\n"}
        <Tok c="key">"payment_token"</Tok>: <Tok c="str">"USDC"</Tok>{"\n"}
<Tok c="brace">{"}"}</Tok>{"\n\n"}
<Tok c="prompt">$</Tok> <Tok c="cmd">curl -X POST sources.eth/manifest</Tok>{"\n"}
<Tok c="ok">✓ pinned to IPFS</Tok> <Tok c="dim">bafy…k4z</Tok>{"\n"}
<Tok c="ok">✓ live in marketplace</Tok>{"\n"}
      </pre>
    </div>
  );
}

export default function RegisterPage() {
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);

  const selectPlan = (plan: Plan) => {
    setSelectedPlan(plan);
    setTimeout(() => {
      document.getElementById("register-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const planCardCls = (plan: Plan, base: string) =>
    selectedPlan === plan
      ? `${base} border-[#7c6aff]/60 ring-2 ring-[#7c6aff]/40 shadow-[0_0_30px_rgba(124,106,255,0.2)]`
      : base;

  return (
    <div className="px-4 sm:px-7 py-16">
      {/* Hero — pitch + terminal */}
      <section className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-14 items-center">
          <div>
            <Eyebrow accent>for builders</Eyebrow>
            <h1 className="mt-4 text-4xl sm:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.02]">
              List your agent in 5 minutes.<br />
              <span className="text-[#7c6aff] italic font-medium">Keep 100% of revenue.</span>
            </h1>
            <p className="mt-5 max-w-md text-base text-white/55 leading-relaxed">
              Point us at a single HTTPS endpoint. We handle x402 payment gating, USDC settlement on Base, and the QR flow. You stay non-custodial.
            </p>

            <ul className="list-none p-0 mt-8 flex flex-col gap-3.5">
              {BULLETS.map((b) => (
                <li key={b.t} className="flex gap-3.5">
                  <div className="shrink-0 w-[22px] h-[22px] rounded-md bg-[#7c6aff]/15 border border-[#7c6aff]/30 grid place-items-center text-[#7c6aff] mt-0.5">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 4 4L19 6" /></svg>
                  </div>
                  <div>
                    <div className="font-medium text-white">{b.t}</div>
                    <div className="text-sm text-white/55 mt-0.5">{b.d}</div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-9 flex gap-3 flex-wrap">
              <button
                onClick={() => selectPlan("permanent")}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-[#7c6aff] hover:bg-[#6b59ee] text-white text-[15px] font-medium shadow-[0_12px_30px_-12px_rgba(124,106,255,0.5)] transition-colors"
              >
                Register your agent →
              </button>
              <a
                href="https://github.com/RWA-ID/sources-eth-x402"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.14] text-white text-[15px] transition-colors"
              >
                Read the docs
              </a>
            </div>
          </div>

          <BuildersTerminal />
        </div>
      </section>

      {/* Plans */}
      <section className="max-w-5xl mx-auto mt-24">
        <SectionHeader
          eyebrow="choose your plan"
          title={<>Free to start. <span className="text-[#7c6aff] italic font-medium">$49 to stay forever.</span></>}
          subtitle="Pay in USDC on Base. No account or wallet connection required to pay."
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-12">
          {/* Trial */}
          <button
            type="button"
            onClick={() => selectPlan("trial")}
            className={planCardCls(
              "trial",
              "text-left bg-[#16161f] border border-white/[0.07] hover:border-white/20 rounded-2xl p-6 flex flex-col transition-all cursor-pointer"
            )}
          >
            <div className="text-xs font-mono text-white/40 tracking-wider uppercase mb-2">Trial</div>
            <div className="text-4xl font-semibold mb-1">Free</div>
            <div className="text-white/30 text-sm mb-6">15 days, no card</div>
            <ul className="space-y-2.5 text-sm text-white/65 mb-6 mt-auto">
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Real traffic from day one</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Unique agent handle</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> IPFS manifest pinned</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Full x402 infrastructure</li>
            </ul>
            <div className={`w-full py-2.5 rounded-lg text-sm font-medium text-center border transition-all ${selectedPlan === "trial" ? "bg-[#7c6aff] border-[#7c6aff] text-white" : "bg-white/[0.04] border-white/[0.07] text-white/70"}`}>
              {selectedPlan === "trial" ? "Selected ✓" : "Start free trial"}
            </div>
          </button>

          {/* Permanent — featured */}
          <button
            type="button"
            onClick={() => selectPlan("permanent")}
            className={planCardCls(
              "permanent",
              "text-left relative bg-gradient-to-b from-[#7c6aff]/[0.06] to-[#16161f] border border-[#7c6aff]/30 rounded-2xl p-6 flex flex-col transition-all cursor-pointer shadow-[0_30px_80px_-40px_rgba(124,106,255,0.4)]"
            )}
          >
            {selectedPlan !== "permanent" && (
              <div className="absolute top-4 right-4 px-2 py-0.5 bg-[#7c6aff] rounded text-[11px] font-medium">Most popular</div>
            )}
            <div className="text-xs font-mono text-[#7c6aff] tracking-wider uppercase mb-2">Permanent</div>
            <div className="text-4xl font-semibold mb-1">$49</div>
            <div className="text-white/30 text-sm mb-6">One-time, forever</div>
            <ul className="space-y-2.5 text-sm text-white/65 mb-6 mt-auto">
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Everything in trial</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Listed permanently</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> 100% of fees to you</li>
              <li className="flex items-start gap-2"><span className="text-[#4fd8b8] mt-0.5">✓</span> Priority for featured</li>
            </ul>
            <div className={`w-full py-2.5 rounded-lg text-sm font-medium text-center transition-all ${selectedPlan === "permanent" ? "bg-[#7c6aff] text-white" : "bg-[#7c6aff] hover:bg-[#6b59ee] text-white"}`}>
              {selectedPlan === "permanent" ? "Selected ✓" : "Register permanently"}
            </div>
          </button>

          {/* Developer API */}
          <div className="bg-[#16161f] border border-white/[0.05] rounded-2xl p-6 relative flex flex-col opacity-60">
            <div className="absolute top-4 right-4 px-2 py-0.5 bg-white/[0.06] border border-white/[0.08] rounded text-[11px] text-white/40 font-medium">Coming Soon</div>
            <div className="text-xs font-mono text-white/30 tracking-wider uppercase mb-2">Developer API</div>
            <div className="flex items-end gap-1 mb-1">
              <span className="text-4xl font-semibold text-white/40">$99</span>
              <span className="text-white/20 text-sm mb-1.5">/year</span>
            </div>
            <div className="text-white/20 text-sm mb-6">Full x402 access</div>
            <ul className="space-y-2.5 text-sm text-white/30 mb-6 mt-auto">
              <li className="flex items-start gap-2"><span className="mt-0.5">✓</span> Proxy any AI endpoint via API</li>
              <li className="flex items-start gap-2"><span className="mt-0.5">✓</span> No listing required</li>
              <li className="flex items-start gap-2"><span className="mt-0.5">✓</span> Unlimited requests</li>
              <li className="flex items-start gap-2"><span className="mt-0.5">✓</span> Usage dashboard</li>
            </ul>
            <div className="w-full py-2.5 rounded-lg text-sm font-medium text-center border border-white/[0.07] bg-white/[0.03] text-white/25 cursor-not-allowed">
              Coming Soon
            </div>
          </div>
        </div>
      </section>

      {/* Why paid */}
      <section className="max-w-5xl mx-auto mt-24">
        <SectionHeader
          eyebrow="why paid"
          title={<>A small fee keeps the marketplace <span className="text-[#7c6aff] italic font-medium">honest.</span></>}
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mt-10">
          {[
            { i: "🛡️", t: "Spam prevention", d: "Free listings would flood the search with low-effort bots. Paid keeps it intentional." },
            { i: "🔍", t: "Trustworthy results", d: "Users trust that agents here are maintained and legitimate — not abandoned." },
            { i: "📈", t: "Platform growth", d: "Listing fees fund marketing, infra, and dev — bringing more paid requests to you." },
          ].map((b) => (
            <div key={b.t} className="bg-[#16161f] border border-white/[0.07] rounded-2xl p-6">
              <div className="text-xl mb-3">{b.i}</div>
              <div className="text-base font-medium text-white mb-1.5">{b.t}</div>
              <div className="text-sm text-white/45 leading-relaxed">{b.d}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Form */}
      <section id="register-form" className="max-w-lg mx-auto mt-24 scroll-mt-8">
        <SectionHeader
          eyebrow="register"
          title={<>Ship your agent <span className="text-[#7c6aff] italic font-medium">now.</span></>}
        />
        <div className="mt-10">
          {selectedPlan && (
            <div className="mb-6 px-4 py-3 bg-[#7c6aff]/10 border border-[#7c6aff]/30 rounded-xl text-sm text-[#a598ff] flex items-center justify-between">
              <span>
                Plan: <span className="font-medium text-white">{selectedPlan === "trial" ? "Free Trial" : selectedPlan === "permanent" ? "Permanent ($49)" : "Developer API ($99/yr)"}</span>
              </span>
              <button onClick={() => setSelectedPlan(null)} className="text-white/30 hover:text-white/60 transition-colors text-xs">change</button>
            </div>
          )}
          <Suspense fallback={null}>
            <RegisterForm plan={selectedPlan ?? "trial"} />
          </Suspense>
        </div>
      </section>
    </div>
  );
}
