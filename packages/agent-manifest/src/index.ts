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
