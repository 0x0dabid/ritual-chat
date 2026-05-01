import { NextResponse } from "next/server";
import { isAddress } from "viem";
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

  const session = sessionId
    ? await getSession(sessionId)
    : await getSessionByWallet(walletAddress!);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({
    smartAccountAddress: session.smartAccountAddress,
    persistentAgentAddress: session.persistentAgentAddress,
    sessionStatus: session.status,
    agentStatus: session.status,
    session,
    messages: await getSessionMessages(session.id),
  });
}
