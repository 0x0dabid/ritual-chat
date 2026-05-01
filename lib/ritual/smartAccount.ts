import { isAddress, type Address } from "viem";
import { getAAProviderAdapter } from "@/lib/ritual/aa";
import type { AgentSession } from "@/lib/types";

export async function createOrLoadSmartAccount(params: {
  userWallet: string;
  existing?: AgentSession | null;
}) {
  const { userWallet, existing } = params;
  if (existing) {
    return {
      smartAccountAddress: existing.smartAccountAddress as Address,
      deploymentTxHash: existing.smartAccountDeploymentTxHash as `0x${string}` | undefined,
    };
  }
  if (!isAddress(userWallet)) throw new Error("Invalid EVM wallet address.");

  const aaProvider = getAAProviderAdapter();
  return aaProvider.createOrLoadSmartAccount(userWallet);
}

export async function getSmartAccountAddress(walletAddress: string) {
  if (!isAddress(walletAddress)) throw new Error("Invalid EVM wallet address.");
  return getAAProviderAdapter().getSmartAccountAddress(walletAddress);
}

export async function createSessionKey(params: {
  walletAddress: string;
  smartAccountAddress: string;
}) {
  const { walletAddress, smartAccountAddress } = params;
  if (!isAddress(walletAddress)) throw new Error("Invalid EVM wallet address.");
  if (!isAddress(smartAccountAddress)) throw new Error("Invalid smart account address.");

  return getAAProviderAdapter().createSessionKey(walletAddress, smartAccountAddress);
}

export async function validateSessionKey(session: AgentSession) {
  if (new Date(session.sessionKeyExpiresAt).getTime() <= Date.now()) {
    throw new Error("Session key creation failed. Please create a new chat session.");
  }

  if (!isAddress(session.sessionKeyAddress)) {
    throw new Error("Session key creation failed. Please create a new chat session.");
  }

  const isValid = await getAAProviderAdapter().validateSessionKey(
    session.sessionKeyAddress as Address,
    session.smartAccountAddress as Address,
  );
  if (!isValid) {
    throw new Error("Session key creation failed. Please create a new chat session.");
  }
}
