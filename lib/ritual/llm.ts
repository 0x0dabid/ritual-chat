import {
  decodeAbiParameters,
  encodeAbiParameters,
  encodeFunctionData,
  isAddress,
  parseAbi,
  parseAbiParameters,
  type Address,
  type Hex,
} from "viem";
import {
  CHAT_MANAGER_ADDRESS,
  MAX_PROMPT_LENGTH,
  MOCK_MODE,
  RITUAL_LIVE_TEXT_MODEL,
  RITUAL_LLM_CONVO_HISTORY_KEY_REF,
  RITUAL_LLM_CONVO_HISTORY_PATH,
  RITUAL_LLM_CONVO_HISTORY_PROVIDER,
  RITUAL_LLM_TEMPERATURE,
  RITUAL_LLM_TTL,
} from "@/lib/config";
import { mockAssistantResponse } from "@/lib/mock";

export const ritualChatManagerAbi = parseAbi([
  "function sendChatMessage(string prompt) returns (bytes output)",
]);

export const ritualChatSmartAccountAbi = parseAbi([
  "function executeChatCall(address target, bytes data) returns (bytes result)",
]);

export function validatePrompt(prompt: string) {
  const trimmed = prompt.trim();
  if (!trimmed) throw new Error("User sent empty prompt.");
  if (trimmed.length > MAX_PROMPT_LENGTH) {
    throw new Error("Your prompt is too long. Please keep it under 1000 characters.");
  }
  return trimmed;
}

export async function sendPromptToRitualLLM(prompt: string) {
  if (MOCK_MODE) {
    return mockAssistantResponse(prompt);
  }

  // In real mode this text is decoded from the settled Ritual LLM response. The
  // relayer submits only the encoded, approved call built by buildLlmCallData().
  return "Waiting for Ritual Testnet confirmation...";
}

export function isBasicChatConfigured() {
  return Boolean(CHAT_MANAGER_ADDRESS && isAddress(CHAT_MANAGER_ADDRESS));
}

export function getBasicChatStatusMessage() {
  return isBasicChatConfigured()
    ? "Basic chat uses Ritual LLM."
    : "Basic chat is pending CHAT_MANAGER_ADDRESS configuration.";
}

export function buildChatManagerCallData(prompt: string) {
  return encodeFunctionData({
    abi: ritualChatManagerAbi,
    functionName: "sendChatMessage",
    args: [validatePrompt(prompt)],
  });
}

export function buildSmartAccountChatCall(params: {
  smartAccountAddress: Address;
  prompt: string;
}) {
  if (!isBasicChatConfigured()) {
    throw new Error("Chat is disabled until CHAT_MANAGER_ADDRESS is configured.");
  }

  const managerData = buildChatManagerCallData(params.prompt);
  const data = encodeFunctionData({
    abi: ritualChatSmartAccountAbi,
    functionName: "executeChatCall",
    args: [CHAT_MANAGER_ADDRESS!, managerData],
  });

  return {
    to: params.smartAccountAddress,
    data,
    chatManagerAddress: CHAT_MANAGER_ADDRESS!,
  };
}

export function buildLlmCallData(params: {
  executor: Address;
  prompt: string;
  convoPath?: string;
  convoKeyRef?: string;
}) {
  const convoHistoryProvider = RITUAL_LLM_CONVO_HISTORY_PROVIDER;
  const convoHistoryPath = params.convoPath ?? RITUAL_LLM_CONVO_HISTORY_PATH;
  const convoHistoryKeyRef = params.convoKeyRef ?? RITUAL_LLM_CONVO_HISTORY_KEY_REF;
  if (!convoHistoryProvider || !convoHistoryPath || !convoHistoryKeyRef) {
    throw new Error("Ritual LLM convoHistory config is missing.");
  }

  // Confirmed from latest ritual-dapp-skills on 2026-05-01:
  // LLM precompile 0x0802 accepts this 30-field ABI payload and current live
  // text model should be pinned to zai-org/GLM-4.7-FP8.
  return encodeAbiParameters(
    parseAbiParameters([
      "address, bytes[], uint256, bytes[], bytes,",
      "string, string, int256, string, bool, int256, string, string,",
      "uint256, bool, int256, string, bytes, int256, string, string, bool,",
      "int256, bytes, bytes, int256, int256, string, bool,",
      "(string,string,string)",
    ].join("")),
    [
      params.executor,
      [],
      BigInt(RITUAL_LLM_TTL),
      [],
      "0x",
      JSON.stringify([{ role: "user", content: params.prompt }]),
      RITUAL_LIVE_TEXT_MODEL,
      0n,
      "",
      false,
      4096n,
      "",
      "",
      1n,
      true,
      0n,
      "medium",
      "0x",
      -1n,
      "auto",
      "",
      false,
      BigInt(RITUAL_LLM_TEMPERATURE),
      "0x",
      "0x",
      -1n,
      1000n,
      "",
      false,
      [convoHistoryProvider, convoHistoryPath, convoHistoryKeyRef],
    ],
  );
}

export function parseLLMResponse(data: Hex) {
  const [hasError, completionData, , errorMessage] = decodeAbiParameters(
    parseAbiParameters("bool, bytes, bytes, string, (string,string,string)"),
    data,
  );

  if (hasError) throw new Error(errorMessage || "Ritual LLM response failed.");
  return Buffer.from(completionData.slice(2), "hex").toString("utf8");
}
