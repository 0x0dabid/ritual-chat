import type { Address } from "viem";

export const RITUAL_CHAIN_ID = Number(process.env.NEXT_PUBLIC_RITUAL_CHAIN_ID ?? "1979");
export const RITUAL_EXPLORER_URL = process.env.NEXT_PUBLIC_RITUAL_EXPLORER_URL ?? "https://explorer.ritualfoundation.org";

export const IS_VERCEL = process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV);
export const MOCK_MODE = !IS_VERCEL && process.env.MOCK_MODE === "true";
export const SESSION_KEY_TTL_DAYS = 7;
export const SESSION_KEY_TTL_HOURS_OPTION = 24;
export const SESSION_KEY_TTL_HOURS = parsePositiveNumber(process.env.SESSION_KEY_TTL_HOURS, 24);

export const MAX_PROMPT_LENGTH = 1000;
export const MAX_CHAT_MESSAGES_PER_AA_PER_DAY = 20;
export const MAX_REQUESTS_PER_IP_PER_DAY = 50;
export const MIN_SMART_ACCOUNT_BALANCE_WEI = BigInt(process.env.MIN_SMART_ACCOUNT_BALANCE_WEI ?? "1000000000000000");

export const RITUAL_RPC_URL = process.env.RITUAL_RPC_URL;
export const RELAYER_PRIVATE_KEY = process.env.RELAYER_PRIVATE_KEY as `0x${string}` | undefined;
export const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY as `0x${string}` | undefined;
export type StorageDriver = "local-file" | "memory" | "database";

function resolveStorageDriver(): StorageDriver {
  const requested = process.env.STORAGE_DRIVER as StorageDriver | undefined;
  const driver = requested ?? (MOCK_MODE ? "local-file" : "memory");

  if (IS_VERCEL && driver === "local-file") {
    return "memory";
  }

  if (driver === "local-file" || driver === "memory" || driver === "database") {
    return driver;
  }

  return MOCK_MODE ? "local-file" : "memory";
}

export const STORAGE_DRIVER = resolveStorageDriver();
export const USE_FILE_STORAGE = STORAGE_DRIVER === "local-file";
export const USE_MEMORY_STORAGE = STORAGE_DRIVER === "memory";
export const USE_DATABASE_STORAGE = STORAGE_DRIVER === "database";

export const AA_PROVIDER_KIND = process.env.AA_PROVIDER ?? process.env.AA_PROVIDER_KIND ?? "custom";
export const AA_FACTORY_ADDRESS = (
  process.env.AA_FACTORY_ADDRESS ?? "0x98fb3c3Cb0291E43D138dA1051a7b98Bfa75eda0"
) as `0x${string}`;
export const AA_ENTRYPOINT_ADDRESS = process.env.AA_ENTRYPOINT_ADDRESS as `0x${string}` | undefined;
export const AA_BUNDLER_RPC_URL = process.env.AA_BUNDLER_RPC_URL;
export const AA_PAYMASTER_RPC_URL = process.env.AA_PAYMASTER_RPC_URL;
export const AA_SESSION_KEY_MODULE_ADDRESS = process.env.AA_SESSION_KEY_MODULE_ADDRESS as `0x${string}` | undefined;

function normalizePrecompileAddress(value: string | undefined, fallback: Address) {
  if (!value) return fallback;
  if (/^0x[0-9a-fA-F]{1,4}$/.test(value)) {
    return `0x${value.slice(2).padStart(40, "0")}` as Address;
  }
  return value as Address;
}

export const RITUAL_LLM_PRECOMPILE_ADDRESS = normalizePrecompileAddress(
  process.env.RITUAL_LLM_PRECOMPILE_ADDRESS,
  "0x0000000000000000000000000000000000000802",
);
export const CHAT_MANAGER_ADDRESS = process.env.CHAT_MANAGER_ADDRESS as Address | undefined;
export const RITUAL_LLM_EXECUTOR_ADDRESS = process.env.RITUAL_LLM_EXECUTOR_ADDRESS as Address | undefined;

export const TEE_SERVICE_REGISTRY_ADDRESS = "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F" as Address;
export const RITUAL_LIVE_TEXT_MODEL = process.env.RITUAL_LLM_MODEL ?? "zai-org/GLM-4.7-FP8";
export const RITUAL_LLM_TTL = Number(process.env.RITUAL_LLM_TTL ?? "30");
export const RITUAL_LLM_TEMPERATURE = Number(process.env.RITUAL_LLM_TEMPERATURE ?? "700");
export const RITUAL_LLM_MAX_COMPLETION_TOKENS = Number(process.env.RITUAL_LLM_MAX_COMPLETION_TOKENS ?? "512");
export const RITUAL_LLM_CONVO_HISTORY_PROVIDER = process.env.RITUAL_LLM_CONVO_HISTORY_PROVIDER;
export const RITUAL_LLM_CONVO_HISTORY_PATH = process.env.RITUAL_LLM_CONVO_HISTORY_PATH;
export const RITUAL_LLM_CONVO_HISTORY_KEY_REF = process.env.RITUAL_LLM_CONVO_HISTORY_KEY_REF;
export const RITUAL_WALLET_ADDRESS = (
  process.env.RITUAL_WALLET_ADDRESS ?? "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948"
) as Address;
export const RITUAL_LLM_WALLET_FUNDING_WEI = parsePositiveBigInt(
  process.env.RITUAL_LLM_WALLET_FUNDING_WEI,
  10_000_000_000_000_000n,
);
export const RITUAL_LLM_LOCK_DURATION = parsePositiveBigInt(
  process.env.RITUAL_LLM_LOCK_DURATION,
  50_000n,
);

export function txExplorerLink(txHash: string) {
  return `${RITUAL_EXPLORER_URL}/tx/${txHash}`;
}

export function addressExplorerLink(address: string) {
  return `${RITUAL_EXPLORER_URL}/address/${address}`;
}

function parsePositiveNumber(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parsePositiveBigInt(value: string | undefined, fallback: bigint) {
  if (!value) return fallback;
  try {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : fallback;
  } catch {
    return fallback;
  }
}
