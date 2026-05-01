import { isAddress, type Address } from "viem";
import { RELAYER_PRIVATE_KEY, SESSION_KEY_TTL_HOURS } from "@/lib/config";
import {
  buildSetSessionKeyCall,
  getSmartAccountOwner,
  getSessionExecutorAccount,
  ritualChatSmartAccountAbi,
} from "@/lib/ritual/aa/realAAProvider";
import { getPublicClient } from "@/lib/ritual/chain";
import { createOrLoadSmartAccount, getSmartAccountAddress } from "@/lib/ritual/smartAccount";

export interface SessionAuthorizationPreflight {
  walletAddress: Address;
  smartAccountAddress: Address;
  smartAccountCodeExists: boolean;
  smartAccountOwner: Address | null;
  expectedSessionKeyAddress: Address;
  sessionKeyExpiresAt: string;
  expiresAt: string;
  expiresAtSeconds: bigint;
  isOwner: boolean;
  canSimulateSetSessionKey: boolean;
  simulationError: string | null;
  txRequest: {
    to: Address;
    data: `0x${string}`;
    value: "0";
  } | null;
}

export async function prepareSessionAuthorization(params: {
  walletAddress: Address;
  createIfMissing: boolean;
}): Promise<SessionAuthorizationPreflight> {
  if (!isAddress(params.walletAddress)) throw new Error("Invalid EVM wallet address.");
  if (!RELAYER_PRIVATE_KEY) throw new Error("Missing RELAYER_PRIVATE_KEY. Cannot create session key.");

  const publicClient = getPublicClient();
  const smartAccountAddress = params.createIfMissing
    ? (await createOrLoadSmartAccount({ userWallet: params.walletAddress })).smartAccountAddress
    : await getSmartAccountAddress(params.walletAddress);

  const smartAccountCode = await publicClient.getCode({ address: smartAccountAddress });
  const smartAccountCodeExists = Boolean(smartAccountCode && smartAccountCode !== "0x");
  if (!smartAccountCodeExists) {
    throw new Error("Smart account has no code on Ritual Testnet.");
  }

  const smartAccountOwner = await getSmartAccountOwner(smartAccountAddress);
  const isOwner = smartAccountOwner.toLowerCase() === params.walletAddress.toLowerCase();
  if (!isOwner) {
    throw new Error("Connected wallet is not the owner of this smart account.");
  }
  const ownerBalance = await publicClient.getBalance({ address: params.walletAddress });
  if (ownerBalance === 0n) {
    throw new Error("Connected wallet needs Ritual testnet gas to authorize the session.");
  }

  const sessionExecutor = getSessionExecutorAccount();
  if (!isAddress(sessionExecutor.address)) {
    throw new Error("Invalid session key or expiry.");
  }

  const { expiry, expiresAtSeconds } = await getChainSessionKeyExpiry(publicClient);
  const latestBlock = await publicClient.getBlock();
  if (expiresAtSeconds <= latestBlock.timestamp) {
    throw new Error("Invalid session key or expiry.");
  }

  const data = buildSetSessionKeyCall(sessionExecutor.address, expiresAtSeconds);
  try {
    await publicClient.simulateContract({
      address: smartAccountAddress,
      abi: ritualChatSmartAccountAbi,
      functionName: "setSessionKey",
      args: [sessionExecutor.address, expiresAtSeconds],
      account: params.walletAddress,
    });
    await publicClient.estimateContractGas({
      address: smartAccountAddress,
      abi: ritualChatSmartAccountAbi,
      functionName: "setSessionKey",
      args: [sessionExecutor.address, expiresAtSeconds],
      account: params.walletAddress,
    });
  } catch (err) {
    throw new Error(mapSessionAuthorizationSimulationError(err));
  }

  return {
    walletAddress: params.walletAddress,
    smartAccountAddress,
    smartAccountCodeExists,
    smartAccountOwner,
    expectedSessionKeyAddress: sessionExecutor.address,
    sessionKeyExpiresAt: expiry.toISOString(),
    expiresAt: expiry.toISOString(),
    expiresAtSeconds,
    isOwner,
    canSimulateSetSessionKey: true,
    simulationError: null,
    txRequest: {
      to: smartAccountAddress,
      data,
      value: "0",
    },
  };
}

export async function inspectSessionAuthorization(walletAddress: Address): Promise<SessionAuthorizationPreflight> {
  const publicClient = getPublicClient();
  const base = (): SessionAuthorizationPreflight => ({
    walletAddress,
    smartAccountAddress: "0x0000000000000000000000000000000000000000",
    smartAccountCodeExists: false,
    smartAccountOwner: null,
    expectedSessionKeyAddress: "0x0000000000000000000000000000000000000000",
    sessionKeyExpiresAt: "",
    expiresAt: "",
    expiresAtSeconds: 0n,
    isOwner: false,
    canSimulateSetSessionKey: false,
    simulationError: null,
    txRequest: null,
  });

  try {
    const smartAccountAddress = await getSmartAccountAddress(walletAddress);
    const smartAccountCode = await publicClient.getCode({ address: smartAccountAddress });
    const smartAccountCodeExists = Boolean(smartAccountCode && smartAccountCode !== "0x");
    let smartAccountOwner: Address | null = null;
    if (smartAccountCodeExists) {
      smartAccountOwner = await getSmartAccountOwner(smartAccountAddress);
    }

    let expectedSessionKeyAddress: Address = "0x0000000000000000000000000000000000000000";
    let expiresAt = "";
    let expiresAtSeconds = 0n;
    let data: `0x${string}` | null = null;
    if (RELAYER_PRIVATE_KEY) {
      const sessionExecutor = getSessionExecutorAccount();
      expectedSessionKeyAddress = sessionExecutor.address;
      const expiryResult = await getChainSessionKeyExpiry(publicClient);
      expiresAt = expiryResult.expiry.toISOString();
      expiresAtSeconds = expiryResult.expiresAtSeconds;
      data = buildSetSessionKeyCall(expectedSessionKeyAddress, expiresAtSeconds);
    }

    let canSimulateSetSessionKey = false;
    let simulationError: string | null = null;
    if (!smartAccountCodeExists) simulationError = "Smart account has no code on Ritual Testnet.";
    else if (!RELAYER_PRIVATE_KEY) simulationError = "Missing RELAYER_PRIVATE_KEY. Cannot create session key.";
    else if (!smartAccountOwner || smartAccountOwner.toLowerCase() !== walletAddress.toLowerCase()) {
      simulationError = "Connected wallet is not the owner of this smart account.";
    } else if (expiresAtSeconds <= (await publicClient.getBlock()).timestamp) {
      simulationError = "Invalid session key or expiry.";
    } else {
      const ownerBalance = await publicClient.getBalance({ address: walletAddress });
      if (ownerBalance === 0n) {
        simulationError = "Connected wallet needs Ritual testnet gas to authorize the session.";
      } else {
      try {
        await publicClient.simulateContract({
          address: smartAccountAddress,
          abi: ritualChatSmartAccountAbi,
          functionName: "setSessionKey",
          args: [expectedSessionKeyAddress, expiresAtSeconds],
          account: walletAddress,
        });
        await publicClient.estimateContractGas({
          address: smartAccountAddress,
          abi: ritualChatSmartAccountAbi,
          functionName: "setSessionKey",
          args: [expectedSessionKeyAddress, expiresAtSeconds],
          account: walletAddress,
        });
        canSimulateSetSessionKey = true;
      } catch (err) {
        simulationError = mapSessionAuthorizationSimulationError(err);
      }
      }
    }

    return {
      walletAddress,
      smartAccountAddress,
      smartAccountCodeExists,
      smartAccountOwner,
      expectedSessionKeyAddress,
      sessionKeyExpiresAt: expiresAt,
      expiresAt,
      expiresAtSeconds,
      isOwner: Boolean(smartAccountOwner && smartAccountOwner.toLowerCase() === walletAddress.toLowerCase()),
      canSimulateSetSessionKey,
      simulationError,
      txRequest: canSimulateSetSessionKey && data ? { to: smartAccountAddress, data, value: "0" } : null,
    };
  } catch (err) {
    return {
      ...base(),
      walletAddress,
      simulationError: err instanceof Error ? err.message : "Session authorization would revert. Check owner, network, session key, and expiry.",
    };
  }
}

function mapSessionAuthorizationSimulationError(err: unknown) {
  const text = collectErrorText(err);
  const lower = text.toLowerCase();
  if (text.includes("NotOwner") || lower.includes("notowner")) {
    return "Connected wallet is not the smart account owner.";
  }
  if (text.includes("InvalidAddress") || lower.includes("invalidaddress")) {
    return "Invalid session key or expiry.";
  }
  if (lower.includes("insufficient funds") || lower.includes("insufficient balance")) {
    return "Connected wallet needs Ritual testnet gas to authorize the session.";
  }
  if (lower.includes("gas required exceeds allowance") || lower.includes("out of gas")) {
    return "Session authorization needs more gas. Let MetaMask estimate gas and try again.";
  }
  return "Session authorization would revert. Check owner, network, session key, and expiry.";
}

async function getChainSessionKeyExpiry(publicClient: ReturnType<typeof getPublicClient>) {
  const latestBlock = await publicClient.getBlock();
  const ttlSeconds = BigInt(Math.ceil(SESSION_KEY_TTL_HOURS * 60 * 60));
  const expiresAtSeconds = latestBlock.timestamp + ttlSeconds;
  return {
    expiresAtSeconds,
    expiry: new Date(Number(expiresAtSeconds) * 1000),
  };
}

function collectErrorText(err: unknown): string {
  if (!err || typeof err !== "object") return String(err ?? "");
  const record = err as Record<string, unknown>;
  return [
    record.message,
    record.shortMessage,
    record.details,
    record.cause,
  ].map((value) => typeof value === "string" ? value : collectErrorText(value))
    .join(" ");
}
