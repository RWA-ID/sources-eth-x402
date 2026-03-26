"use client";

import { useState, useEffect } from "react";
import type { AgentManifest, AgentService } from "@sources-eth/agent-manifest";
import { initiateGenerate, generateWithPayment, getRating, submitRating, probeAgent } from "../lib/api";
import { PaymentModal } from "./PaymentModal";
import { ResultStream } from "./ResultStream";
import { StarRating } from "./StarRating";

interface PaymentRequest {
  x402Version: number;
  accepts: Array<{
    scheme: string;
    network: string;
    maxAmountRequired: string;
    resource: string;
    description: string;
    payTo: string;
    asset: string;
    maxTimeoutSeconds: number;
  }>;
}

interface InlineAgentPanelProps {
  agent: AgentManifest;
  onClose: () => void;
}

// Services that are purely informational — never show as interactive tabs
const HIDDEN_SERVICES = new Set(["docs", "documentation", "api", "readme", "about", "swagger", "ens"]);

// Services that are utility (no prompt, just a button that fetches and shows response)
const UTILITY_SERVICES = new Set(["health", "pricing", "status", "version", "metrics", "info"]);

function getServiceRole(service: AgentService): "interactive" | "utility" | "hidden" {
  const n = service.name.toLowerCase();
  if (HIDDEN_SERVICES.has(n)) return "hidden";
  if (UTILITY_SERVICES.has(n)) return "utility";
  return "interactive";
}

function getInputType(service: AgentService): "file" | "json" | "text" {
  if (service.input_type) return service.input_type;
  const name = service.name.toLowerCase();
  if (name.includes("upload") || name.includes("file") || name.includes("attach")) return "file";
  if (name.includes("json") || name.includes("pin") || name.includes("data") || name.includes("store")) return "json";
  return "text";
}

function getActionVerb(service: AgentService | null, inputType: "file" | "json" | "text"): string {
  if (service) {
    const n = service.name.toLowerCase();
    if (n.includes("upload")) return "upload";
    if (n.includes("pin")) return "pin";
    if (n.includes("analyz") || n.includes("analys")) return "analyze";
    if (n.includes("transcri")) return "transcribe";
    if (n.includes("convert")) return "convert";
    if (n.includes("summar")) return "summarize";
    if (n.includes("translat")) return "translate";
    if (n.includes("classif")) return "classify";
    if (n.includes("detect")) return "detect";
    if (n.includes("extract")) return "extract";
    if (n.includes("compil") || n.includes("build")) return "build";
    if (n.includes("render")) return "render";
  }
  if (inputType === "file") return "upload";
  if (inputType === "json") return "submit";
  return "generate";
}

function getInputPlaceholder(service: AgentService | null): string {
  if (service?.description) return `${service.description}`;
  if (!service) return "Enter your prompt...";
  const n = service.name.toLowerCase();
  if (n.includes("image") || n.includes("render")) return "Describe the image you want to generate...";
  if (n.includes("audio") || n.includes("tts") || n.includes("voice")) return "Enter the text to convert to speech...";
  if (n.includes("translat")) return "Enter text to translate...";
  if (n.includes("summar")) return "Paste the content to summarize...";
  if (n.includes("code") || n.includes("dev")) return "Describe what you want to build...";
  return `Enter your prompt for ${service.name}...`;
}

export function InlineAgentPanel({ agent, onClose }: InlineAgentPanelProps) {
  const storedServices = agent.services ?? [];

  // Probe if no services, or if interactive services are missing price data
  const needsProbe = storedServices.length === 0 ||
    storedServices.filter((s) => getServiceRole(s) === "interactive").some((s) => s.price_usd === undefined);

  const [services, setServices] = useState<AgentService[]>(storedServices);
  const [probing, setProbing] = useState(needsProbe);

  const interactiveServices = services.filter((s) => getServiceRole(s) === "interactive");
  const utilityServices = services.filter((s) => getServiceRole(s) === "utility");

  const [selectedService, setSelectedService] = useState<AgentService | null>(
    interactiveServices.length > 1 ? interactiveServices[0] : null
  );

  // Utility state: per-service result/loading
  const [utilityResults, setUtilityResults] = useState<Record<string, unknown>>({});
  const [utilityLoading, setUtilityLoading] = useState<Record<string, boolean>>({});
  const [prompt, setPrompt] = useState("");
  const [jsonInput, setJsonInput] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [generating, setGenerating] = useState(false);
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);

  // Auto-probe on mount if agent has no stored services
  useEffect(() => {
    getRating(agent.ens).then((r) => setRating({ avg: r.avg, count: r.count }));

    if (!needsProbe) return;
    probeAgent(agent.endpoint)
      .then((probe) => {
        if (probe.services.length > 0) {
          const derived: AgentService[] = probe.services.map((s) => {
            const nameLower = s.name.toLowerCase();
            const input_type: AgentService["input_type"] =
              nameLower.includes("upload") || nameLower.includes("file") ? "file"
              : nameLower.includes("json") || nameLower.includes("pin") ? "json"
              : "text";
            return {
              name: s.name,
              endpoint: s.endpoint, // use actual endpoint path, not the price key name
              price_usd: HIDDEN_SERVICES.has(nameLower) ? undefined : s.priceUsd,
              input_type,
            };
          });
          setServices(derived);
          const firstInteractive = derived.filter((s) => getServiceRole(s) === "interactive");
          setSelectedService(firstInteractive.length > 1 ? firstInteractive[0] : null);
        }
      })
      .catch(() => { /* probe failed, fall back to text prompt */ })
      .finally(() => setProbing(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasInteractive = interactiveServices.length > 1;
  const activeService = selectedService ?? (interactiveServices.length === 1 ? interactiveServices[0] : null);
  const inputType = activeService ? getInputType(activeService) : "text";
  const subPath = activeService?.endpoint ?? undefined;
  const actionVerb = getActionVerb(activeService, inputType);

  // Build the price to display
  const servicePrice = activeService?.price_usd ?? agent.price_usd;

  const handleUtility = async (svc: AgentService) => {
    setUtilityLoading((p) => ({ ...p, [svc.name]: true }));
    try {
      // Route through the worker's probe endpoint to avoid CORS issues.
      // probe hits /health and /pricing on the agent server-side and returns
      // { healthy, services: [{name, priceUsd}] }
      const probe = await probeAgent(agent.endpoint);
      if (svc.name === "health") {
        setUtilityResults((p) => ({
          ...p,
          [svc.name]: probe.healthy
            ? { status: "healthy ✓" }
            : { status: "unhealthy ✗" },
        }));
      } else if (svc.name === "pricing") {
        const pricing = probe.services.length > 0
          ? probe.services.reduce<Record<string, string>>((acc, s) => {
              acc[s.name] = `$${s.priceUsd.toFixed(2)}`;
              return acc;
            }, {})
          : { base: `$${probe.priceUsd.toFixed(2)}` };
        setUtilityResults((p) => ({ ...p, [svc.name]: pricing }));
      } else {
        setUtilityResults((p) => ({ ...p, [svc.name]: { status: "ok" } }));
      }
    } catch {
      setUtilityResults((p) => ({ ...p, [svc.name]: { error: "Could not reach endpoint" } }));
    } finally {
      setUtilityLoading((p) => ({ ...p, [svc.name]: false }));
    }
  };

  const buildInputs = (): { prompt: string; inputs: Record<string, unknown> } => {
    if (inputType === "json") {
      return { prompt: jsonInput, inputs: {} };
    }
    if (inputType === "file" && file) {
      // Convert file to base64 for JSON forwarding
      return { prompt: "", inputs: { filename: file.name, content_type: file.type } };
    }
    return { prompt, inputs: {} };
  };

  const handleGenerate = async () => {
    if (!agent) return;
    const { prompt: p, inputs } = buildInputs();
    if (!p && !file && !Object.keys(inputs).length) return;

    setGenerating(true);
    setError("");
    try {
      // For file uploads, read as base64 and include in inputs
      let finalInputs = inputs;
      if (inputType === "file" && file) {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(",")[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        finalInputs = { ...inputs, file_base64: base64 };
      }

      const res = await initiateGenerate(agent.ens, p, finalInputs, subPath);
      if ("requires402" in res) {
        setPaymentRequest(res.paymentRequest as PaymentRequest);
      } else {
        setResult(res.result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const handlePayment = async (proof: string) => {
    setPaymentRequest(null);
    const { prompt: p, inputs } = buildInputs();
    let finalInputs = inputs;
    if (inputType === "file" && file) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      finalInputs = { ...inputs, file_base64: base64 };
    }

    setGenerating(true);
    try {
      const res = await generateWithPayment(agent.ens, p, proof, finalInputs, subPath);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed after payment");
    } finally {
      setGenerating(false);
    }
  };

  const handleRate = async (stars: number) => {
    const updated = await submitRating(agent.ens, stars);
    setRating({ avg: updated.avg, count: updated.count });
  };

  const handleReset = () => {
    setResult(null);
    setPrompt("");
    setJsonInput("");
    setFile(null);
    setError("");
  };

  const canSubmit = inputType === "text" ? !!prompt.trim()
    : inputType === "json" ? !!jsonInput.trim()
    : !!file;

  return (
    <div className="mt-2 bg-[#16161f] border border-[#7c6aff]/30 rounded-xl shadow-[0_0_40px_rgba(124,106,255,0.1)] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2.5">
          {agent.favicon_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={agent.favicon_url} alt="" className="w-7 h-7 rounded-md object-cover" />
          ) : null}
          <span className="font-semibold text-sm">{agent.display_name}</span>
          <span className="font-mono text-xs text-[#4fd8b8]">${servicePrice.toFixed(2)}</span>
          {rating && <StarRating avg={rating.avg} count={rating.count} size="sm" />}
        </div>
        <button
          onClick={onClose}
          className="text-white/30 hover:text-white transition-colors p-1"
          aria-label="Close"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-5 space-y-4">
        {/* Probing state */}
        {probing && (
          <div className="flex items-center gap-2 text-sm text-white/30 animate-pulse py-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            Reading agent services...
          </div>
        )}

        {/* Interactive service tabs */}
        {hasInteractive && !result && !probing && (
          <div className="flex gap-1.5 flex-wrap">
            {interactiveServices.map((svc) => {
              const active = selectedService?.name === svc.name;
              return (
                <button
                  key={svc.name}
                  onClick={() => { setSelectedService(svc); handleReset(); }}
                  className={`px-3 py-2 rounded-lg text-sm transition-all border text-left ${
                    active
                      ? "bg-[#7c6aff]/20 border-[#7c6aff]/50 text-white"
                      : "bg-white/[0.03] border-white/[0.07] text-white/40 hover:text-white/70 hover:border-white/20"
                  }`}
                >
                  <span className="font-mono">{svc.name}</span>
                  {svc.price_usd !== undefined && (
                    <span className={`ml-1.5 text-xs font-mono ${active ? "text-[#4fd8b8]" : "text-white/30"}`}>
                      ${svc.price_usd.toFixed(2)}
                    </span>
                  )}
                  {svc.description && (
                    <div className="text-[10px] text-white/30 mt-0.5 font-sans max-w-[160px] truncate">
                      {svc.description}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Utility service buttons (health, pricing — no payment required) */}
        {utilityServices.length > 0 && !probing && (
          <div className="flex gap-2 flex-wrap">
            {utilityServices.map((svc) => {
              const utilLabel = svc.name === "health" ? "Check health" : svc.name === "pricing" ? "View pricing" : svc.name;
              const utilResult = utilityResults[svc.name];
              const utilBusy = utilityLoading[svc.name];
              return (
                <div key={svc.name} className="flex-1 min-w-[120px]">
                  <button
                    onClick={() => handleUtility(svc)}
                    disabled={utilBusy}
                    className="w-full px-3 py-2 bg-[#7c6aff]/10 hover:bg-[#7c6aff]/20 border border-[#7c6aff]/30 hover:border-[#7c6aff]/50 rounded-lg text-xs text-[#a598ff] hover:text-white transition-all font-mono disabled:opacity-40"
                  >
                    {utilBusy ? "..." : utilLabel}
                  </button>
                  {utilResult !== undefined && (
                    <pre className="mt-1.5 p-2.5 bg-black/20 border border-white/[0.05] rounded-lg text-[10px] font-mono text-white/50 overflow-auto max-h-32 whitespace-pre-wrap">
                      {typeof utilResult === "string" ? utilResult : JSON.stringify(utilResult, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Input area */}
        {!result && !probing && (
          <div className="space-y-3">
            {inputType === "text" && (
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder={getInputPlaceholder(activeService)}
                rows={4}
                maxLength={1000}
                className="w-full px-4 py-3 bg-[#111118] border border-white/[0.07] rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#7c6aff]/50 focus:ring-1 focus:ring-[#7c6aff]/30 transition-all resize-none text-sm"
              />
            )}

            {inputType === "json" && (
              <textarea
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                placeholder={'{\n  "path": "/my-file.txt",\n  "content": "Hello world"\n}'}
                rows={6}
                className="w-full px-4 py-3 bg-[#111118] border border-white/[0.07] rounded-xl text-white placeholder-white/25 focus:outline-none focus:border-[#7c6aff]/50 focus:ring-1 focus:ring-[#7c6aff]/30 transition-all resize-none text-sm font-mono"
                spellCheck={false}
              />
            )}

            {inputType === "file" && (
              <label className="block w-full cursor-pointer">
                <div className={`border-2 border-dashed rounded-xl px-5 py-8 text-center transition-all ${
                  file
                    ? "border-[#4fd8b8]/40 bg-[#4fd8b8]/5"
                    : "border-white/10 hover:border-white/20 bg-[#111118]"
                }`}>
                  {file ? (
                    <div>
                      <div className="text-sm text-white/70 font-mono truncate">{file.name}</div>
                      <div className="text-xs text-white/30 mt-1">{(file.size / 1024).toFixed(1)} KB</div>
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setFile(null); }}
                        className="text-xs text-white/25 hover:text-white/60 mt-2 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <div className="text-2xl mb-2">📎</div>
                      <div className="text-sm text-white/40">Drop file here or click to browse</div>
                    </div>
                  )}
                </div>
                <input
                  type="file"
                  className="sr-only"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={handleGenerate}
              disabled={!canSubmit || generating}
              className="w-full py-3 bg-[#7c6aff] hover:bg-[#6b59ee] disabled:opacity-40 disabled:cursor-not-allowed rounded-xl font-medium transition-all text-sm"
            >
              {generating
                ? `${actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1)}ing...`
                : `Pay $${servicePrice.toFixed(2)} & ${actionVerb}`
              }
            </button>
            <p className="text-xs text-center text-white/25">
              You&apos;ll scan a QR code to pay. No wallet connection needed.
            </p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-4">
            <ResultStream result={result} agent={agent} />
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs text-white/30">Rate this agent</span>
                <StarRating avg={0} count={0} interactive size="md" onRate={handleRate} />
              </div>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-2.5 bg-white/[0.05] hover:bg-white/[0.08] rounded-lg text-sm text-white/50 hover:text-white transition-all"
            >
              {hasInteractive ? actionVerb.charAt(0).toUpperCase() + actionVerb.slice(1) + " again" : "Try again"}
            </button>
          </div>
        )}
      </div>

      {paymentRequest && (
        <PaymentModal
          paymentRequest={paymentRequest}
          agentName={activeService ? `${agent.display_name} / ${activeService.name}` : agent.display_name}
          onPaid={handlePayment}
          onClose={() => setPaymentRequest(null)}
        />
      )}
    </div>
  );
}
