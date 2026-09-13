import type { ReactNode } from "react";

/**
 * Shared chrome for /privacy, /terms and /disclaimer.
 *
 * These pages describe how sources.eth actually behaves — non-custodial
 * payments, no accounts, IPFS-pinned manifests. Keep them in step with the
 * product; a legal page that describes a flow we no longer run is worse than
 * no page at all.
 */
export function LegalPage({
  eyebrow,
  title,
  accent,
  updated,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  accent: string;
  updated: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <div className="px-5 sm:px-6 py-16 sm:py-20">
      <div className="max-w-[720px] mx-auto">
        <div className="font-mono text-[11px] tracking-[0.12em] uppercase text-[#f97316]">
          {eyebrow}
        </div>
        <h1 className="mt-4 font-display font-bold tracking-[-0.045em] leading-[0.96] text-[clamp(42px,6.2vw,72px)]">
          {title}{" "}
          <span className="text-[#f97316] font-medium">{accent}</span>
        </h1>
        <p className="mt-5 max-w-[560px] text-[17px] leading-[1.55] text-[#eef0f6]/60">
          {intro}
        </p>
        <div className="mt-4 font-mono text-[11px] uppercase tracking-[0.07em] text-[#eef0f6]/35">
          Last updated {updated}
        </div>

        <div className="mt-12 flex flex-col gap-8">{children}</div>

        <div className="mt-14 pt-6 border-t border-white/[0.08] text-[13px] leading-[1.6] text-[#eef0f6]/35">
          This page explains how the service works in plain language. It is not
          legal advice, and it is not a substitute for your own review. Questions:{" "}
          <a href="/contact" className="text-[#f97316] hover:text-[#fdba74] transition-colors">
            get in touch
          </a>
          .
        </div>
      </div>
    </div>
  );
}

export function Clause({ n, heading, children }: { n: string; heading: string; children: ReactNode }) {
  return (
    <section className="bg-[#17130f] border border-white/[0.08] rounded-[18px] p-6">
      <div className="flex items-center gap-3 mb-3">
        <span className="font-mono text-[11px] tracking-[0.1em] text-[#f97316]">{n}</span>
        <span className="h-px flex-1 bg-white/[0.08]" />
      </div>
      <h2 className="font-display text-[20px] font-semibold tracking-[-0.02em] leading-snug m-0">
        {heading}
      </h2>
      <div className="mt-3 flex flex-col gap-3 text-[14px] leading-[1.65] text-[#eef0f6]/60">
        {children}
      </div>
    </section>
  );
}
