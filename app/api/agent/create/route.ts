import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { getRequestIp, checkIpRateLimit, checkWalletRateLimit } from "@/lib/rateLimit";
import { buildWalletChatSession } from "@/lib/ritual/chatSession";
import { getSessionByWallet, getSessionMessages, upsertSession } from "@/lib/storage";

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    await checkIpRateLimit(ip, "chat:identity");

    const body = await request.json().catch(() => ({}));
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress : null;
    if (!walletAddress) throw new Error("Missing walletAddress.");
    if (!isAddress(walletAddress)) throw new Error("Invalid EVM wallet address.");

    await checkWalletRateLimit(ip, walletAddress, "chat:wallet");

    const existing = await getSessionByWallet(walletAddress);
    const session = buildWalletChatSession(walletAddress as Address, existing?.createdAt);
    await upsertSession(session);

    return NextResponse.json({
      status: session.status,
      basicChatStatus: session.basicChatStatus,
      basicChatStatusMessage: session.basicChatStatusMessage,
      chatStatus: session.chatStatus,
      message: session.chatStatus === "ready"
        ? "Ritual Chat is ready."
        : session.basicChatStatusMessage,
      explorerLink: session.explorerLink,
      session,
      messages: await getSessionMessages(session.id),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong while starting Ritual Chat. Please try again.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
