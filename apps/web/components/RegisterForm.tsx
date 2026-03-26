"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type { AgentManifest, AgentCategory, AgentService } from "@sources-eth/agent-manifest";
import { registerManifest, probeAgent, importErc8004Agent } from "../lib/api";
import type { ProbeResult, ImportedAgent } from "../lib/api";
import { AgentShareCard } from "./AgentShareCard";

type Step = 1 | 2;
type ImportMode = "json" | "erc8004";

const CATEGORIES: { id: AgentCategory; label: string }[] = [
  { id: "generative-media", label: "Generative Media (image, video, avatars)" },
  { id: "text-content", label: "Text & Content Generation" },
  { id: "ai-assistants", label: "AI Assistants / Task Execution" },
  { id: "coding-dev", label: "Coding & Developer Tools" },
  { id: "data-analytics", label: "Data & Analytics" },
  { id: "payments-finance", label: "Payments & Finance" },
  { id: "identity-verification", label: "Identity & Verification" },
  { id: "security-compliance", label: "Security & Compliance" },
  { id: "audio-voice", label: "Audio & Voice" },
  { id: "ecommerce", label: "E-commerce Utilities" },
  { id: "workflow-automation", label: "Workflow Automation" },
  { id: "knowledge-search", label: "Knowledge & Search" },
  { id: "legal-ai", label: "Legal AI" },
  { id: "medical-health", label: "Medical / Health AI" },
  { id: "real-estate", label: "Real Estate AI" },
  { id: "accounting-finance", label: "Accounting / Finance Tools" },
  { id: "other", label: "Other" },
];

function inferOutputType(
  services: Array<{ name: string }>
): { type: AgentManifest["output"]["type"]; format: string; delivery: "url" | "stream" | "base64" } {
  const names = services.map((s) => s.name.toLowerCase()).join(" ");
  if (/pin|ipfs|cid|store|upload/.test(names)) return { type: "data",  format: "cid",  delivery: "url" };
  if (/image|render|generat|flux|dalle|stable/.test(names)) return { type: "image", format: "png",  delivery: "url" };
  if (/audio|tts|voice|speech|music/.test(names))           return { type: "audio", format: "mp3",  delivery: "url" };
  if (/video/.test(names))                                  return { type: "video", format: "mp4",  delivery: "url" };
  if (/code|dev|program|build|compil/.test(names))          return { type: "code",  format: "text", delivery: "url" };
  return { type: "text", format: "json", delivery: "url" };
}

interface Parsed {
  slug: string;
  display_name: string;
  description: string;
  favicon_url?: string;
  endpoint: string;
  probe: ProbeResult;
  services: Array<{ name: string; endpoint: string }>;
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.eth$/, "")
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function findApiEndpoint(services: Array<{ name: string; endpoint: string }>): string | null {
  const preferred = ["web", "mcp", "a2a", "api", "generate", "main", "service"];
  for (const name of preferred) {
    const s = services.find((s) => s.name.toLowerCase() === name);
    if (s?.endpoint?.startsWith("https://")) return s.endpoint;
  }
  const any = services.find((s) => s.endpoint?.startsWith("https://"));
  if (any) return any.endpoint;
  const skip = new Set(["docs", "health", "pricing", "ens"]);
  const fallback = services.find(
    (s) => s.endpoint?.startsWith("https://") && !skip.has(s.name.toLowerCase())
  );
  return fallback?.endpoint ?? null;
}

export function RegisterForm() {
  const searchParams = useSearchParams();
  const [step, setStep] = useState<Step>(1);
  const [importMode, setImportMode] = useState<ImportMode>("erc8004");

  // JSON paste mode
  const [rawJson, setRawJson] = useState("");

  // ERC-8004 import mode
  const [importQuery, setImportQuery] = useState("");
  const [importLoading, setImportLoading] = useState(false);
  const [importError, setImportError] = useState("");
  const [importResults, setImportResults] = useState<ImportedAgent[]>([]);

  // Auto-import from ?prefill= query param (set by "List this agent" button)
  useEffect(() => {
    const raw = searchParams.get("prefill");
    if (!raw) return;
    try {
      const prefill = JSON.parse(decodeURIComponent(raw)) as { name?: string };
      if (prefill.name) {
        setImportMode("erc8004");
        setImportQuery(prefill.name);
        // Trigger fetch after state settles
        setTimeout(() => {
          document.getElementById("erc8004-fetch-btn")?.click();
        }, 50);
      }
    } catch {
      // malformed prefill — just ignore it
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Shared probe state
  const [probing, setProbing] = useState(false);
  const [probeError, setProbeError] = useState("");

  // Step 2 state
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [category, setCategory] = useState<AgentCategory>("ai-assistants");
  const [tags, setTags] = useState("");
  const [displayName, setDisplayName] = useState("");

  // Success state
  const [successManifest, setSuccessManifest] = useState<AgentManifest | null>(null);
  const [trialExpiresAt, setTrialExpiresAt] = useState<number | null>(null);
  const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(false);

  const doProbe = async (
    name: string,
    description: string,
    image: string | undefined,
    services: Array<{ name: string; endpoint: string }>
  ) => {
    const apiEndpoint = findApiEndpoint(services);
    if (!apiEndpoint) {
      setProbeError('Could not find a service with an https:// endpoint.');
      return;
    }
    setProbing(true);
    setProbeError("");
    try {
      const probe = await probeAgent(apiEndpoint);
      setParsed({ slug: slugify(name), display_name: name, description, favicon_url: image, endpoint: apiEndpoint, probe, services });
      setDisplayName(name);
      setStep(2);
    } catch (e) {
      setProbeError(e instanceof Error ? e.message : "Probe failed — is your pricing endpoint live?");
    } finally {
      setProbing(false);
    }
  };

  const handleImportJson = async () => {
    setProbeError("");
    let meta: Record<string, unknown>;
    try {
      meta = JSON.parse(rawJson) as Record<string, unknown>;
    } catch {
      setProbeError("Invalid JSON — check for missing brackets or commas.");
      return;
    }
    const name = typeof meta.name === "string" ? meta.name : "";
    const description = typeof meta.description === "string" ? meta.description : "";
    const image = typeof meta.image === "string" ? meta.image : undefined;
    if (!name || !description) {
      setProbeError('JSON must have "name" and "description" fields.');
      return;
    }
    const services = Array.isArray(meta.services)
      ? (meta.services as Array<{ name: string; endpoint: string }>)
      : [];
    await doProbe(name, description, image, services);
  };

  const handleFetchErc8004 = async () => {
    if (!importQuery.trim()) return;
    setImportLoading(true);
    setImportError("");
    setImportResults([]);
    try {
      const { agents, error } = await importErc8004Agent(importQuery.trim());
      if (error && agents.length === 0) { setImportError(error); return; }
      if (agents.length === 0) { setImportError("No agents found on Base or Ethereum for that ID."); return; }
      setImportResults(agents);
    } catch (e) {
      setImportError(e instanceof Error ? e.message : "Fetch failed");
    } finally {
      setImportLoading(false);
    }
  };

  const handleUseErc8004Agent = async (agent: ImportedAgent) => {
    await doProbe(agent.name, agent.description, agent.image, agent.services);
  };

  const handlePublish = async () => {
    if (!parsed) return;
    setLoading(true);
    setSubmitError("");
    try {
      const slug = slugify(displayName || parsed.slug);
      const agentServices: AgentService[] = parsed.services
        .filter((s) => s.endpoint?.startsWith("https://"))
        .map((s) => {
          const nameLower = s.name.toLowerCase();
          const explicit = (s as Record<string, unknown>).input_type as AgentService["input_type"] | undefined;
          const input_type: AgentService["input_type"] = explicit
            ?? (nameLower.includes("upload") || nameLower.includes("file") ? "file"
            : nameLower.includes("json") || nameLower.includes("pin") ? "json"
            : "text");
          const base = parsed.endpoint.replace(/\/$/, "");
          const subPath = s.endpoint.startsWith(base)
            ? s.endpoint.slice(base.length).replace(/^\//, "")
            : s.name;
          return {
            name: s.name,
            endpoint: subPath,
            price_usd: (s as Record<string, unknown>).price_usd as number | undefined
              ?? parsed.probe.services.find((ps) => ps.name === s.name)?.priceUsd,
            input_type,
          };
        });

      const manifest: Omit<AgentManifest, "ipfs_cid" | "registered_at" | "manifest_version"> = {
        name: slug,
        display_name: displayName || parsed.display_name,
        description: parsed.description,
        ens: `${slug}.agents.sources.eth`,
        version: "1.0.0",
        endpoint: parsed.endpoint,
        method: "POST",
        price_usd: parsed.probe.priceUsd,
        payment_address: parsed.probe.payTo,
        payment_chain: parsed.probe.chainId,
        payment_token: "USDC",
        category,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
        input: { prompt: { type: "string", required: true, maxLength: 1000 } },
        output: inferOutputType(agentServices),
        ...(parsed.favicon_url && { favicon_url: parsed.favicon_url }),
        ...(agentServices.length > 0 && { services: agentServices }),
      };

      const result = await registerManifest(manifest);
      if (!("requires402" in result)) {
        setSuccessManifest({ ...manifest, ipfs_cid: result.cid, registered_at: Date.now() / 1000, manifest_version: "1.0" });
        setTrialExpiresAt(result.trial_expires_at);
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full px-4 py-3 bg-[#111118] border border-white/[0.07] rounded-lg text-white placeholder-white/25 focus:outline-none focus:border-[#7c6aff]/50 focus:ring-1 focus:ring-[#7c6aff]/30 transition-all";

  // ── Success screen ─────────────────────────────────────────────────────────
  if (successManifest) {
    const expiry = trialExpiresAt ? new Date(trialExpiresAt).toLocaleDateString() : "";
    return (
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-xl font-semibold mb-1">You&apos;re live!</h2>
          <p className="text-white/40 text-sm">Free trial active — fully live in search until {expiry}</p>
        </div>
        <div className="bg-[#16161f] border border-white/[0.07] rounded-xl p-4 space-y-2">
          <div className="text-xs text-white/30">Agent handle</div>
          <div className="font-mono text-[#7c6aff]">{successManifest.ens}</div>
          <div className="text-xs text-white/30 mt-3">IPFS CID</div>
          <div className="font-mono text-xs text-white/50 break-all">{successManifest.ipfs_cid}</div>
        </div>
        <div className="bg-[#7c6aff]/10 border border-[#7c6aff]/20 rounded-xl p-4 text-sm text-white/60">
          After your trial ends on {expiry}, pay $49 to list permanently. No recurring fees, ever.
          <br /><br />
          Visit{" "}
          <span className="font-mono text-[#7c6aff]">
            sources.eth.limo/agent?ens={successManifest.ens}
          </span>{" "}
          to upgrade anytime.
        </div>
        <AgentShareCard manifest={successManifest} />
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Progress bar */}
      <div className="flex gap-2 mb-8">
        {[1, 2].map((s) => (
          <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? "bg-[#7c6aff]" : "bg-white/10"}`} />
        ))}
      </div>

      {/* ── Step 1 ────────────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">List your agent</h2>
            <p className="text-sm text-white/40 mb-4">
              Already have an ERC-8004 agent? Import it in one click. Otherwise paste your metadata JSON.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex gap-1 p-1 bg-white/[0.04] rounded-lg border border-white/[0.06]">
            {(["erc8004", "json"] as ImportMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => { setImportMode(mode); setProbeError(""); setImportError(""); }}
                className={`flex-1 py-2 text-sm rounded-md font-medium transition-all ${
                  importMode === mode
                    ? "bg-[#7c6aff] text-white"
                    : "text-white/40 hover:text-white/70"
                }`}
              >
                {mode === "erc8004" ? "Import ERC-8004" : "Paste JSON"}
              </button>
            ))}
          </div>

          {/* ERC-8004 import */}
          {importMode === "erc8004" && (
            <div className="space-y-3">
              <p className="text-xs text-white/40">
                Enter your agent ID (e.g. <span className="font-mono text-white/60">36119</span> or{" "}
                <span className="font-mono text-white/60">base/36119</span>) or your wallet address.
              </p>
              <div className="flex gap-2">
                <input
                  value={importQuery}
                  onChange={(e) => setImportQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleFetchErc8004()}
                  placeholder="Agent ID or 0x wallet address..."
                  className={inputClass + " flex-1"}
                />
                <button
                  id="erc8004-fetch-btn"
                  onClick={handleFetchErc8004}
                  disabled={!importQuery.trim() || importLoading}
                  className="px-4 py-3 bg-[#7c6aff] hover:bg-[#6b59ee] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium text-sm transition-all whitespace-nowrap"
                >
                  {importLoading ? "Fetching..." : "Fetch →"}
                </button>
              </div>

              {importError && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {importError}
                </p>
              )}

              {importResults.length > 0 && (
                <div className="space-y-2">
                  {importResults.map((agent) => (
                    <div key={`${agent.chain}:${agent.agentId}`} className="bg-[#111118] border border-white/[0.07] rounded-xl p-4">
                      <div className="flex items-start gap-3">
                        {agent.image && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={agent.image} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <span className="font-semibold text-white/90 text-sm">{agent.name}</span>
                            <span className="font-mono text-[10px] text-white/30 border border-white/[0.08] rounded px-1.5 py-0.5">{agent.chain} #{agent.agentId}</span>
                            {agent.x402Support && <span className="font-mono text-[10px] text-[#4fd8b8] border border-[#4fd8b8]/20 bg-[#4fd8b8]/10 rounded px-1.5 py-0.5">x402</span>}
                          </div>
                          <p className="text-xs text-white/40 line-clamp-2 mb-2">{agent.description}</p>
                          <div className="flex flex-wrap gap-1 mb-3">
                            {agent.services.filter(s => s.endpoint).map((s) => (
                              <span key={s.name} className="font-mono text-[10px] text-white/40 border border-white/[0.08] rounded px-1.5 py-0.5">{s.name}</span>
                            ))}
                            {agent.services.filter(s => s.endpoint).length === 0 && (
                              <span className="text-xs text-yellow-400/60">No https:// endpoints found — add them to your ERC-8004 metadata first</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => handleUseErc8004Agent(agent)}
                        disabled={probing || agent.services.filter(s => s.endpoint?.startsWith("https://")).length === 0}
                        className="w-full py-2 bg-[#7c6aff] hover:bg-[#6b59ee] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all"
                      >
                        {probing ? "Probing endpoint..." : "Use this agent →"}
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {probeError && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {probeError}
                </p>
              )}
            </div>
          )}

          {/* JSON paste */}
          {importMode === "json" && (
            <div className="space-y-3">
              <div className="bg-[#111118] border border-white/[0.06] rounded-lg px-4 py-3 space-y-1.5 text-xs text-white/40">
                <p className="text-white/60 font-medium mb-1">For best results, include on each service:</p>
                <p><span className="font-mono text-[#4fd8b8]">&quot;name&quot;</span> — standard ERC-8004 types: <span className="font-mono text-white/50">web</span>, <span className="font-mono text-white/50">MCP</span>, <span className="font-mono text-white/50">A2A</span>, <span className="font-mono text-white/50">OASF</span></p>
                <p><span className="font-mono text-[#4fd8b8]">&quot;endpoint&quot;</span> — full <span className="font-mono">https://</span> URL</p>
                <p><span className="font-mono text-[#4fd8b8]">&quot;input_type&quot;</span> — <span className="font-mono">&quot;text&quot;</span>, <span className="font-mono">&quot;file&quot;</span>, or <span className="font-mono">&quot;json&quot;</span></p>
              </div>
              <textarea
                value={rawJson}
                onChange={(e) => setRawJson(e.target.value)}
                placeholder={'{\n  "name": "My Agent",\n  "description": "What your agent does",\n  "image": "https://...",\n  "services": [\n    { "name": "generate", "endpoint": "https://my-agent.com/generate", "input_type": "text" }\n  ]\n}'}
                rows={12}
                className={inputClass + " font-mono text-sm resize-none"}
                spellCheck={false}
              />
              {probeError && (
                <p className="text-red-400 text-sm bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                  {probeError}
                </p>
              )}
              <button
                onClick={handleImportJson}
                disabled={!rawJson.trim() || probing}
                className="w-full py-3 bg-[#7c6aff] hover:bg-[#6b59ee] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
              >
                {probing ? "Probing your agent..." : "Import & probe →"}
              </button>
              <p className="text-xs text-center text-white/25">
                We&apos;ll call your agent&apos;s pricing endpoint to read the payment address and pricing.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Step 2: Review + publish ───────────────────────────────────────── */}
      {step === 2 && parsed && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold mb-1">Review & publish</h2>
            <p className="text-sm text-white/40 mb-4">Fetched from your agent. Edit anything before going live.</p>
          </div>

          <div className="bg-[#111118] border border-white/[0.07] rounded-xl p-4 space-y-3 text-sm">
            <div className="flex items-center gap-3">
              {parsed.favicon_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={parsed.favicon_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/10 flex-shrink-0" onError={(e) => (e.currentTarget.style.display = "none")} />
              )}
              <div className="flex-1 min-w-0">
                <div className="text-xs text-white/30 mb-0.5">Display name</div>
                <input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="bg-transparent text-white font-medium w-full focus:outline-none border-b border-white/10 focus:border-[#7c6aff]/50 pb-0.5 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="text-xs text-white/30 mb-0.5">Description</div>
              <div className="text-white/60 text-xs leading-relaxed">{parsed.description}</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-xs text-white/30 mb-0.5">Handle</div>
                <div className="font-mono text-xs text-[#7c6aff] truncate">
                  {slugify(displayName || parsed.slug)}.agents.sources.eth
                </div>
              </div>
              <div>
                <div className="text-xs text-white/30 mb-0.5">Endpoint</div>
                <div className="font-mono text-xs text-white/50 truncate">{parsed.endpoint}</div>
              </div>
            </div>

            {/* Pricing from endpoint — read only */}
            <div className="border-t border-white/[0.07] pt-3">
              <div className="text-xs text-white/30 mb-2">Pricing (read from your endpoint)</div>
              {parsed.probe.services.length > 1 ? (
                <div className="space-y-1">
                  {parsed.probe.services.map((s) => (
                    <div key={s.name} className="flex justify-between text-xs">
                      <span className="font-mono text-white/40">{s.name}</span>
                      <span className="text-[#4fd8b8]">${s.priceUsd.toFixed(4)} USDC</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-xs font-mono text-[#4fd8b8]">${parsed.probe.priceUsd.toFixed(4)} USDC per request</div>
              )}
            </div>

            <div className="border-t border-white/[0.07] pt-3">
              <div className="text-xs text-white/30 mb-0.5">Payments go to</div>
              <div className="font-mono text-xs text-white/50 break-all">{parsed.probe.payTo}</div>
            </div>

            <div className="flex items-center gap-2 text-xs">
              <div className={`w-2 h-2 rounded-full ${parsed.probe.healthy ? "bg-[#4fd8b8]" : "bg-yellow-400"}`} />
              <span className="text-white/30">
                {parsed.probe.healthy ? "Health check passed" : "Health endpoint not found (optional)"}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-sm text-white/50 mb-1.5">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value as AgentCategory)} className={inputClass}>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-white/50 mb-1.5">Tags <span className="text-white/25">(comma-separated)</span></label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ipfs, storage, pinning, x402" className={inputClass} />
          </div>

          <div className="bg-[#4fd8b8]/10 border border-[#4fd8b8]/20 rounded-xl p-4 space-y-1">
            <div className="text-sm font-medium text-[#4fd8b8]">Free 15-day trial</div>
            <ul className="text-xs text-white/50 space-y-0.5">
              <li>✓ Fully live in search from day one</li>
              <li>✓ Real traffic, real payments to your wallet</li>
              <li>✓ No credit card, no USDC required to start</li>
              <li className="text-white/30">↑ $49 to go permanent after your trial</li>
            </ul>
          </div>

          {submitError && <p className="text-red-400 text-sm">{submitError}</p>}

          <div className="flex gap-2">
            <button onClick={() => setStep(1)} className="flex-1 py-3 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-sm transition-all">
              Back
            </button>
            <button
              onClick={handlePublish}
              disabled={loading || !category}
              className="flex-1 py-3 bg-[#7c6aff] hover:bg-[#6b59ee] disabled:opacity-40 disabled:cursor-not-allowed rounded-lg font-medium transition-all"
            >
              {loading ? "Publishing..." : "Publish free trial"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
