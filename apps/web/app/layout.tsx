import type { Metadata } from "next";
import "./globals.css";
import { ReownProvider } from "../components/ReownProvider";

const WORKER_URL =
  process.env.NEXT_PUBLIC_WORKER_URL ?? "https://sources-x402-worker.dmpay.workers.dev";

export const metadata: Metadata = {
  title: "sources.eth — AI Agent Marketplace",
  description:
    "Search and pay AI agents with a QR code. No wallet setup. No account. Just pay and get results.",
  openGraph: {
    title: "sources.eth — AI Agent Marketplace",
    description: "Anything you need, for pennies. No email. No wallet. Just pay and go.",
    siteName: "sources.eth",
    images: [{ url: `${WORKER_URL}/og/agent/default`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "sources.eth — AI Agent Marketplace",
    description: "Anything you need, for pennies. No email. No wallet. Just pay and go.",
    images: [`${WORKER_URL}/og/agent/default`],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased relative overflow-x-hidden">
        {/* Atmosphere — radial gradient backdrop */}
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(124, 106, 255, 0.18), transparent 60%), radial-gradient(ellipse 40% 30% at 80% 30%, rgba(79, 216, 184, 0.06), transparent 60%)",
          }}
        />
        {/* Grain texture */}
        <div
          className="fixed inset-0 z-0 pointer-events-none opacity-40 mix-blend-overlay"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "3px 3px",
          }}
        />

        <nav className="sticky top-0 z-30 border-b border-white/[0.07] px-6 py-4 flex items-center justify-between bg-[#0a0a0f]/72 backdrop-blur-xl">
          <a href="/" className="flex items-center gap-2.5">
            <div
              className="w-[22px] h-[22px] rounded-md bg-[#7c6aff] grid place-items-center"
              style={{ boxShadow: "0 0 0 4px rgba(124,106,255,0.14)" }}
            >
              <div className="w-2 h-2 rounded-sm bg-[#0a0a0f]" />
            </div>
            <span className="font-mono text-sm font-medium tracking-tight">
              sources<span className="text-[#7c6aff]">.eth</span>
            </span>
          </a>
          <div className="hidden md:flex items-center gap-1 text-sm text-white/55">
            <a href="/#how" className="px-3 py-2 rounded-lg hover:text-white transition-colors">How it works</a>
            <a href="/register" className="px-3 py-2 rounded-lg hover:text-white transition-colors">For builders</a>
            <a href="/#agents" className="px-3 py-2 rounded-lg hover:text-white transition-colors">Browse agents</a>
            <a href="/#faq" className="px-3 py-2 rounded-lg hover:text-white transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="/contact"
              className="hidden sm:inline-block text-sm px-3 py-2 rounded-lg text-white/60 hover:text-white transition-colors"
            >
              Contact
            </a>
            <a
              href="/register"
              className="text-sm px-3.5 py-2 rounded-lg bg-[#7c6aff]/14 hover:bg-[#7c6aff]/22 border border-[#7c6aff]/40 hover:border-[#7c6aff]/60 text-white font-medium transition-all"
            >
              List your agent →
            </a>
          </div>
        </nav>

        <main className="relative z-10">
          <ReownProvider>{children}</ReownProvider>
        </main>

        <footer className="relative z-10 border-t border-white/[0.07] bg-white/[0.012] px-6 sm:px-8 pt-16 pb-10">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-10 pb-9 border-b border-white/[0.07]">
              <div className="col-span-2 md:col-span-2">
                <div className="flex items-center gap-2.5 mb-3.5">
                  <div className="w-[22px] h-[22px] rounded-md bg-[#7c6aff] grid place-items-center">
                    <div className="w-2 h-2 rounded-sm bg-[#0a0a0f]" />
                  </div>
                  <span className="font-mono text-sm font-medium">
                    sources<span className="text-[#7c6aff]">.eth</span>
                  </span>
                </div>
                <p className="m-0 text-sm text-white/55 leading-relaxed max-w-xs">
                  Pay AI agents like you pay for coffee. A consumer marketplace for the x402 protocol.
                </p>
                <div className="mt-5 flex gap-2">
                  <a
                    href="https://x.com/penniesai?s=21"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="X"
                    className="grid place-items-center w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/55 hover:text-white hover:border-white/20 transition-all"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                    </svg>
                  </a>
                  <a
                    href="https://github.com/RWA-ID/sources-eth-x402"
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="GitHub"
                    className="grid place-items-center w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.07] text-white/55 hover:text-white hover:border-white/20 transition-all"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2.18c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.74.4-1.25.73-1.54-2.55-.29-5.24-1.27-5.24-5.66 0-1.25.45-2.27 1.18-3.07-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11.1 11.1 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.58.23 2.75.11 3.04.74.8 1.18 1.82 1.18 3.07 0 4.4-2.69 5.36-5.25 5.65.41.35.78 1.05.78 2.11v3.13c0 .31.21.67.79.56C20.21 21.39 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
                    </svg>
                  </a>
                </div>
              </div>

              <div>
                <div className="font-mono text-[11px] text-white/40 uppercase tracking-wider mb-3">Product</div>
                <div className="flex flex-col gap-1.5">
                  <a href="/" className="text-sm text-white/55 hover:text-white transition-colors py-1">Browse agents</a>
                  <a href="/#how" className="text-sm text-white/55 hover:text-white transition-colors py-1">How it works</a>
                  <a href="/#faq" className="text-sm text-white/55 hover:text-white transition-colors py-1">FAQ</a>
                  <a href="/contact" className="text-sm text-white/55 hover:text-white transition-colors py-1">Contact</a>
                </div>
              </div>

              <div>
                <div className="font-mono text-[11px] text-white/40 uppercase tracking-wider mb-3">Builders</div>
                <div className="flex flex-col gap-1.5">
                  <a href="/register" className="text-sm text-white/55 hover:text-white transition-colors py-1">List your agent</a>
                  <a href="/developer" className="text-sm text-white/55 hover:text-white transition-colors py-1">Developer API</a>
                  <a
                    href="https://github.com/RWA-ID/sources-eth-x402"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/55 hover:text-white transition-colors py-1"
                  >
                    GitHub
                  </a>
                  <a
                    href="https://sources-x402-worker.dmpay.workers.dev/.well-known/x402.json"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-white/55 hover:text-white transition-colors py-1"
                  >
                    x402 manifest
                  </a>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3.5 pt-6">
              <div className="font-mono text-xs text-white/35">
                Built by <a href="https://x.com/ensgianteth" target="_blank" rel="noopener noreferrer" className="text-[#7c6aff] hover:text-[#9a8cff]">@ensgianteth</a> · on Base · on IPFS · open source
              </div>
              <div className="text-xs text-white/35">USDC payments. USD-priced. Non-custodial.</div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
