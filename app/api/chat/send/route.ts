import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { CHAT_MANAGER_ADDRESS, MOCK_MODE } from "@/lib/config";
import { getRequestIp, checkIpRateLimit, checkWalletChatRateLimit } from "@/lib/rateLimit";
import { buildWalletChatSession } from "@/lib/ritual/chatSession";
import { buildChatManagerCallData, sendPromptToRitualLLM, validatePrompt } from "@/lib/ritual/llm";
import { addChatMessage, getSession, upsertSession } from "@/lib/storage";
import type { ChatMessage } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    await checkIpRateLimit(ip, "chat:send");

    const body = await request.json();
    const sessionId = String(body.sessionId ?? "");
    const prompt = validatePrompt(String(body.prompt ?? ""));
    const session = await getSession(sessionId)
      ?? (isAddress(sessionId) ? buildWalletChatSession(sessionId as Address) : null);

    if (!session) throw new Error("Connect your wallet before chatting.");
    if (!isAddress(session.userWallet)) throw new Error("Connect your wallet before chatting.");
    await checkWalletChatRateLimit(ip, session.userWallet, "chat:wallet");

    const refreshedSession = buildWalletChatSession(session.userWallet as Address, session.createdAt);
    await upsertSession(refreshedSession);
    if (refreshedSession.chatStatus === "missing-chat-manager") {
      throw new Error("Chat is disabled until CHAT_MANAGER_ADDRESS is configured.");
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: refreshedSession.id,
      role: "user",
      content: prompt,
      txStatus: "confirmed",
      createdAt: new Date().toISOString(),
    };
    await addChatMessage(userMessage);

    const txHash = MOCK_MODE
      ? `0x${crypto.randomUUID().replace(/-/g, "").padEnd(64, "0")}`
      : undefined;
    const assistantResponse = MOCK_MODE
      ? await sendPromptToRitualLLM(prompt)
      : "Response pending on Ritual Testnet.";

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: refreshedSession.id,
      role: "assistant",
      content: assistantResponse,
      txHash,
      txStatus: "pending",
      createdAt: new Date().toISOString(),
    };
    if (MOCK_MODE) {
      await addChatMessage(assistantMessage);
    }

    return NextResponse.json({
      requiresWalletSubmission: !MOCK_MODE,
      txRequest: MOCK_MODE ? undefined : {
        to: CHAT_MANAGER_ADDRESS,
        data: buildChatManagerCallData(prompt),
        value: "0",
      },
      assistantResponse,
      txHash,
      txStatus: "pending",
      messageId: assistantMessage.id,
      message: assistantMessage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ritual LLM response failed. Please try again.";
    const status = message.includes("too long")
      || message.includes("empty")
      || message.includes("disabled")
      || message.includes("configured")
      || message.includes("Connect your wallet")
      ? 400
      : 429;
    return NextResponse.json({ error: message }, { status });
  }
}
