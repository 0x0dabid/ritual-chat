import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { addressExplorerLink, MOCK_MODE, USE_FILE_STORAGE } from "@/lib/config";
import { getRequestIp, checkIpRateLimit, checkWalletRateLimit } from "@/lib/rateLimit";
import { createOrLoadPersistentAgent, type PersistentAgentResult } from "@/lib/ritual/persistentAgent";
import { buildRealSession, walletSessionId } from "@/lib/ritual/realSession";
import { createOrLoadSmartAccount, createSessionKey } from "@/lib/ritual/smartAccount";
import { getSession, getSessionByWallet, getSessionMessages, upsertSession } from "@/lib/storage";
import type { AgentSession } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    await checkIpRateLimit(ip, "agent:create");

    const body = await request.json().catch(() => ({}));
    const requestedSessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress : null;
    if (!walletAddress) throw new Error("Missing walletAddress.");
    if (!isAddress(walletAddress)) throw new Error("Invalid EVM wallet address.");

    await checkWalletRateLimit(ip, walletAddress, "agent:wallet");

    const walletSession = USE_FILE_STORAGE ? await getSessionByWallet(walletAddress) : null;
    const requestedSession = USE_FILE_STORAGE && requestedSessionId ? await getSession(requestedSessionId) : null;
    const existing = walletSession
      ?? (requestedSession?.userWallet.toLowerCase() === walletAddress.toLowerCase() ? requestedSession : null);
    const sessionId = MOCK_MODE
      ? existing?.id ?? requestedSessionId ?? crypto.randomUUID()
      : walletSessionId(walletAddress);

    if (!MOCK_MODE && existing?.mockMode) {
      throw new Error("Real AA provider is not configured yet.");
    }

    if (existing?.status === "active") {
      return NextResponse.json({
        session: existing,
        messages: await getSessionMessages(existing.id),
      });
    }

    const smartAccount = await createOrLoadSmartAccount({
      userWallet: walletAddress,
      existing: MOCK_MODE ? existing : null,
    });
    const smartAccountAddress = smartAccount.smartAccountAddress as Address;

    if (!MOCK_MODE) {
      const session = await buildRealSession({
        walletAddress: walletAddress as Address,
        smartAccountAddress,
        smartAccountDeploymentTxHash: smartAccount.deploymentTxHash,
        createdAt: existing?.createdAt,
      });

      return NextResponse.json({
        smartAccountAddress: session.smartAccountAddress,
        smartAccountDeploymentTxHash: session.smartAccountDeploymentTxHash,
        persistentAgentAddress: session.persistentAgentAddress,
        persistentAgentCreateTxHash: session.persistentAgentCreateTxHash,
        sessionKeyAddress: session.sessionKeyAddress,
        status: session.status,
        smartAccountStatus: "active",
        persistentAgentStatus: session.persistentAgentStatus ?? "pending",
        basicChatStatus: session.basicChatStatus ?? "pending",
        basicChatStatusMessage: session.basicChatStatusMessage,
        sessionKeyStatus: "pending",
        persistentAgentMissingConfig: session.persistentAgentMissingConfig,
        message: session.persistentAgentStatusMessage
          ?? "Smart Account loaded successfully. Persistent Agent integration is pending.",
        explorerLink: session.explorerLink,
        session,
        messages: [],
      });
    }

    const persistentAgent = await createOrLoadPersistentAgent({
      sessionId,
      smartAccountAddress,
      existing,
    });
    const persistentAgentResult = normalizePersistentAgentResult(persistentAgent);

    const sessionKey = MOCK_MODE
      ? await createSessionKey({
        walletAddress,
        smartAccountAddress,
      })
      : {
        sessionKeyAddress: "0x0000000000000000000000000000000000000000" as Address,
        sessionKeyExpiresAt: new Date(0).toISOString(),
      };

    const now = new Date().toISOString();
    const session: AgentSession = {
      id: sessionId,
      userWallet: walletAddress,
      smartAccountAddress,
      smartAccountDeploymentTxHash: smartAccount.deploymentTxHash,
      smartAccountStatus: "active",
      persistentAgentAddress: persistentAgentResult.persistentAgentAddress,
      persistentAgentStatus: persistentAgentResult.persistentAgentStatus,
      persistentAgentCreateTxHash: persistentAgentResult.persistentAgentCreateTxHash,
      persistentAgentStatusMessage: persistentAgentResult.persistentAgentStatusMessage,
      persistentAgentProviderLabel: persistentAgentResult.persistentAgentProviderLabel,
      persistentAgentMissingConfig: persistentAgentResult.persistentAgentMissingConfig,
      basicChatStatus: "active",
      basicChatStatusMessage: "Mock mode chat is active.",
      sessionKeyAddress: sessionKey.sessionKeyAddress,
      sessionKeyStatus: MOCK_MODE ? "active" : "pending",
      sessionKeyExpiresAt: sessionKey.sessionKeyExpiresAt,
      status: MOCK_MODE ? "active" : "creating",
      explorerLink: persistentAgentResult.persistentAgentStatus === "active"
        ? addressExplorerLink(persistentAgentResult.persistentAgentAddress)
        : addressExplorerLink(smartAccountAddress),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      mockMode: MOCK_MODE,
    };

    await upsertSession(session);

    return NextResponse.json({
      smartAccountAddress: session.smartAccountAddress,
      smartAccountDeploymentTxHash: session.smartAccountDeploymentTxHash,
      persistentAgentAddress: session.persistentAgentAddress,
      sessionKeyAddress: session.sessionKeyAddress,
      status: session.status,
      explorerLink: session.explorerLink,
      session,
      messages: await getSessionMessages(session.id),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong while creating your Ritual agent. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
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
