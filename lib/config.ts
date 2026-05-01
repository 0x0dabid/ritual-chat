import type { Address } from "viem";

export const RITUAL_CHAIN_ID = Number(process.env.NEXT_PUBLIC_RITUAL_CHAIN_ID ?? "1979");
export const RITUAL_EXPLORER_URL = process.env.NEXT_PUBLIC_RITUAL_EXPLORER_URL ?? "https://explorer.ritualfoundation.org";

export const MOCK_MODE = process.env.MOCK_MODE !== "false";
export const SESSION_KEY_TTL_DAYS = 7;
export const SESSION_KEY_TTL_HOURS_OPTION = 24;

export const MAX_PROMPT_LENGTH = 1000;
export const MAX_CHAT_MESSAGES_PER_AA_PER_DAY = 20;
export const MAX_REQUESTS_PER_IP_PER_DAY = 50;

export const RITUAL_RPC_URL = process.env.RITUAL_RPC_URL;
export const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
export const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;

export const AA_PROVIDER_KIND = process.env.AA_PROVIDER ?? process.env.AA_PROVIDER_KIND ?? "custom";
export const AA_FACTORY_ADDRESS = process.env.AA_FACTORY_ADDRESS as `0x${string}` | undefined;
export const AA_ENTRYPOINT_ADDRESS = process.env.AA_ENTRYPOINT_ADDRESS as `0x${string}` | undefined;
export const AA_BUNDLER_RPC_URL = process.env.AA_BUNDLER_RPC_URL;
export const AA_PAYMASTER_RPC_URL = process.env.AA_PAYMASTER_RPC_URL;
export const AA_SESSION_KEY_MODULE_ADDRESS = process.env.AA_SESSION_KEY_MODULE_ADDRESS as `0x${string}` | undefined;

export const PERSISTENT_AGENT_FACTORY_ADDRESS = (
  process.env.PERSISTENT_AGENT_FACTORY_ADDRESS ?? "0xD4AA9D55215dc8149Af57605e70921Ea16b73591"
) as Address;

export const PERSISTENT_AGENT_PRECOMPILE_ADDRESS = (
  process.env.PERSISTENT_AGENT_PRECOMPILE_ADDRESS ?? "0x0000000000000000000000000000000000000820"
) as Address;

export const RITUAL_LLM_PRECOMPILE_ADDRESS = (
  process.env.RITUAL_LLM_PRECOMPILE_ADDRESS ?? "0x0000000000000000000000000000000000000802"
) as Address;

export const TEE_SERVICE_REGISTRY_ADDRESS = "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F" as Address;
export const RITUAL_LIVE_TEXT_MODEL = "zai-org/GLM-4.7-FP8";

export function txExplorerLink(txHash: string) {
  return `${RITUAL_EXPLORER_URL}/tx/${txHash}`;
}

export function addressExplorerLink(address: string) {
  return `${RITUAL_EXPLORER_URL}/address/${address}`;
}
