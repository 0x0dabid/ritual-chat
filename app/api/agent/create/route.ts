import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { addressExplorerLink, MOCK_MODE } from "@/lib/config";
import { getRequestIp, checkIpRateLimit, checkWalletRateLimit } from "@/lib/rateLimit";
import { createOrLoadPersistentAgent } from "@/lib/ritual/persistentAgent";
import { createOrLoadSmartAccount, createSessionKey } from "@/lib/ritual/smartAccount";
import { getSession, getSessionByWallet, getSessionMessages, upsertSession } from "@/lib/storage";
import type { AgentSession } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    await checkIpRateLimit(ip, "agent:create");

    const body = await request.json().catch(() => ({}));
    const requestedSessionId = typeof body.sessionId === "string" ? body.sessionId : null;
    const requestedWallet = typeof body.userWallet === "string" ? body.userWallet : null;
    const userWallet = requestedWallet && isAddress(requestedWallet)
      ? requestedWallet
      : `public-test-session:${requestedSessionId ?? crypto.randomUUID()}`;

    await checkWalletRateLimit(ip, userWallet, "agent:wallet");

    const existing = requestedSessionId
      ? await getSession(requestedSessionId)
      : await getSessionByWallet(userWallet);
    const sessionId = existing?.id ?? requestedSessionId ?? crypto.randomUUID();

    if (existing?.status === "active") {
      return NextResponse.json({
        session: existing,
        messages: await getSessionMessages(existing.id),
      });
    }

    const smartAccountAddress = await createOrLoadSmartAccount({
      sessionId,
      userWallet,
      existing,
    }) as Address;
    const persistentAgentAddress = await createOrLoadPersistentAgent({
      sessionId,
      smartAccountAddress,
      existing,
    }) as Address;
    const sessionKey = await createSessionKey(sessionId);

    const now = new Date().toISOString();
    const session: AgentSession = {
      id: sessionId,
      userWallet,
      smartAccountAddress,
      persistentAgentAddress,
      sessionKeyAddress: sessionKey.sessionKeyAddress,
      sessionKeyExpiresAt: sessionKey.sessionKeyExpiresAt,
      status: "active",
      explorerLink: addressExplorerLink(persistentAgentAddress),
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      mockMode: MOCK_MODE,
    };

    await upsertSession(session);

    return NextResponse.json({
      smartAccountAddress: session.smartAccountAddress,
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
