export type TxStatus = "pending" | "confirmed" | "failed";

export type AgentStatus = "creating" | "active" | "failed";
export type IntegrationStatus = "pending" | "creating" | "active" | "failed" | "advanced-pending" | "expired";
export type ChatStatus = "ready" | "missing-chat-manager" | "missing-relayer" | "pending" | "needs-funding" | "needs-session-key" | "target-not-approved";

export interface AgentSession {
  id: string;
  userWallet: string;
  smartAccountAddress: string;
  smartAccountDeploymentTxHash?: string;
  smartAccountStatus?: IntegrationStatus;
  smartAccountBalanceWei?: string;
  smartAccountBalanceFormatted?: string;
  minimumSmartAccountBalanceWei?: string;
  hasMinimumSmartAccountBalance?: boolean;
  basicChatStatus?: IntegrationStatus;
  basicChatStatusMessage?: string;
  chatTargetApproved?: boolean;
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
