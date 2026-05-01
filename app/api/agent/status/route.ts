import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { MOCK_MODE, USE_FILE_STORAGE } from "@/lib/config";
import { getOnchainSmartAccountSession } from "@/lib/ritual/realSession";
import { getSession, getSessionByWallet, getSessionMessages } from "@/lib/storage";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const walletAddress = url.searchParams.get("walletAddress");
  if (!sessionId && !walletAddress) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  if (walletAddress && !isAddress(walletAddress)) {
    return NextResponse.json({ error: "Invalid EVM wallet address." }, { status: 400 });
  }

  const realModeWalletIdentity = walletAddress ?? (sessionId && isAddress(sessionId) ? sessionId : null);

  if (!MOCK_MODE && realModeWalletIdentity) {
    const session = await getOnchainSmartAccountSession(realModeWalletIdentity as Address);
    if (!session) {
      return NextResponse.json({ error: "Smart account not created yet." }, { status: 404 });
    }

    return NextResponse.json({
      smartAccountAddress: session.smartAccountAddress,
      smartAccountStatus: session.smartAccountStatus ?? "active",
      smartAccountBalanceWei: session.smartAccountBalanceWei,
      smartAccountBalanceFormatted: session.smartAccountBalanceFormatted,
      minimumSmartAccountBalanceWei: session.minimumSmartAccountBalanceWei,
      hasMinimumSmartAccountBalance: session.hasMinimumSmartAccountBalance,
      basicChatStatus: session.basicChatStatus,
      basicChatStatusMessage: session.basicChatStatusMessage,
      chatTargetApproved: session.chatTargetApproved,
      chatStatus: session.chatStatus,
      sessionKeyAddress: session.sessionKeyAddress,
      sessionKeyStatus: session.sessionKeyStatus,
      sessionKeyExpiresAt: session.sessionKeyExpiresAt,
      sessionStatus: session.status,
      agentStatus: session.status,
      session,
      messages: [],
    });
  }

  if (!USE_FILE_STORAGE) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const session = sessionId
    ? await getSession(sessionId)
    : await getSessionByWallet(walletAddress!);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({
    smartAccountAddress: session.smartAccountAddress,
    smartAccountStatus: session.smartAccountStatus ?? "active",
    smartAccountBalanceWei: session.smartAccountBalanceWei,
    smartAccountBalanceFormatted: session.smartAccountBalanceFormatted,
    minimumSmartAccountBalanceWei: session.minimumSmartAccountBalanceWei,
    hasMinimumSmartAccountBalance: session.hasMinimumSmartAccountBalance,
    basicChatStatus: session.basicChatStatus,
    basicChatStatusMessage: session.basicChatStatusMessage,
    chatTargetApproved: session.chatTargetApproved,
    chatStatus: session.chatStatus,
    sessionKeyAddress: session.sessionKeyAddress,
    sessionKeyStatus: session.sessionKeyStatus,
    sessionKeyExpiresAt: session.sessionKeyExpiresAt,
    sessionStatus: session.status,
    agentStatus: session.status,
    session,
    messages: await getSessionMessages(session.id),
  });
}
