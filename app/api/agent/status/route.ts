import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { buildWalletChatSession } from "@/lib/ritual/chatSession";
import { getSession, getSessionByWallet, getSessionMessages, upsertSession } from "@/lib/storage";

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

  const existing = walletAddress
    ? await getSessionByWallet(walletAddress)
    : sessionId ? await getSession(sessionId) : null;
  const identity = walletAddress ?? existing?.userWallet;
  if (!identity || !isAddress(identity)) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const session = buildWalletChatSession(identity as Address, existing?.createdAt);
  await upsertSession(session);

  return NextResponse.json({
    basicChatStatus: session.basicChatStatus,
    basicChatStatusMessage: session.basicChatStatusMessage,
    chatStatus: session.chatStatus,
    sessionStatus: session.status,
    agentStatus: session.status,
    session,
    messages: await getSessionMessages(session.id),
  });
}
