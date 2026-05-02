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
  "event ChatPromptSubmitted(address indexed smartAccount, address indexed caller, string prompt)",
  "event ChatResponseReceived(address indexed smartAccount, bytes completionData, bytes modelMetadata, (string platform,string path,string keyRef) updatedConvoHistory)",
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
  // frontend submits only the encoded, approved call built by buildLlmCallData().
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
  const convoHistoryProvider = RITUAL_LLM_CONVO_HISTORY_PROVIDER ?? "";
  const convoHistoryPath = params.convoPath ?? RITUAL_LLM_CONVO_HISTORY_PATH ?? "";
  const convoHistoryKeyRef = params.convoKeyRef ?? RITUAL_LLM_CONVO_HISTORY_KEY_REF ?? "";
  const hasAnyConvoHistory = Boolean(convoHistoryProvider || convoHistoryPath || convoHistoryKeyRef);
  const hasCompleteConvoHistory = Boolean(convoHistoryProvider && convoHistoryPath && convoHistoryKeyRef);
  if (hasAnyConvoHistory && !hasCompleteConvoHistory) {
    throw new Error("Ritual LLM convoHistory config is incomplete.");
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
  return parseCompletionText(completionData);
}

export function parseCompletionText(completionData: Hex) {
  try {
    const [, , , , , , choicesCount, choicesData] = decodeAbiParameters(
      parseAbiParameters("string, string, uint256, string, string, string, uint256, bytes[], bytes"),
      completionData,
    );
    if (choicesCount > 0n && choicesData.length > 0) {
      const [, , messageData] = decodeAbiParameters(
        parseAbiParameters("uint256, string, bytes"),
        choicesData[0] as Hex,
      );
      const [, content] = decodeAbiParameters(
        parseAbiParameters("string, string, string, uint256, bytes[]"),
        messageData,
      );
      if (content.trim()) return content.trim();
    }
  } catch {
    // Some error paths emit plain bytes instead of ABI-encoded CompletionData.
  }

  const raw = Buffer.from(completionData.slice(2), "hex").toString("utf8");
  if (!raw) return "Ritual LLM returned an empty response.";

  try {
    const parsed = JSON.parse(raw) as {
      choices?: Array<{ message?: { content?: string }, text?: string }>;
      content?: string;
    };
    const content = parsed.choices?.[0]?.message?.content
      ?? parsed.choices?.[0]?.text
      ?? parsed.content;
    return content?.trim() || raw;
  } catch {
    return raw;
  }
}
