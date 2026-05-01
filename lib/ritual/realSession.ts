import { formatEther, isAddress, type Address } from "viem";
import { addressExplorerLink, CHAT_MANAGER_ADDRESS, MIN_SMART_ACCOUNT_BALANCE_WEI } from "@/lib/config";
import { getBasicChatStatusMessage, isBasicChatConfigured } from "@/lib/ritual/llm";
import { isChatTargetApproved } from "@/lib/ritual/aa/realAAProvider";
import { getPublicClient } from "@/lib/ritual/chain";
import { createSessionKey, getSmartAccountAddress, validateSessionKey } from "@/lib/ritual/smartAccount";
import type { AgentSession } from "@/lib/types";

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
  const basicChatEnabled = isBasicChatConfigured();
  const balance = await getPublicClient().getBalance({ address: params.smartAccountAddress });
  const hasMinimumSmartAccountBalance = balance >= MIN_SMART_ACCOUNT_BALANCE_WEI;
  const sessionKey = await createSessionKey({
    walletAddress: params.walletAddress,
    smartAccountAddress: params.smartAccountAddress,
  });
  let sessionKeyStatus: AgentSession["sessionKeyStatus"] = "pending";
  try {
    await validateSessionKey({
      id: sessionId,
      userWallet: params.walletAddress,
      smartAccountAddress: params.smartAccountAddress,
      sessionKeyAddress: sessionKey.sessionKeyAddress,
      sessionKeyExpiresAt: sessionKey.sessionKeyExpiresAt,
      status: "active",
      explorerLink: addressExplorerLink(params.smartAccountAddress),
      createdAt: params.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      mockMode: false,
    });
    sessionKeyStatus = "active";
  } catch {
    sessionKeyStatus = "pending";
  }
  const chatTargetApproved = Boolean(
    CHAT_MANAGER_ADDRESS && isAddress(CHAT_MANAGER_ADDRESS) && await isChatTargetApproved(CHAT_MANAGER_ADDRESS),
  );
  const chatStatus = !basicChatEnabled
    ? "missing-chat-manager"
    : !chatTargetApproved
      ? "target-not-approved"
      : !hasMinimumSmartAccountBalance
        ? "needs-funding"
        : sessionKeyStatus !== "active"
          ? "needs-session-key"
          : "ready";
  const now = new Date().toISOString();

  return {
    id: sessionId,
    userWallet: params.walletAddress,
    smartAccountAddress: params.smartAccountAddress,
    smartAccountDeploymentTxHash: params.smartAccountDeploymentTxHash,
    smartAccountStatus: "active",
    smartAccountBalanceWei: balance.toString(),
    smartAccountBalanceFormatted: formatEther(balance),
    minimumSmartAccountBalanceWei: MIN_SMART_ACCOUNT_BALANCE_WEI.toString(),
    hasMinimumSmartAccountBalance,
    basicChatStatus: chatStatus === "ready" ? "active" : "pending",
    basicChatStatusMessage: getBasicChatStatusMessage(),
    chatTargetApproved,
    chatStatus,
    sessionKeyAddress: sessionKey.sessionKeyAddress,
    sessionKeyStatus,
    sessionKeyExpiresAt: sessionKey.sessionKeyExpiresAt,
    status: "active",
    explorerLink: addressExplorerLink(params.smartAccountAddress),
    createdAt: params.createdAt ?? now,
    updatedAt: now,
    mockMode: false,
  };
}
