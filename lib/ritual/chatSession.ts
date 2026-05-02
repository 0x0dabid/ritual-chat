import { isAddress, type Address } from "viem";
import { addressExplorerLink, CHAT_MANAGER_ADDRESS, MOCK_MODE, RELAYER_PRIVATE_KEY } from "@/lib/config";
import { isBasicChatConfigured } from "@/lib/ritual/llm";
import type { AgentSession } from "@/lib/types";

export function walletSessionId(walletAddress: string) {
  return walletAddress.toLowerCase();
}

export function buildWalletChatSession(walletAddress: Address, createdAt?: string): AgentSession {
  if (!isAddress(walletAddress)) throw new Error("Invalid EVM wallet address.");

  const chatStatus = !isBasicChatConfigured()
    ? "missing-chat-manager"
    : !MOCK_MODE && !RELAYER_PRIVATE_KEY
      ? "missing-relayer"
      : "ready";
  const now = new Date().toISOString();

  return {
    id: walletSessionId(walletAddress),
    userWallet: walletAddress,
    smartAccountAddress: walletAddress,
    smartAccountStatus: "active",
    basicChatStatus: chatStatus === "ready" ? "active" : "pending",
    basicChatStatusMessage: chatStatus === "ready"
      ? "Basic chat uses Ritual LLM."
      : chatStatus === "missing-relayer"
        ? "Basic chat is pending server relayer configuration."
        : "Basic chat is pending CHAT_MANAGER_ADDRESS configuration.",
    chatTargetApproved: Boolean(CHAT_MANAGER_ADDRESS),
    chatStatus,
    sessionKeyAddress: "0x0000000000000000000000000000000000000000",
    sessionKeyStatus: "active",
    sessionKeyExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    status: "active",
    explorerLink: CHAT_MANAGER_ADDRESS ? addressExplorerLink(CHAT_MANAGER_ADDRESS) : "https://explorer.ritualfoundation.org",
    createdAt: createdAt ?? now,
    updatedAt: now,
    mockMode: MOCK_MODE,
  };
}
