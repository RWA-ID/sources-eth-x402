import type { Env } from "../lib/registry";
import { getAgent } from "../lib/registry";
import { build402Response, verifyPayment, markPaymentUsed } from "../lib/payment";

export async function handleGenerate(request: Request, env: Env): Promise<Response> {
  const body = await request.json() as { ens: string; prompt?: string; sub_path?: string; [key: string]: unknown };
  const { ens, prompt, sub_path, ...agentInputs } = body;

  if (!ens) {
    return new Response(JSON.stringify({ error: "ens is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  if (!prompt && !Object.keys(agentInputs).length) {
    return new Response(JSON.stringify({ error: "prompt or input data is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const agent = await getAgent(ens, env.AGENTS_KV);
  if (!agent) {
    return new Response(JSON.stringify({ error: "Agent not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const paymentHeader = request.headers.get("X-PAYMENT");

  // Compute effective price for this service (needed for both 402 and verification)
  let effectivePrice = agent.price_usd;
  if (sub_path) {
    const svcName = sub_path.replace(/^\//, "").toLowerCase();
    const svc = agent.services?.find(
      (s) =>
        s.endpoint.replace(/^\//, "").toLowerCase() === svcName ||
        s.name.toLowerCase() === svcName
    );
    if (svc?.price_usd !== undefined) {
      effectivePrice = svc.price_usd;
    } else {
      // Service price not in manifest — probe agent's /pricing endpoint
      try {
        const base = agent.endpoint.replace(/\/$/, "");
        const pricingRes = await fetch(`${base}/pricing`, {
          headers: { Accept: "application/json" },
          signal: AbortSignal.timeout(5_000),
        });
        if (pricingRes.ok) {
          const pricingData = await pricingRes.json() as Record<string, unknown>;
          const entry = pricingData[svcName];
          if (entry && typeof entry === "object") {
            const e = entry as Record<string, unknown>;
            const p = e.usd ?? e.price ?? e.amount;
            if (typeof p === "number" && p > 0) effectivePrice = p;
          } else if (typeof entry === "number" && entry > 0) {
            effectivePrice = entry;
          }
        }
      } catch {
        // Probe failed — fall back to agent base price
      }
    }
  }

  // Step 1: No payment → return 402
  if (!paymentHeader) {
    const agentForPrice = effectivePrice !== agent.price_usd
      ? { ...agent, price_usd: effectivePrice }
      : agent;
    return build402Response(agentForPrice, new URL(request.url).href);
  }

  // Step 2: Verify payment — check recipient and amount match what was requested
  const amountRaw = Math.round(effectivePrice * 1_000_000).toString();
  const { valid, txHash, error } = await verifyPayment(paymentHeader, env, {
    payTo: agent.payment_address,
    amountRaw,
  });
  if (!valid || !txHash) {
    return new Response(JSON.stringify({ error: error ?? "Payment verification failed" }), {
      status: 402,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Step 3: Mark payment as used (replay protection)
  await markPaymentUsed(txHash, ens, env.AGENTS_KV);

  // Step 4: Forward to agent endpoint (with optional sub_path for multi-service agents)
  const base = agent.endpoint.replace(/\/$/, "");
  const targetUrl = sub_path ? `${base}/${sub_path.replace(/^\//, "")}` : base;

  // If body contains file_base64, convert to multipart/form-data for the agent
  let agentResponse: Response;
  if (agentInputs.file_base64 && typeof agentInputs.file_base64 === "string") {
    const { file_base64, filename, content_type, ...rest } = agentInputs as {
      file_base64: string;
      filename?: string;
      content_type?: string;
      [key: string]: unknown;
    };
    // Decode base64 → Uint8Array
    const binary = atob(file_base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const blob = new Blob([bytes], { type: content_type ?? "application/octet-stream" });
    const form = new FormData();
    form.append("file", blob, filename ?? "upload");
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) form.append(k, String(v));
    }
    agentResponse = await fetch(targetUrl, {
      method: "POST",
      headers: { "X-SOURCES-ETH": "1" },
      body: form,
    });
  } else {
    agentResponse = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-SOURCES-ETH": "1" },
      body: JSON.stringify({ ...(prompt !== undefined && { prompt }), ...agentInputs }),
    });
  }

  if (!agentResponse.ok) {
    const errText = await agentResponse.text().catch(() => "");
    return new Response(
      JSON.stringify({ error: "Agent endpoint error", status: agentResponse.status, detail: errText }),
      {
        status: 502,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      }
    );
  }

  const contentType = agentResponse.headers.get("content-type") ?? "";

  // SSE stream — pipe through
  if (contentType.includes("text/event-stream")) {
    return new Response(agentResponse.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }

  // JSON response
  if (contentType.includes("application/json")) {
    const result = await agentResponse.json();
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Plain text or anything else (e.g. IPFS CID returned as text/plain)
  const text = await agentResponse.text();
  return new Response(JSON.stringify({ result: text }), {
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}
