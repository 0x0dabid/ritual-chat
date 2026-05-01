import type { Address } from "viem";
import { SESSION_KEY_TTL_DAYS } from "@/lib/config";
import { mockAddress } from "@/lib/mock";
import { addDays } from "@/lib/time";
import type {
  AAProviderAdapter,
  SessionKeyResult,
  UserOperationOrTx,
  UserOperationOrTxRequest,
} from "@/lib/ritual/aa/types";

export class MockAAProviderAdapter implements AAProviderAdapter {
  getProviderName() {
    return "MockAAProviderAdapter";
  }

  isConfigured() {
    return true;
  }

  async createOrLoadSmartAccount(walletAddress: Address) {
    return {
      smartAccountAddress: await this.getSmartAccountAddress(walletAddress),
    };
  }

  async getSmartAccountAddress(walletAddress: Address) {
    return mockAddress(`aa:${walletAddress}`) as Address;
  }

  async createSessionKey(walletAddress: Address, smartAccountAddress: Address): Promise<SessionKeyResult> {
    return {
      sessionKeyAddress: mockAddress(`session-key:${walletAddress}:${smartAccountAddress}`) as Address,
      sessionKeyExpiresAt: addDays(new Date(), SESSION_KEY_TTL_DAYS).toISOString(),
    };
  }

  async validateSessionKey(sessionKeyAddress: Address) {
    return Boolean(sessionKeyAddress);
  }

  async buildUserOperationOrTx(request: UserOperationOrTxRequest): Promise<UserOperationOrTx> {
    return {
      kind: "mock",
      from: request.smartAccountAddress,
      to: request.target,
      data: request.data,
      value: request.value ?? 0n,
      description: "Mock AA operation. No on-chain transaction is created.",
    };
  }
}
