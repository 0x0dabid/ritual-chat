import {
  encodeAbiParameters,
  encodeFunctionData,
  isAddress,
  keccak256,
  parseAbi,
  parseAbiParameters,
  parseEventLogs,
  toBytes,
  toFunctionSelector,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import {
  addressExplorerLink,
  MOCK_MODE,
  PERSISTENT_AGENT_DA_KEY_REF,
  PERSISTENT_AGENT_DA_PATH,
  PERSISTENT_AGENT_DA_PROVIDER,
  PERSISTENT_AGENT_DKMS_FUNDING_WEI,
  PERSISTENT_AGENT_ENCRYPTED_SECRETS,
  PERSISTENT_AGENT_EXECUTOR_ADDRESS,
  PERSISTENT_AGENT_FACTORY_ADDRESS,
  PERSISTENT_AGENT_LLM_API_KEY_REF,
  PERSISTENT_AGENT_LLM_PROVIDER,
  PERSISTENT_AGENT_MAX_FEE_PER_GAS,
  PERSISTENT_AGENT_MAX_PRIORITY_FEE_PER_GAS,
  PERSISTENT_AGENT_MODEL,
  PERSISTENT_AGENT_SCHEDULER_FUNDING_WEI,
  PERSISTENT_AGENT_SCHEDULER_GAS,
  PERSISTENT_AGENT_SCHEDULER_LOCK_DURATION,
  PERSISTENT_AGENT_SCHEDULER_TTL,
  RITUAL_RPC_URL,
} from "@/lib/config";
import { mockAddress } from "@/lib/mock";
import { getPublicClient } from "@/lib/ritual/chain";
import type { AgentSession, IntegrationStatus } from "@/lib/types";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

const LLM_PROVIDER = {
  anthropic: 0,
  openai: 1,
  gemini: 2,
  xai: 3,
  openrouter: 4,
} as const;

export const persistentAgentFactoryAbi = parseAbi([
  "function predictLauncher(address owner, bytes32 userSalt) view returns (address launcher, bytes32 childSalt)",
  "function predictCompressedLauncher(address owner, bytes32 userSalt) view returns (address launcher, bytes32 compressedSalt, bytes32 childSalt)",
  "function getDkmsDerivation(address owner, bytes32 userSalt) view returns (address dkmsOwner, uint256 keyIndex, uint8 keyFormat)",
  "function deployLauncher(bytes32 userSalt) returns (address launcher)",
  "function launchPersistentCompressed(bytes32 userSalt, address executor, uint64 dkmsTtl, uint256 dkmsFunding, bytes persistentInput, (uint32 schedulerGas, uint32 schedulerTtl, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, uint256 value) schedule, uint256 schedulerLockDuration, uint256 schedulerFunding) payable returns (address launcher, address dkmsPaymentAddress, uint256 callId)",
  "function launchPersistentWithDerivedDkms(bytes32 userSalt, address dkmsPaymentAddress, uint256 dkmsFunding, bytes persistentInput, (uint32 schedulerGas, uint32 schedulerTtl, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, uint256 value) schedule, uint256 schedulerLockDuration, uint256 schedulerFunding) payable returns (address launcher, uint256 callId)",
  "event LauncherDeployed(address indexed owner, bytes32 indexed userSalt, bytes32 indexed childSalt, address launcher)",
  "event PersistentLaunchCompressed(address indexed owner, bytes32 indexed userSalt, address indexed launcher, address dkmsPaymentAddress, uint256 schedulerCallId)",
  "event PersistentLaunchFromDerivedDkms(address indexed owner, bytes32 indexed userSalt, address indexed launcher, address dkmsPaymentAddress, uint256 schedulerCallId)",
]);

export interface PersistentAgentResult {
  persistentAgentAddress: Address;
  persistentAgentStatus: IntegrationStatus;
  persistentAgentCreateTxHash?: Hex;
  persistentAgentStatusMessage?: string;
  persistentAgentMissingConfig?: string[];
  createCall?: {
    target: Address;
    value: bigint;
    data: Hex;
    predictedLauncher: Address;
  };
}

export function isPersistentAgentConfigured() {
  return getPersistentAgentMissingConfig().length === 0;
}

export function getPersistentAgentMissingConfig(env: NodeJS.ProcessEnv = process.env) {
  const missing: string[] = [];
  const provider = env.PERSISTENT_AGENT_LLM_PROVIDER?.toLowerCase();

  if (!env.RITUAL_RPC_URL) missing.push("RITUAL_RPC_URL");
  if (!env.PERSISTENT_AGENT_FACTORY_ADDRESS) missing.push("PERSISTENT_AGENT_FACTORY_ADDRESS");
  if (!env.PERSISTENT_AGENT_EXECUTOR_ADDRESS) missing.push("PERSISTENT_AGENT_EXECUTOR_ADDRESS");
  if (!provider || !(provider in LLM_PROVIDER)) missing.push("PERSISTENT_AGENT_LLM_PROVIDER");
  if (!env.PERSISTENT_AGENT_MODEL) missing.push("PERSISTENT_AGENT_MODEL");
  if (!env.PERSISTENT_AGENT_LLM_API_KEY_REF) missing.push("PERSISTENT_AGENT_LLM_API_KEY_REF");
  if (!env.PERSISTENT_AGENT_DA_PROVIDER) missing.push("PERSISTENT_AGENT_DA_PROVIDER");
  if (!env.PERSISTENT_AGENT_DA_PATH) missing.push("PERSISTENT_AGENT_DA_PATH");
  if (!env.PERSISTENT_AGENT_DA_KEY_REF) missing.push("PERSISTENT_AGENT_DA_KEY_REF");
  if (!env.PERSISTENT_AGENT_ENCRYPTED_SECRETS) missing.push("PERSISTENT_AGENT_ENCRYPTED_SECRETS");
  if (!env.PERSISTENT_AGENT_DKMS_FUNDING_WEI) missing.push("PERSISTENT_AGENT_DKMS_FUNDING_WEI");
  if (!env.PERSISTENT_AGENT_SCHEDULER_FUNDING_WEI) missing.push("PERSISTENT_AGENT_SCHEDULER_FUNDING_WEI");
  if (!env.PERSISTENT_AGENT_SCHEDULER_LOCK_DURATION) missing.push("PERSISTENT_AGENT_SCHEDULER_LOCK_DURATION");

  return missing;
}

export async function createOrLoadPersistentAgent(params: {
  sessionId: string;
  smartAccountAddress: Address;
  existing?: AgentSession | null;
}): Promise<Address | PersistentAgentResult> {
  if (MOCK_MODE) {
    if (params.existing) return params.existing.persistentAgentAddress as Address;
    return mockAddress(`persistent-agent:${params.smartAccountAddress}`) as Address;
  }

  return createOrLoadRealPersistentAgent(params);
}

export async function createOrLoadRealPersistentAgent(params: {
  sessionId: string;
  smartAccountAddress: Address;
  existing?: AgentSession | null;
}): Promise<PersistentAgentResult> {
  if (params.existing?.persistentAgentStatus === "active" && isAddress(params.existing.persistentAgentAddress)) {
    return {
      persistentAgentAddress: params.existing.persistentAgentAddress as Address,
      persistentAgentStatus: "active",
      persistentAgentCreateTxHash: params.existing.persistentAgentCreateTxHash as Hex | undefined,
      persistentAgentStatusMessage: "Persistent Agent already active.",
    };
  }

  const publicClient = getPublicClient();
  const userSalt = sessionSalt(params.sessionId);
  const [launcher] = await publicClient.readContract({
    address: PERSISTENT_AGENT_FACTORY_ADDRESS,
    abi: persistentAgentFactoryAbi,
    functionName: "predictLauncher",
    args: [params.smartAccountAddress, userSalt],
  });
  const code = await publicClient.getCode({ address: launcher });

  if (code && code !== "0x") {
    return {
      persistentAgentAddress: launcher,
      persistentAgentStatus: "active",
      persistentAgentStatusMessage: "Persistent Agent launcher is deployed on Ritual Testnet.",
    };
  }

  const missingConfig = getPersistentAgentMissingConfig();
  if (missingConfig.length > 0) {
    return {
      persistentAgentAddress: ZERO_ADDRESS,
      persistentAgentStatus: "pending",
      persistentAgentMissingConfig: missingConfig,
      persistentAgentStatusMessage: "Persistent Agent config is incomplete. Add the required Ritual env vars to enable real agent creation.",
    };
  }

  const createCall = await buildPersistentAgentCreateCall({
    sessionId: params.sessionId,
    smartAccountAddress: params.smartAccountAddress,
  });

  return {
    persistentAgentAddress: ZERO_ADDRESS,
    persistentAgentStatus: "pending",
    persistentAgentMissingConfig: ["OWNER_AUTHORIZED_SMART_ACCOUNT_EXECUTION"],
    persistentAgentStatusMessage: "Persistent Agent config is ready, but owner-authorized smart account execution is not wired yet.",
    createCall,
  };
}

export async function getPersistentAgentStatus(params: {
  session: AgentSession;
}) {
  if (MOCK_MODE) {
    return {
      status: params.session.status,
      persistentAgentStatus: "active" as const,
      explorerLink: addressExplorerLink(params.session.persistentAgentAddress),
    };
  }

  const hasPersistentAgent = params.session.persistentAgentAddress !== ZERO_ADDRESS;
  return {
    status: params.session.status,
    persistentAgentStatus: params.session.persistentAgentStatus ?? (hasPersistentAgent ? "active" : "pending"),
    explorerLink: hasPersistentAgent ? addressExplorerLink(params.session.persistentAgentAddress) : undefined,
  };
}

export async function buildPersistentAgentCreateCall(params: {
  sessionId: string;
  smartAccountAddress: Address;
}) {
  const userSalt = sessionSalt(params.sessionId);
  const publicClient = getPublicClient();
  const [predictedLauncher] = await publicClient.readContract({
    address: PERSISTENT_AGENT_FACTORY_ADDRESS,
    abi: persistentAgentFactoryAbi,
    functionName: "predictCompressedLauncher",
    args: [params.smartAccountAddress, userSalt],
  });
  const persistentInput = buildPersistentAgentChatCall({
    executor: requiredAddress(PERSISTENT_AGENT_EXECUTOR_ADDRESS, "PERSISTENT_AGENT_EXECUTOR_ADDRESS"),
    deliveryTarget: predictedLauncher,
    provider: providerToEnum(PERSISTENT_AGENT_LLM_PROVIDER),
    model: requiredString(PERSISTENT_AGENT_MODEL, "PERSISTENT_AGENT_MODEL"),
    llmApiKeyRef: requiredString(PERSISTENT_AGENT_LLM_API_KEY_REF, "PERSISTENT_AGENT_LLM_API_KEY_REF"),
    daProvider: requiredString(PERSISTENT_AGENT_DA_PROVIDER, "PERSISTENT_AGENT_DA_PROVIDER"),
    daPath: requiredString(PERSISTENT_AGENT_DA_PATH, "PERSISTENT_AGENT_DA_PATH"),
    daKeyRef: requiredString(PERSISTENT_AGENT_DA_KEY_REF, "PERSISTENT_AGENT_DA_KEY_REF"),
    encryptedSecrets: [requiredHex(PERSISTENT_AGENT_ENCRYPTED_SECRETS, "PERSISTENT_AGENT_ENCRYPTED_SECRETS")],
    rpcUrl: requiredString(RITUAL_RPC_URL, "RITUAL_RPC_URL"),
  });
  const dkmsFunding = requiredBigInt(PERSISTENT_AGENT_DKMS_FUNDING_WEI, "PERSISTENT_AGENT_DKMS_FUNDING_WEI");
  const schedulerFunding = requiredBigInt(
    PERSISTENT_AGENT_SCHEDULER_FUNDING_WEI,
    "PERSISTENT_AGENT_SCHEDULER_FUNDING_WEI",
  );
  const schedule = {
    schedulerGas: Number(PERSISTENT_AGENT_SCHEDULER_GAS ?? "8000000"),
    schedulerTtl: Number(PERSISTENT_AGENT_SCHEDULER_TTL ?? "500"),
    maxFeePerGas: BigInt(PERSISTENT_AGENT_MAX_FEE_PER_GAS ?? "1000000000"),
    maxPriorityFeePerGas: BigInt(PERSISTENT_AGENT_MAX_PRIORITY_FEE_PER_GAS ?? "100000000"),
    value: 0n,
  };

  const data = encodeFunctionData({
    abi: persistentAgentFactoryAbi,
    functionName: "launchPersistentCompressed",
    args: [
      userSalt,
      requiredAddress(PERSISTENT_AGENT_EXECUTOR_ADDRESS, "PERSISTENT_AGENT_EXECUTOR_ADDRESS"),
      300n,
      dkmsFunding,
      persistentInput,
      schedule,
      requiredBigInt(PERSISTENT_AGENT_SCHEDULER_LOCK_DURATION, "PERSISTENT_AGENT_SCHEDULER_LOCK_DURATION"),
      schedulerFunding,
    ],
  });

  return {
    target: PERSISTENT_AGENT_FACTORY_ADDRESS,
    value: dkmsFunding + schedulerFunding,
    data,
    predictedLauncher,
  };
}

export function parsePersistentAgentEvents(receipt: TransactionReceipt) {
  const logs = parseEventLogs({
    abi: persistentAgentFactoryAbi,
    logs: receipt.logs,
    strict: false,
  });

  const launcher = logs.find((log) => (
    log.eventName === "LauncherDeployed"
    || log.eventName === "PersistentLaunchCompressed"
    || log.eventName === "PersistentLaunchFromDerivedDkms"
  ));

  return {
    launcherAddress: launcher?.args.launcher as Address | undefined,
    events: logs,
  };
}

export function buildPersistentAgentChatCall(params: {
  executor: Address;
  deliveryTarget: Address;
  provider: number;
  model: string;
  llmApiKeyRef: string;
  daProvider: string;
  daPath: string;
  daKeyRef: string;
  encryptedSecrets?: Hex[];
  rpcUrl: string;
}) {
  // Confirmed from latest ritual-dapp-skills on 2026-05-01:
  // Persistent Agent precompile 0x0820 accepts a 26-field ABI payload.
  // The PersistentAgentFactory compressed flow must set deliveryTarget to
  // predictCompressedLauncher(msg.sender, userSalt).
  return encodeAbiParameters(
    parseAbiParameters([
      "address, bytes[], uint256, bytes[], bytes,",
      "uint64, address, bytes4, uint256, uint256, uint256, uint256,",
      "uint8, string, string,",
      "(string,string,string), (string,string,string),",
      "(string,string,string), (string,string,string),",
      "(string,string,string), (string,string,string),",
      "(string,string,string), (string,string,string),",
      "string, string, uint16",
    ].join("")),
    [
      params.executor,
      params.encryptedSecrets ?? [],
      300n,
      [],
      "0x",
      600n,
      params.deliveryTarget,
      toFunctionSelector("onPersistentAgentResult(bytes32,bytes)"),
      500_000n,
      1_000_000_000n,
      100_000_000n,
      0n,
      params.provider,
      params.model,
      params.llmApiKeyRef,
      [params.daProvider, `${params.daPath}/manifest.json`, params.daKeyRef],
      [params.daProvider, `${params.daPath}/SOUL.md`, params.daKeyRef],
      ["", "", ""],
      ["", "", ""],
      [params.daProvider, `${params.daPath}/MEMORY.md`, params.daKeyRef],
      [params.daProvider, `${params.daPath}/IDENTITY.md`, params.daKeyRef],
      [params.daProvider, `${params.daPath}/TOOLS.md`, params.daKeyRef],
      ["", "", ""],
      "",
      JSON.stringify({ ritual: params.rpcUrl }),
      0,
    ],
  );
}

function sessionSalt(sessionId: string): Hex {
  return keccak256(toBytes(`ritual-chat:${sessionId}`));
}

function providerToEnum(provider: string | undefined) {
  const normalized = provider?.toLowerCase();
  if (!normalized || !(normalized in LLM_PROVIDER)) {
    throw new Error("Persistent Agent config is incomplete. Set PERSISTENT_AGENT_LLM_PROVIDER.");
  }
  return LLM_PROVIDER[normalized as keyof typeof LLM_PROVIDER];
}

function requiredString(value: string | undefined, name: string) {
  if (!value) throw new Error(`Persistent Agent config is incomplete. Missing ${name}.`);
  return value;
}

function requiredHex(value: Hex | undefined, name: string) {
  if (!value) throw new Error(`Persistent Agent config is incomplete. Missing ${name}.`);
  return value;
}

function requiredAddress(value: Address | undefined, name: string) {
  if (!value || !isAddress(value)) {
    throw new Error(`Persistent Agent config is incomplete. Missing ${name}.`);
  }
  return value;
}

function requiredBigInt(value: string | undefined, name: string) {
  if (!value) throw new Error(`Persistent Agent config is incomplete. Missing ${name}.`);
  return BigInt(value);
}
