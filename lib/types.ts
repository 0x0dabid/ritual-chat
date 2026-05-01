export type TxStatus = "pending" | "confirmed" | "failed";

export type AgentStatus = "creating" | "active" | "failed";
export type IntegrationStatus = "pending" | "creating" | "active" | "failed" | "advanced-pending";
export type ChatStatus = "ready" | "missing-chat-manager" | "pending";

export interface AgentSession {
  id: string;
  userWallet: string;
  smartAccountAddress: string;
  smartAccountDeploymentTxHash?: string;
  smartAccountStatus?: IntegrationStatus;
  persistentAgentAddress: string;
  persistentAgentStatus?: IntegrationStatus;
  persistentAgentCreateTxHash?: string;
  persistentAgentStatusMessage?: string;
  persistentAgentProviderLabel?: string;
  persistentAgentMissingConfig?: string[];
  basicChatStatus?: IntegrationStatus;
  basicChatStatusMessage?: string;
  chatStatus?: ChatStatus;
  sessionKeyAddress: string;
  sessionKeyStatus?: IntegrationStatus;
  sessionKeyExpiresAt: string;
  status: AgentStatus;
  explorerLink: string;
  createdAt: string;
  updatedAt: string;
  mockMode: boolean;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  txHash?: string;
  txStatus: TxStatus;
  createdAt: string;
}

export interface RateLimitRecord {
  id: string;
  ip: string;
  wallet?: string;
  smartAccountAddress?: string;
  requestType: string;
  count: number;
  date: string;
}

export interface AppData {
  sessions: AgentSession[];
  messages: ChatMessage[];
  rateLimits: RateLimitRecord[];
}
