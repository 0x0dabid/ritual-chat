import {
  decodeEventLog,
  encodeFunctionData,
  formatEther,
  type Address,
  type Hash,
} from "viem";
import { ethers } from "ethers";
import { privateKeyToAccount } from "viem/accounts";
import {
  CHAT_MANAGER_ADDRESS,
  MOCK_MODE,
  RELAYER_PRIVATE_KEY,
  RITUAL_RPC_URL,
} from "@/lib/config";
import { getPublicClient } from "@/lib/ritual/chain";
import { ritualChain } from "@/lib/ritual/chain";
import { parseCompletionText, ritualChatManagerAbi, validatePrompt } from "@/lib/ritual/llm";

export async function checkRelayerBalance() {
  if (MOCK_MODE) return { ok: true, balance: "mock" };
  if (!RELAYER_PRIVATE_KEY) {
    throw new Error("Relayer unavailable. Set RELAYER_PRIVATE_KEY on the server.");
  }

  const account = privateKeyToAccount(RELAYER_PRIVATE_KEY);
  const balance = await getPublicClient().getBalance({ address: account.address });
  if (balance <= 0n) {
    throw new Error("Relayer is temporarily out of testnet gas. Please try again later.");
  }
  return { ok: true, balance: formatEther(balance) };
}

export async function submitChatManagerTransaction(prompt: string) {
  if (!CHAT_MANAGER_ADDRESS) {
    throw new Error("Chat is disabled until CHAT_MANAGER_ADDRESS is configured.");
  }
  if (!RELAYER_PRIVATE_KEY) {
    throw new Error("Relayer unavailable. Set RELAYER_PRIVATE_KEY on the server.");
  }
  if (!RITUAL_RPC_URL) {
    throw new Error("RPC unavailable. Set RITUAL_RPC_URL to submit chat transactions.");
  }

  await checkRelayerBalance();

  const provider = new ethers.JsonRpcProvider(RITUAL_RPC_URL, Number(ritualChain.id));
  const signer = new ethers.Wallet(RELAYER_PRIVATE_KEY, provider);
  const gasPrice = await getPublicClient().getGasPrice();
  const data = encodeFunctionData({
    abi: ritualChatManagerAbi,
    functionName: "sendChatMessage",
    args: [validatePrompt(prompt)],
  });
  const tx = await signer.sendTransaction({
    to: CHAT_MANAGER_ADDRESS as Address,
    data,
    value: 0,
    gasLimit: 6_000_000n,
    gasPrice: gasPrice * 2n,
  });

  return tx.hash as Hash;
}

export async function waitForTxConfirmation(hash: Hash) {
  if (MOCK_MODE) {
    return { txHash: hash, status: "confirmed" as const, blockNumber: 1n };
  }

  const receipt = await getPublicClient().waitForTransactionReceipt({ hash });
  return {
    txHash: hash,
    status: receipt.status === "success" ? "confirmed" as const : "failed" as const,
    blockNumber: receipt.blockNumber,
  };
}

export async function getTxStatus(hash: Hash) {
  if (MOCK_MODE) {
    return { txHash: hash, status: "confirmed" as const, blockNumber: 1 };
  }

  const publicClient = getPublicClient();
  const receipt = await publicClient.getTransactionReceipt({ hash }).catch(() => null);
  if (!receipt) return { txHash: hash, status: "pending" as const };
  const chatResult = extractAssistantResponse(receipt.logs);
  if (receipt.status === "success" && chatResult.isChatTx && !isSettledAssistantResponse(chatResult.assistantResponse)) {
    return {
      txHash: hash,
      status: "pending" as const,
      blockNumber: Number(receipt.blockNumber),
      assistantResponse: chatResult.assistantResponse,
    };
  }

  return {
    txHash: hash,
    status: receipt.status === "success" ? "confirmed" as const : "failed" as const,
    blockNumber: Number(receipt.blockNumber),
    assistantResponse: chatResult.assistantResponse,
  };
}

function isSettledAssistantResponse(response: string | undefined) {
  if (!response) return false;
  const normalized = response.trim().toLowerCase();
  return normalized.length > 0
    && normalized !== "response pending on ritual testnet."
    && normalized !== "waiting for ritual testnet confirmation...";
}

function extractAssistantResponse(logs: Array<{ topics: readonly Hash[]; data: Hash }>) {
  let isChatTx = false;
  let assistantResponse: string | undefined;

  for (const log of logs) {
    try {
      const event = decodeEventLog({
        abi: ritualChatManagerAbi,
        data: log.data,
        topics: [...log.topics] as [Hash, ...Hash[]],
      });
      if (event.eventName === "ChatPromptSubmitted") {
        isChatTx = true;
      }
      if (event.eventName === "ChatResponseReceived") {
        isChatTx = true;
        assistantResponse = parseCompletionText(event.args.completionData);
      }
    } catch {
      // Ignore logs from the smart account, factory, and system contracts.
    }
  }

  return { isChatTx, assistantResponse };
}
