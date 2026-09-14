export type AgentCategory =
  | "generative-media"
  | "text-content"
  | "ai-assistants"
  | "coding-dev"
  | "data-analytics"
  | "payments-finance"
  | "identity-verification"
  | "security-compliance"
  | "audio-voice"
  | "ecommerce"
  | "workflow-automation"
  | "knowledge-search"
  | "legal-ai"
  | "medical-health"
  | "real-estate"
  | "accounting-finance"
  | "other";

export interface InputField {
  type: "string" | "number" | "boolean" | "enum";
  required: boolean;
  description?: string;
  options?: string[];
  default?: unknown;
  maxLength?: number;
}

export interface AgentService {
  name: string;
  endpoint: string;
  price_usd?: number;
  description?: string;
  input_type?: "text" | "file" | "json";
}

export interface AgentManifest {
  // Identity
  name: string;
  display_name: string;
  description: string;
  ens: string;
  version: string;

  // Endpoint
  endpoint: string;
  method: "POST";

  // Payment
  price_usd: number;
  payment_address: string;
  payment_chain: number;
  payment_token: "USDC";

  // Categorization
  category: AgentCategory;
  tags: string[];

  // I/O
  input: {
    prompt: { type: "string"; required: true; maxLength: 1000 };
    [key: string]: InputField;
  };
  output: {
    type: "image" | "audio" | "video" | "text" | "code" | "data";
    format: string;
    delivery: "url" | "stream" | "base64";
  };

  // Services (multi-service agents from EIP-8004 metadata)
  services?: AgentService[];

  // Branding
  favicon_url?: string;

  // Quality
  sample_outputs?: string[];
  avg_latency_ms?: number;

  // Human verification (World ID Agent Kit)
  human_verified?: boolean;
  world_human_id?: string;

  // Metadata
  author_address?: string;
  ipfs_cid: string;
  registered_at: number;
  manifest_version: "1.0";
}

export interface Registration {
  ens: string;
  tx_hash_trial: string;
  tx_hash_upgrade?: string;
  fee_paid_total: number;
  status: "trial" | "trial_expired" | "active";
  trial_started_at: number;
  trial_expires_at: number;
  upgraded_at?: number;
}

export interface AgentRating {
  ens: string;
  total: number;
  count: number;
  avg: number;
}

export type ShareTarget = "twitter" | "tiktok" | "instagram" | "facebook";

export interface SharePayload {
  agentName: string;
  agentEns: string;
  category: AgentCategory;
  price: string;
  resultUrl?: string;
  resultPreview?: string;
}

/**
 * Owner-signature message.
 *
 * SHARED ON PURPOSE. The worker verifies exactly the string the browser signs,
 * so this must have one definition — two copies that drift by a single space
 * make every signature fail verification with no useful error.
 *
 * Every field named here is part of what the signer agreed to. Adding a field
 * to a listing without adding it here leaves that field unauthenticated.
 */
export interface OwnerSignature {
  signature: string;
  nonce: string;
  issued_at: number;
}

export type ListingPlan = "trial" | "permanent";

export function buildRegistrationMessage(params: {
  ens: string;
  endpoint: string;
  payment_address: string;
  plan: ListingPlan;
  nonce: string;
  issued_at: number;
}): string {
  return [
    "sources.eth — Agent Listing Authorization",
    "",
    "I control this wallet and authorize this listing.",
    "",
    `Agent:    ${params.ens}`,
    `Endpoint: ${params.endpoint}`,
    `Payout:   ${params.payment_address}`,
    `Plan:     ${params.plan}`,
    `Nonce:    ${params.nonce}`,
    `Issued:   ${new Date(params.issued_at).toISOString()}`,
  ].join("\n");
}

/**
 * Message signed to claim or rotate an agent's forwarding secret.
 *
 * Deliberately distinct from buildRegistrationMessage so a signature captured
 * from a registration can never be replayed to extract a secret.
 */
export function buildSecretMessage(params: {
  ens: string;
  payment_address: string;
  nonce: string;
  issued_at: number;
}): string {
  return [
    "sources.eth — Agent Secret Request",
    "",
    "I control this wallet and request the forwarding secret for this listing.",
    "This rotates any previous secret.",
    "",
    `Agent:  ${params.ens}`,
    `Payout: ${params.payment_address}`,
    `Nonce:  ${params.nonce}`,
    `Issued: ${new Date(params.issued_at).toISOString()}`,
  ].join("\n");
}
