"use client";

import { useState } from "react";
import type { AgentManifest } from "@sources-eth/agent-manifest";
import { buildSecretMessage } from "@sources-eth/agent-manifest";
import { useAppKit, useAppKitAccount, useAppKitProvider } from "@reown/appkit/react";
import { requestAgentSecret } from "../lib/api";
import {
  signMessage,
  randomNonce,
  describeSignError,
  type Eip1193Provider,
} from "../lib/wallet";

/**
 * Owner-only controls, behind a disclosure so buyers never see them.
 *
 * Today this issues the agent's forwarding secret.
 *
 * TEMPORARY, AND DELIBERATELY LIMITED. Everyone who registers now receives a
 * secret on the success screen, so this control exists purely to back-fill the
 * two listings created before signed forwarding shipped. It is gated to those
 * two payout addresses so later builders never see a button they do not need
 * and cannot usefully press.
 *
 * Once both have claimed a secret, delete this component and the allowlist. If
 * a general rotate-on-leak flow is wanted later, build it deliberately rather
 * than by widening this.
 */
const MIGRATION_ALLOWLIST = new Set(
  [
    "0x5f11a48230f7CdaB91A2361576239091E4b1165b", // x-402-eth-ipfs-upload-agent
    "0x48096526488f2D51df6bcA1B1f3A3639986cc3dD", // humanmirror-jamenbin
  ].map((a) => a.toLowerCase())
);
export function ManageListing({ agent }: { agent: AgentManifest }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const { open: openModal } = useAppKit();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider<Eip1193Provider>("eip155");

  const isOwner =
    isConnected && address?.toLowerCase() === agent.payment_address.toLowerCase();

  const handleRequest = async () => {
    setError("");

    if (!isConnected || !address) {
      openModal({ view: "Connect" });
      return;
    }
    if (!isOwner) {
      setError(
        `Connected wallet ${address.slice(0, 6)}…${address.slice(-4)} is not this listing's ` +
        `payout address ${agent.payment_address.slice(0, 6)}…${agent.payment_address.slice(-4)}.`
      );
      return;
    }
    if (!walletProvider) {
      setError("Wallet connection is not ready. Reconnect and try again.");
      return;
    }

    const nonce = randomNonce();
    const issued_at = Date.now();
    const message = buildSecretMessage({
      ens: agent.ens,
      payment_address: agent.payment_address,
      nonce,
      issued_at,
    });

    setBusy(true);
    try {
      const signature = await signMessage(walletProvider, message, address);
      const res = await requestAgentSecret(agent.ens, { signature, nonce, issued_at });
      setSecret(res.agent_secret);
    } catch (e) {
      setError(describeSignError(e));
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!secret) return;
    try {
      await navigator.clipboard.writeText(secret);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = secret;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch { /* nothing else to try */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  // Not a listing that needs back-filling — render nothing at all.
  if (!MIGRATION_ALLOWLIST.has(agent.payment_address.toLowerCase())) return null;

  return (
    <div className="mt-8 border-t border-white/[0.08] pt-5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.07em] text-white/35 hover:text-white/60 transition-colors"
      >
        <span className="text-[#f97316]">{open ? "–" : "+"}</span>
        Manage this listing
      </button>

      {open && (
        <div className="mt-4 bg-[#17130f] border border-white/[0.08] rounded-2xl p-5 space-y-3">
          <div>
            <div className="text-sm font-medium text-white mb-1">Agent secret</div>
            <p className="text-xs text-white/45 leading-relaxed">
              Your endpoint uses this to confirm a request really came from sources.eth and was
              really paid for. If your endpoint already enforces x402, verify the signature
              instead of trusting the request — otherwise anyone can call you for free.{" "}
              <a
                href="https://github.com/RWA-ID/sources-eth-x402/blob/main/docs/verifying-forwarded-requests.md"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#f97316] hover:text-[#fdba74] transition-colors"
              >
                How to verify →
              </a>
            </p>
          </div>

          {secret ? (
            <div className="space-y-2">
              <div className="relative">
                <code className="block text-xs text-[#fdba74] bg-black/40 rounded-lg px-3 py-2.5 pr-16 font-mono break-all">
                  {secret}
                </code>
                <button
                  type="button"
                  onClick={copy}
                  className="absolute top-2 right-2 px-2.5 py-1 rounded-md bg-white/[0.08] hover:bg-white/[0.16] border border-white/[0.10] font-mono text-[10px] text-white/70 hover:text-white transition-colors"
                >
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
              <p className="text-xs text-white/45">
                Store this now — it is not retrievable later, and any previous secret has
                stopped working.
              </p>
            </div>
          ) : (
            <>
              <p className="text-xs text-white/35">
                You&apos;ll sign a message with{" "}
                <span className="font-mono text-white/55">
                  {agent.payment_address.slice(0, 6)}…{agent.payment_address.slice(-4)}
                </span>{" "}
                to prove you own this listing. It&apos;s a signature, not a transaction — no gas,
                no funds moved. This replaces any existing secret.
              </p>

              {error && (
                <p className="text-xs text-red-400/80 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleRequest}
                disabled={busy}
                className="px-4 py-2 rounded-lg bg-[#f97316] hover:bg-[#ea6a0c] disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium transition-colors"
              >
                {busy
                  ? "Check your wallet…"
                  : !isConnected
                  ? "Connect payout wallet"
                  : "Get agent secret"}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
