import type { AgentManifest, Registration } from "@sources-eth/agent-manifest";
import type { Env } from "../lib/registry";
import { storeAgent } from "../lib/registry";
import { pinJSON, fetchFromIPFS, PinataError, PUBLIC_IPFS_GATEWAY } from "../lib/ipfs";
import { verifyPayment, markPaymentUsed, buildRegistration402Response } from "../lib/payment";
import { lookupAgentBook } from "../lib/agentbook";
import { isSafeAgentUrl } from "../lib/safe-url";
import { verifyOwnerSignature, stripOwnerSignature, type OwnerSignature } from "../lib/owner-signature";
import { incrementStat } from "./stats";

export async function handleManifest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const plan = url.searchParams.get("plan") === "permanent" ? "permanent" : "trial";

  // Permanent plan is still 402-gated; trial is free
  if (plan === "permanent") {
    const paymentHeader = request.headers.get("X-PAYMENT");
    const resourceUrl = url.href;

    // Always read + validate the body first so we can check name availability
    // before issuing a 402 — prevents charging for a name that's already taken.
    const body = await request.json() as Partial<AgentManifest> & { owner_signature?: OwnerSignature };
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

    // Prove control of the payout wallet BEFORE the 402, so a builder is never
    // asked to pay for a listing their signature cannot authorise.
    const sigCheck = await verifyOwnerSignature(body, "permanent", env);
    if (!sigCheck.valid) {
      return new Response(JSON.stringify({ error: sigCheck.error }), {
        status: 401,
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

    // Check AgentBook — human verification is optional but stored if found
    const agentBook = await lookupAgentBook(body.payment_address!, env.WORLD_RPC_URL);

    const manifestToPin: AgentManifest = {
      ...(stripOwnerSignature(body) as AgentManifest),
      registered_at: Math.floor(now / 1000),
      ipfs_cid: "",
      manifest_version: "1.0",
      ...(agentBook.verified && {
        human_verified: true,
        world_human_id: agentBook.humanId,
      }),
    };

    let cid: string;
    try {
      cid = await pinJSON(manifestToPin, `agent-${body.name}`, env.PINATA_JWT);
    } catch (e) {
      // The payment already settled on-chain at this point and has NOT been
      // marked used, so the same X-PAYMENT proof can be retried once pinning
      // is healthy. Say so, and say why it failed.
      const reason = e instanceof PinataError ? e.reason : "unknown";
      console.error("pinJSON failed (paid registration)", reason);
      return new Response(
        JSON.stringify({
          error: `IPFS pinning failed: ${reason}`,
          retryable: true,
          detail: "Your payment was not consumed. Retry with the same X-PAYMENT header once this is resolved.",
        }),
        { status: 500, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
      );
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
    await incrementStat(env.AGENTS_KV, "stats:permanent_agents");

    return new Response(
      JSON.stringify({ success: true, cid, ens: manifestToPin.ens, trial_expires_at: null, status: "active" }),
      { headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" } }
    );
  }

  // Free trial — no payment required
  const body = await request.json() as Partial<AgentManifest> & { owner_signature?: OwnerSignature };
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

  const trialSig = await verifyOwnerSignature(body, "trial", env);
  if (!trialSig.valid) {
    return new Response(JSON.stringify({ error: trialSig.error }), {
      status: 401,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    });
  }

  const now = Date.now();
  const trialDays = parseInt(env.TRIAL_DURATION_DAYS, 10);
  const trialExpiresAt = now + trialDays * 24 * 60 * 60 * 1000;

  // Check AgentBook — human verification is optional but stored if found
  const agentBook = await lookupAgentBook(body.payment_address!, env.WORLD_RPC_URL);

  const manifestToPin: AgentManifest = {
    ...(stripOwnerSignature(body) as AgentManifest),
    registered_at: Math.floor(now / 1000),
    ipfs_cid: "",
    manifest_version: "1.0",
    ...(agentBook.verified && {
      human_verified: true,
      world_human_id: agentBook.humanId,
    }),
  };

  let cid: string;
  try {
    cid = await pinJSON(manifestToPin, `agent-${body.name}`, env.PINATA_JWT);
  } catch (e) {
    const reason = e instanceof PinataError ? e.reason : "unknown";
    console.error("pinJSON failed (free trial registration)", reason);
    return new Response(JSON.stringify({ error: `IPFS pinning failed: ${reason}` }), {
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
      ipfs_url: `${PUBLIC_IPFS_GATEWAY}${cid}`,
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

  // For autonomous listings: only apply human_verified if the payment_address
  // is already in the AgentBook. Strip any claimed human_verified from the
  // manifest CID — an agent cannot self-assert this status.
  const agentBook = await lookupAgentBook(manifest.payment_address, env.WORLD_RPC_URL);
  const verifiedManifest: AgentManifest = {
    ...manifest,
    human_verified: agentBook.verified ? true : undefined,
    world_human_id: agentBook.verified ? agentBook.humanId : undefined,
  };

  const reg: Registration = {
    ens: verifiedManifest.ens,
    tx_hash_trial: cid, // CID as proof for self-registration path
    fee_paid_total: 0,
    status: "trial",
    trial_started_at: now,
    trial_expires_at: now + trialDays * 24 * 60 * 60 * 1000,
  };

  await storeAgent(verifiedManifest, reg, env.AGENTS_KV);

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
  await incrementStat(env.AGENTS_KV, "stats:permanent_agents");

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

  const isExpired =
    reg.status === "trial_expired" ||
    (reg.status === "trial" && Date.now() > reg.trial_expires_at);

  const existing = await kv.get<AgentManifest>(`agents:${ens}`, "json");
  const isSameOwner =
    existing?.payment_address.toLowerCase() === newPaymentAddress.toLowerCase();

  if (isExpired) {
    if (isSameOwner) {
      // Original owner cannot grab a second free trial — must upgrade
      return {
        available: false,
        reason: `Your free trial for ${ens} has expired. Pay $49 to go permanent at sources.eth.limo/agent?ens=${ens}`,
      };
    }
    // Different owner — expired name is up for grabs
    return { available: true };
  }

  // Name is live (active or in-trial) — only the same owner can update it
  if (isSameOwner) return { available: true };

  const statusLabel = reg.status === "active" ? "permanently listed" : "in an active trial";
  return {
    available: false,
    reason: `${ens} is already registered and ${statusLabel}. Only the original owner can update it.`,
  };
}


/** "" means the base endpoint itself, which is already validated. */
function validateServiceEndpoint(endpoint: string, name?: string): string | null {
  const label = `Service "${name ?? "?"}"`;

  if (endpoint === "") return null;

  const isAbsolute = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(endpoint) || endpoint.startsWith("//");
  if (isAbsolute) {
    return isSafeAgentUrl(endpoint)
      ? null
      : `${label} endpoint must be an https:// URL on a public host`;
  }

  if (endpoint.length > 200) return `${label} endpoint is too long`;
  if (endpoint.includes("..")) return `${label} endpoint must not contain ".."`;
  if (!/^[A-Za-z0-9._~\-/]+$/.test(endpoint)) {
    return `${label} endpoint must be a plain sub-path (letters, digits, . _ ~ - /)`;
  }
  return null;
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

  if (!isSafeAgentUrl(body.endpoint!)) {
    return "Endpoint must be an https:// URL on a public host";
  }

  // A service endpoint is normally a RELATIVE sub-path ("upload"), which
  // /generate appends to the already-validated base by string concatenation:
  //   `${base}/${sub_path}`
  // That cannot change the host — "https://a.example/" + "https://evil.example"
  // is just a path on a.example — so a relative sub-path needs no host check,
  // only to be a sane path. An ABSOLUTE endpoint is a different matter and gets
  // the full public-https check.
  if (body.services !== undefined) {
    if (!Array.isArray(body.services)) {
      return "services must be an array";
    }
    for (const service of body.services) {
      if (!service || typeof service.endpoint !== "string") {
        return `Service "${service?.name ?? "?"}" is missing an endpoint`;
      }
      const err = validateServiceEndpoint(service.endpoint, service.name);
      if (err) return err;
    }
  }

  return null;
}
