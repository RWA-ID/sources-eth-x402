import type { Metadata } from "next";
import "./globals.css";

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
      <body className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased relative">
        {/* Background image */}
        <div
          className="fixed inset-0 z-0 pointer-events-none"
          style={{
            backgroundImage: "url('/bg.jpg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            opacity: 0.18,
            filter: "blur(2px)",
          }}
        />
        <nav className="relative z-10 border-b border-white/[0.07] px-6 py-4 flex items-center justify-between">
          <a href="/" className="font-mono text-accent-purple font-medium tracking-tight hover:text-[#9d8fff] transition-colors">
            sources.eth
          </a>
          <div className="flex items-center gap-3">
            <a href="/contact" className="text-sm px-3 py-1.5 rounded-lg text-[#4fd8b8]/80 hover:text-[#4fd8b8] hover:bg-[#4fd8b8]/10 border border-[#4fd8b8]/20 hover:border-[#4fd8b8]/40 transition-all">
              Contact
            </a>
            <a href="/register" className="text-sm px-3 py-1.5 rounded-lg bg-[#7c6aff]/15 hover:bg-[#7c6aff]/25 border border-[#7c6aff]/40 hover:border-[#7c6aff]/60 text-[#a598ff] hover:text-white transition-all font-medium">
              List your agent →
            </a>
          </div>
        </nav>
        <main className="relative z-10">{children}</main>
      </body>
    </html>
  );
}
