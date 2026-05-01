import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { addressExplorerLink, MOCK_MODE } from "@/lib/config";
import { getRequestIp, checkIpRateLimit, checkWalletRateLimit } from "@/lib/rateLimit";
import { createOrLoadPersistentAgent, type PersistentAgentResult } from "@/lib/ritual/persistentAgent";
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

    const walletSession = await getSessionByWallet(walletAddress);
    const requestedSession = requestedSessionId ? await getSession(requestedSessionId) : null;
    const existing = walletSession
      ?? (requestedSession?.userWallet.toLowerCase() === walletAddress.toLowerCase() ? requestedSession : null);
    const sessionId = existing?.id ?? requestedSessionId ?? crypto.randomUUID();

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
      existing,
    });
    const smartAccountAddress = smartAccount.smartAccountAddress as Address;

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
      persistentAgentMissingConfig: persistentAgentResult.persistentAgentMissingConfig,
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

    if (!MOCK_MODE) {
      return NextResponse.json({
        smartAccountAddress: session.smartAccountAddress,
        smartAccountDeploymentTxHash: session.smartAccountDeploymentTxHash,
        persistentAgentAddress: session.persistentAgentAddress,
        persistentAgentCreateTxHash: session.persistentAgentCreateTxHash,
        sessionKeyAddress: session.sessionKeyAddress,
        status: session.status,
        smartAccountStatus: "active",
        persistentAgentStatus: session.persistentAgentStatus ?? "pending",
        sessionKeyStatus: "pending",
        persistentAgentMissingConfig: session.persistentAgentMissingConfig,
        message: session.persistentAgentStatusMessage
          ?? "Smart Account loaded successfully. Persistent Agent integration is pending.",
        explorerLink: session.explorerLink,
        session,
        messages: await getSessionMessages(session.id),
      });
    }

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
