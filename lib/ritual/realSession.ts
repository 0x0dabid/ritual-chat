import { type Address } from "viem";
import { addressExplorerLink } from "@/lib/config";
import { createOrLoadPersistentAgent, type PersistentAgentResult } from "@/lib/ritual/persistentAgent";
import { getPublicClient } from "@/lib/ritual/chain";
import { getSmartAccountAddress } from "@/lib/ritual/smartAccount";
import type { AgentSession } from "@/lib/types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export function walletSessionId(walletAddress: string) {
  return walletAddress.toLowerCase();
}

export async function getOnchainSmartAccountSession(walletAddress: Address) {
  const smartAccountAddress = await getSmartAccountAddress(walletAddress);
  const code = await getPublicClient().getCode({ address: smartAccountAddress });
  if (!code || code === "0x") return null;

  return buildRealSession({
    walletAddress,
    smartAccountAddress,
    smartAccountDeploymentTxHash: undefined,
  });
}

export async function buildRealSession(params: {
  walletAddress: Address;
  smartAccountAddress: Address;
  smartAccountDeploymentTxHash?: `0x${string}`;
  createdAt?: string;
}): Promise<AgentSession> {
  const sessionId = walletSessionId(params.walletAddress);
  const persistentAgent = await createOrLoadPersistentAgent({
    sessionId,
    smartAccountAddress: params.smartAccountAddress,
  });
  const persistentAgentResult = normalizePersistentAgentResult(persistentAgent);
  const now = new Date().toISOString();

  return {
    id: sessionId,
    userWallet: params.walletAddress,
    smartAccountAddress: params.smartAccountAddress,
    smartAccountDeploymentTxHash: params.smartAccountDeploymentTxHash,
    smartAccountStatus: "active",
    persistentAgentAddress: persistentAgentResult.persistentAgentAddress,
    persistentAgentStatus: persistentAgentResult.persistentAgentStatus,
    persistentAgentCreateTxHash: persistentAgentResult.persistentAgentCreateTxHash,
    persistentAgentStatusMessage: persistentAgentResult.persistentAgentStatusMessage,
    persistentAgentMissingConfig: persistentAgentResult.persistentAgentMissingConfig,
    sessionKeyAddress: ZERO_ADDRESS,
    sessionKeyStatus: "pending",
    sessionKeyExpiresAt: new Date(0).toISOString(),
    status: "creating",
    explorerLink: persistentAgentResult.persistentAgentStatus === "active"
      ? addressExplorerLink(persistentAgentResult.persistentAgentAddress)
      : addressExplorerLink(params.smartAccountAddress),
    createdAt: params.createdAt ?? now,
    updatedAt: now,
    mockMode: false,
  };
}

function normalizePersistentAgentResult(value: Address | PersistentAgentResult): PersistentAgentResult {
  if (typeof value === "string") {
    return {
      persistentAgentAddress: value,
      persistentAgentStatus: "active",
    };
  }

  return value;
}
