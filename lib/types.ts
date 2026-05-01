export type TxStatus = "pending" | "confirmed" | "failed";

export type AgentStatus = "creating" | "active" | "failed";

export interface AgentSession {
  id: string;
  userWallet: string;
  smartAccountAddress: string;
  smartAccountDeploymentTxHash?: string;
  persistentAgentAddress: string;
  sessionKeyAddress: string;
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
