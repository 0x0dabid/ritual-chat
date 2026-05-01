import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { MOCK_MODE } from "@/lib/config";
import { getRequestIp, checkIpRateLimit, checkSmartAccountRateLimit } from "@/lib/rateLimit";
import { getAAProviderAdapter } from "@/lib/ritual/aa";
import { buildSmartAccountChatCall, sendPromptToRitualLLM, validatePrompt } from "@/lib/ritual/llm";
import { checkRelayerBalance } from "@/lib/ritual/relayer";
import { getOnchainSmartAccountSession } from "@/lib/ritual/realSession";
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
    const session = await getSession(sessionId)
      ?? (!MOCK_MODE && isAddress(sessionId) ? await getOnchainSmartAccountSession(sessionId as Address) : null);

    if (!session) throw new Error("Create or load your Ritual Smart Account before chatting.");
    if (!isAddress(session.userWallet)) throw new Error("Connect your wallet before chatting.");
    await checkSmartAccountRateLimit(ip, session.smartAccountAddress, "chat:aa");

    if (!MOCK_MODE) {
      if (session.smartAccountStatus !== "active") {
        throw new Error("Chat is disabled until the Smart Account is active.");
      }
      if (session.basicChatStatus !== "active") {
        if (session.chatStatus === "needs-funding") {
          throw new Error("Fund your Ritual Smart Account with testnet RITUAL before chatting.");
        }
        if (session.chatStatus === "needs-session-key") {
          throw new Error("Authorize the chat session key before chatting.");
        }
        if (session.chatStatus === "target-not-approved") {
          throw new Error("ChatManager is not approved on the smart account factory yet.");
        }
        throw new Error("Chat is disabled until CHAT_MANAGER_ADDRESS is configured.");
      }
      await validateSessionKey(session);
      await checkRelayerBalance();

      const txRequest = buildSmartAccountChatCall({
        smartAccountAddress: session.smartAccountAddress as Address,
        prompt,
      });
      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        role: "user",
        content: prompt,
        txStatus: "confirmed",
        createdAt: new Date().toISOString(),
      };
      await addChatMessage(userMessage);
      const tx = await getAAProviderAdapter().buildUserOperationOrTx({
        walletAddress: session.userWallet as Address,
        smartAccountAddress: session.smartAccountAddress as Address,
        from: session.sessionKeyAddress as Address,
        to: txRequest.to,
        target: txRequest.chatManagerAddress,
        data: txRequest.data,
        value: 0n,
      });
      if (!tx.txHash) throw new Error("Chat transaction failed before a transaction hash was returned.");

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        role: "assistant",
        content: "Response pending on Ritual Testnet.",
        txHash: tx.txHash,
        txStatus: "pending",
        createdAt: new Date().toISOString(),
      };
      await addChatMessage(assistantMessage);

      return NextResponse.json({
        txHash: tx.txHash,
        txStatus: "pending",
        assistantResponse: "Response pending on Ritual Testnet.",
        messageId: assistantMessage.id,
        message: assistantMessage,
      });
    }

    if (session.status !== "active") throw new Error("Chat is disabled until setup is active.");
    await validateSessionKey(session);
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

    const txHash = `0x${crypto.randomUUID().replace(/-/g, "").padEnd(64, "0")}`;
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
    const status = message.includes("too long")
      || message.includes("empty")
      || message.includes("disabled")
      || message.includes("configured")
      ? 400
      : 429;
    return NextResponse.json({ error: message }, { status });
  }
}
