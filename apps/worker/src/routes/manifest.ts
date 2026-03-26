import type { AgentManifest, Registration } from "@sources-eth/agent-manifest";
import type { Env } from "../lib/registry";
import { storeAgent } from "../lib/registry";
import { pinJSON, fetchFromIPFS } from "../lib/ipfs";
import { verifyPayment, markPaymentUsed, buildRegistration402Response } from "../lib/payment";

export async function handleManifest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const plan = url.searchParams.get("plan") === "permanent" ? "permanent" : "trial";

  // Permanent plan is still 402-gated; trial is free
  if (plan === "permanent") {
    const paymentHeader = request.headers.get("X-PAYMENT");
    const resourceUrl = url.href;

    // Always read + validate the body first so we can check name availability
    // before issuing a 402 — prevents charging for a name that's already taken.
    const body = await request.json() as Partial<AgentManifest>;
    const validationError = validateManifest(body);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }), {
        status: 400,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const nameCheck = await checkNameAvailable(body.ens!, body.payment_address!, env.AGENTS_KV);
    if (!nameCheck.available) {
      return new Response(JSON.stringify({ error: nameCheck.reason }), {
        status: 409,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    if (!paymentHeader) {
      return buildRegistration402Response(
        env.FULL_FEE_USDC,
        resourceUrl,
        env.PLATFORM_TREASURY_ADDRESS,
        "sources.eth — Permanent Agent Listing ($49)"
      );
    }

    const { valid, txHash, error } = await verifyPayment(paymentHeader, env, {
      payTo: env.PLATFORM_TREASURY_ADDRESS,
      amountRaw: env.FULL_FEE_USDC,
    });
    if (!valid || !txHash) {
      return new Response(JSON.stringify({ error: error ?? "Payment verification failed" }), {
        status: 402,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    const now = Date.now();
    const manifestToPin: AgentManifest = {
      ...(body as AgentManifest),
      registered_at: Math.floor(now / 1000),
      ipfs_cid: "",
      manifest_version: "1.0",
    };

    let cid: string;
    try {
      cid = await pinJSON(manifestToPin, `agent-${body.name}`, env.PINATA_JWT);
    } catch {
      return new Response(JSON.stringify({ error: "IPFS pinning failed" }), {
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      });
    }

    manifestToPin.ipfs_cid = cid;

    const reg: Registration = {
      ens: manifestToPin.ens,
      tx_hash_trial: txHash,
      fee_paid_total: parseInt(env.FULL_FEE_USDC, 10),
      status: "active",
      trial_started_at: now,
      trial_expires_at: now,
      upgraded_at: now,
    };

    await storeAgent(manifestToPin, reg, env.AGENTS_KV);
    await markPaymentUsed(txHash, manifestToPin.ens, env.AGENTS_KV);

    return new Response(
      JSON.stringify({ success: true, cid, ens: manifestToPin.ens, trial_expires_at: null, status: "active" }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  // Free trial — no payment required
  const body = await request.json() as Partial<AgentManifest>;
  const validationError = validateManifest(body);
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const nameCheck = await checkNameAvailable(body.ens!, body.payment_address!, env.AGENTS_KV);
  if (!nameCheck.available) {
    return new Response(JSON.stringify({ error: nameCheck.reason }), {
      status: 409,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const now = Date.now();
  const trialDays = parseInt(env.TRIAL_DURATION_DAYS, 10);
  const trialExpiresAt = now + trialDays * 24 * 60 * 60 * 1000;

  const manifestToPin: AgentManifest = {
    ...(body as AgentManifest),
    registered_at: Math.floor(now / 1000),
    ipfs_cid: "",
    manifest_version: "1.0",
  };

  let cid: string;
  try {
    cid = await pinJSON(manifestToPin, `agent-${body.name}`, env.PINATA_JWT);
  } catch {
    return new Response(JSON.stringify({ error: "IPFS pinning failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  manifestToPin.ipfs_cid = cid;

  const reg: Registration = {
    ens: manifestToPin.ens,
    tx_hash_trial: "free",
    fee_paid_total: 0,
    status: "trial",
    trial_started_at: now,
    trial_expires_at: trialExpiresAt,
  };

  await storeAgent(manifestToPin, reg, env.AGENTS_KV);

  return new Response(
    JSON.stringify({
      success: true,
      cid,
      ens: manifestToPin.ens,
      ipfs_url: `https://gateway.pinata.cloud/ipfs/${cid}`,
      trial_expires_at: trialExpiresAt,
      status: "trial",
    }),
    { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
  );
}

export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const { cid } = await request.json() as { cid: string };
  if (!cid) {
    return new Response(JSON.stringify({ error: "cid is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Fetch and validate manifest from IPFS
  let manifest: AgentManifest;
  try {
    manifest = await fetchFromIPFS(cid) as AgentManifest;
  } catch {
    return new Response(JSON.stringify({ error: "Could not fetch manifest from IPFS" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const validationError = validateManifest(manifest);
  if (validationError) {
    return new Response(JSON.stringify({ error: validationError }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  // Validate endpoint responds
  try {
    const headResponse = await fetch(manifest.endpoint, { method: "HEAD" });
    if (!headResponse.ok && headResponse.status !== 405) {
      throw new Error(`Endpoint returned ${headResponse.status}`);
    }
  } catch {
    return new Response(JSON.stringify({ error: "Agent endpoint is not reachable" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const nameCheck = await checkNameAvailable(manifest.ens, manifest.payment_address, env.AGENTS_KV);
  if (!nameCheck.available) {
    return new Response(JSON.stringify({ error: nameCheck.reason }), {
      status: 409,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const now = Date.now();
  const trialDays = parseInt(env.TRIAL_DURATION_DAYS, 10);

  const reg: Registration = {
    ens: manifest.ens,
    tx_hash_trial: cid, // CID as proof for self-registration path
    fee_paid_total: 0,
    status: "trial",
    trial_started_at: now,
    trial_expires_at: now + trialDays * 24 * 60 * 60 * 1000,
  };

  await storeAgent(manifest, reg, env.AGENTS_KV);

  return new Response(
    JSON.stringify({ success: true, ens: manifest.ens }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

export async function handleUpgrade(ens: string, request: Request, env: Env): Promise<Response> {
  const reg = await env.AGENTS_KV.get<Registration>(`registrations:${ens}`, "json");
  if (!reg) {
    return new Response(JSON.stringify({ error: "Agent not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  if (reg.status === "active") {
    return new Response(JSON.stringify({ error: "Already active" }), {
      status: 400,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const paymentHeader = request.headers.get("X-PAYMENT");
  const resourceUrl = new URL(request.url).href;

  if (!paymentHeader) {
    return buildRegistration402Response(
      env.UPGRADE_FEE_USDC,
      resourceUrl,
      env.PLATFORM_TREASURY_ADDRESS,
      `sources.eth — Upgrade ${ens} to permanent listing ($39)`
    );
  }

  const { valid, txHash, error } = await verifyPayment(paymentHeader, env, {
    payTo: env.PLATFORM_TREASURY_ADDRESS,
    amountRaw: env.UPGRADE_FEE_USDC,
  });
  if (!valid || !txHash) {
    return new Response(JSON.stringify({ error: error ?? "Payment verification failed" }), {
      status: 402,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const updated: Registration = {
    ...reg,
    tx_hash_upgrade: txHash,
    fee_paid_total: reg.fee_paid_total + parseInt(env.UPGRADE_FEE_USDC, 10),
    status: "active",
    upgraded_at: Date.now(),
  };

  await env.AGENTS_KV.put(`registrations:${ens}`, JSON.stringify(updated));
  await markPaymentUsed(txHash, ens, env.AGENTS_KV);

  return new Response(
    JSON.stringify({ success: true, ens, status: "active" }),
    {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    }
  );
}

async function checkNameAvailable(
  ens: string,
  newPaymentAddress: string,
  kv: KVNamespace
): Promise<{ available: boolean; reason?: string }> {
  const reg = await kv.get<Registration>(`registrations:${ens}`, "json");
  if (!reg) return { available: true };

  // Expired trials are reclaimable by anyone
  if (reg.status === "trial_expired") return { available: true };
  if (reg.status === "trial" && Date.now() > reg.trial_expires_at) return { available: true };

  // Name is live (active or in-trial) — only the existing owner can update it
  const existing = await kv.get<AgentManifest>(`agents:${ens}`, "json");
  if (existing && existing.payment_address.toLowerCase() === newPaymentAddress.toLowerCase()) {
    return { available: true }; // same owner — allow update
  }

  const statusLabel = reg.status === "active" ? "permanently listed" : "in an active trial";
  return {
    available: false,
    reason: `${ens} is already registered and ${statusLabel}. Only the original owner can update it.`,
  };
}

function validateManifest(body: Partial<AgentManifest>): string | null {
  const required = [
    "name", "display_name", "description", "ens", "version",
    "endpoint", "method", "price_usd", "payment_address",
    "payment_chain", "payment_token", "category", "tags", "input", "output",
  ] as const;

  for (const field of required) {
    if (body[field] === undefined || body[field] === null) {
      return `Missing required field: ${field}`;
    }
  }

  if (!body.ens!.endsWith(".agents.sources.eth")) {
    return "Agent handle must end in .agents.sources.eth";
  }

  if (body.price_usd! < 0.001) {
    return "Minimum price is $0.001";
  }

  if (!body.endpoint!.startsWith("https://")) {
    return "Endpoint must use HTTPS";
  }

  return null;
}
