import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { addressExplorerLink, MOCK_MODE, USE_FILE_STORAGE } from "@/lib/config";
import { getRequestIp, checkIpRateLimit, checkWalletRateLimit } from "@/lib/rateLimit";
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
        smartAccountBalanceWei: session.smartAccountBalanceWei,
        smartAccountBalanceFormatted: session.smartAccountBalanceFormatted,
        minimumSmartAccountBalanceWei: session.minimumSmartAccountBalanceWei,
        hasMinimumSmartAccountBalance: session.hasMinimumSmartAccountBalance,
        sessionKeyAddress: session.sessionKeyAddress,
        sessionKeyExpiresAt: session.sessionKeyExpiresAt,
        status: session.status,
        smartAccountStatus: "active",
        basicChatStatus: session.basicChatStatus ?? "pending",
        basicChatStatusMessage: session.basicChatStatusMessage,
        chatStatus: session.chatStatus,
        sessionKeyStatus: session.sessionKeyStatus,
        chatTargetApproved: session.chatTargetApproved,
        message: "Your Ritual Smart Account is active.",
        explorerLink: session.explorerLink,
        session,
        messages: [],
      });
    }

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
      basicChatStatus: "active",
      basicChatStatusMessage: "Mock mode chat is active.",
      chatStatus: "ready",
      sessionKeyAddress: sessionKey.sessionKeyAddress,
      sessionKeyStatus: MOCK_MODE ? "active" : "pending",
      sessionKeyExpiresAt: sessionKey.sessionKeyExpiresAt,
      status: MOCK_MODE ? "active" : "creating",
      explorerLink: addressExplorerLink(smartAccountAddress),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      mockMode: MOCK_MODE,
    };

    await upsertSession(session);

    return NextResponse.json({
      smartAccountAddress: session.smartAccountAddress,
      smartAccountDeploymentTxHash: session.smartAccountDeploymentTxHash,
      sessionKeyAddress: session.sessionKeyAddress,
      status: session.status,
      explorerLink: session.explorerLink,
      session,
      messages: await getSessionMessages(session.id),
      smartAccountStatus: session.smartAccountStatus,
      chatStatus: session.chatStatus,
      message: "Your Ritual Smart Account is active.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong while creating your Ritual Smart Account. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
