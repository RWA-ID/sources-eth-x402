"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import AgentPageClient from "./AgentPageClient";

function AgentPageInner() {
  const params = useSearchParams();
  const ens = params.get("ens") ?? "";

  if (!ens) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12 text-center text-white/40 text-sm">
        No agent specified.
      </div>
    );
  }

  return <AgentPageClient ens={decodeURIComponent(ens)} />;
}

export default function AgentPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-2xl mx-auto px-4 py-12 text-center text-white/30 text-sm animate-pulse">
          Loading agent...
        </div>
      }
    >
      <AgentPageInner />
    </Suspense>
  );
}
