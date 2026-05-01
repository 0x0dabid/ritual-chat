import { keccak256, stringToHex } from "viem";

export function mockAddress(seed: string) {
  return `0x${keccak256(stringToHex(seed)).slice(26)}`;
}

export function mockTxHash(seed: string) {
  return keccak256(stringToHex(`${seed}:${Date.now()}:${Math.random()}`));
}

export function mockAssistantResponse(prompt: string) {
  return [
    "Mock Ritual LLM response:",
    `I received your text prompt: "${prompt.slice(0, 160)}${prompt.length > 160 ? "..." : ""}"`,
    "In real mode this response is produced through Ritual LLM and tracked by a Ritual Testnet transaction hash.",
  ].join(" ");
}
