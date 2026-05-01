import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { RITUAL_LLM_PRECOMPILE_ADDRESS } from "@/lib/config";
import { getRequestIp, checkIpRateLimit, checkSmartAccountRateLimit } from "@/lib/rateLimit";
import { buildLlmCallData, sendPromptToRitualLLM, validatePrompt } from "@/lib/ritual/llm";
import { checkRelayerBalance, submitRelayedTransaction } from "@/lib/ritual/relayer";
import { validateSessionKey } from "@/lib/ritual/smartAccount";
import { addChatMessage, getSession } from "@/lib/storage";
import type { ChatMessage } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    await checkIpRateLimit(ip, "chat:send");

    const body = await request.json();
    const sessionId = String(body.sessionId ?? "");
    const prompt = validatePrompt(String(body.prompt ?? ""));
    const session = await getSession(sessionId);

    if (!session) throw new Error("Create your Persistent Ritual Agent before chatting.");
    if (session.status !== "active") throw new Error("Agent creation failed. Please try again.");
    if (!isAddress(session.userWallet)) throw new Error("Connect your wallet before chatting.");
    validateSessionKey(session);
    await checkSmartAccountRateLimit(ip, session.smartAccountAddress, "chat:aa");
    await checkRelayerBalance();

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      role: "user",
      content: prompt,
      txStatus: "confirmed",
      createdAt: new Date().toISOString(),
    };
    await addChatMessage(userMessage);

    const callData = buildLlmCallData({
      executor: session.sessionKeyAddress as Address,
      prompt,
      convoPath: `ritual-chat/${session.smartAccountAddress}/conversation.jsonl`,
      convoKeyRef: "GCS_CREDS",
    });

    const txHash = await submitRelayedTransaction({
      target: RITUAL_LLM_PRECOMPILE_ADDRESS,
      data: callData,
      sessionKeyAddress: session.sessionKeyAddress as Address,
    });
    const assistantResponse = await sendPromptToRitualLLM(prompt);

    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      sessionId: session.id,
      role: "assistant",
      content: assistantResponse,
      txHash,
      txStatus: "pending",
      createdAt: new Date().toISOString(),
    };
    await addChatMessage(assistantMessage);

    return NextResponse.json({
      assistantResponse,
      txHash,
      txStatus: "pending",
      messageId: assistantMessage.id,
      message: assistantMessage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ritual LLM response failed. Please try again.";
    const status = message.includes("too long") || message.includes("empty") ? 400 : 429;
    return NextResponse.json({ error: message }, { status });
  }
}
