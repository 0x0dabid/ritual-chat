import type { Address, Hex } from "viem";

export interface SessionKeyResult {
  sessionKeyAddress: Address;
  sessionKeyExpiresAt: string;
}

export interface UserOperationOrTxRequest {
  walletAddress: Address;
  smartAccountAddress: Address;
  target: Address;
  data: Hex;
  value?: bigint;
}

export interface UserOperationOrTx {
  kind: "mock" | "transaction" | "userOperation" | "setCodeTx";
  from: Address;
  to: Address;
  data: Hex;
  value: bigint;
  description: string;
}

export interface AAProviderAdapter {
  getProviderName(): string;
  isConfigured(): boolean;
  createOrLoadSmartAccount(walletAddress: Address): Promise<Address>;
  getSmartAccountAddress(walletAddress: Address): Promise<Address>;
  createSessionKey(walletAddress: Address, smartAccountAddress: Address): Promise<SessionKeyResult>;
  validateSessionKey(sessionKeyAddress: Address): Promise<boolean>;
  buildUserOperationOrTx(request: UserOperationOrTxRequest): Promise<UserOperationOrTx>;
}
