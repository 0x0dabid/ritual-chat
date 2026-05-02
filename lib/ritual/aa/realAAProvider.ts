import { createWalletClient, encodeFunctionData, http, isAddress, parseAbi, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ethers } from "ethers";
import {
  AA_BUNDLER_RPC_URL,
  AA_ENTRYPOINT_ADDRESS,
  AA_FACTORY_ADDRESS,
  AA_PAYMASTER_RPC_URL,
  AA_PROVIDER_KIND,
  AA_SESSION_KEY_MODULE_ADDRESS,
  CHAT_MANAGER_ADDRESS,
  DEPLOYER_PRIVATE_KEY,
  RELAYER_PRIVATE_KEY,
  RITUAL_RPC_URL,
  SESSION_KEY_TTL_HOURS,
} from "@/lib/config";
import { getPublicClient, ritualChain } from "@/lib/ritual/chain";
import type {
  AAProviderAdapter,
  SessionKeyResult,
  SmartAccountResult,
  UserOperationOrTx,
  UserOperationOrTxRequest,
} from "@/lib/ritual/aa/types";

const NOT_READY = "Real AA provider is not configured yet.";

export const ritualChatSmartAccountFactoryAbi = parseAbi([
  "function getAccountAddress(address owner) view returns (address)",
  "function createAccount(address owner) returns (address account)",
  "function isApprovedChatTarget(address target) view returns (bool)",
  "event AccountCreated(address indexed owner, address indexed account)",
]);

export const ritualChatSmartAccountAbi = parseAbi([
  "error AlreadyInitialized()",
  "error InvalidAddress()",
  "error NotOwner()",
  "error NotFactory()",
  "error NotAuthorizedForChat()",
  "error TargetNotAllowed()",
  "error CallFailed(bytes result)",
  "function owner() view returns (address)",
  "function sessionKey() view returns (address)",
  "function sessionKeyExpiresAt() view returns (uint256)",
  "function setSessionKey(address sessionKey, uint256 expiresAt)",
  "function isValidSessionKey(address sessionKey) view returns (bool)",
  "function executeChatCall(address target, bytes data) returns (bytes result)",
]);

export class RealAAProviderAdapter implements AAProviderAdapter {
  getProviderName() {
    return "RealAAProviderAdapter";
  }

  isConfigured() {
    if (AA_PROVIDER_KIND === "custom" || AA_PROVIDER_KIND === "custom-factory") {
      return Boolean(AA_FACTORY_ADDRESS && isAddress(AA_FACTORY_ADDRESS));
    }

    if (AA_PROVIDER_KIND === "erc4337") {
      return Boolean(
        AA_FACTORY_ADDRESS &&
        isAddress(AA_FACTORY_ADDRESS) &&
        AA_ENTRYPOINT_ADDRESS &&
        isAddress(AA_ENTRYPOINT_ADDRESS) &&
        AA_BUNDLER_RPC_URL,
      );
    }

    if (AA_PROVIDER_KIND === "eip7702") {
      return Boolean(AA_SESSION_KEY_MODULE_ADDRESS && isAddress(AA_SESSION_KEY_MODULE_ADDRESS));
    }

    return false;
  }

  async createOrLoadSmartAccount(walletAddress: Address): Promise<SmartAccountResult> {
    this.assertConfigured();
    const smartAccountAddress = await this.getSmartAccountAddress(walletAddress);
    const code = await getPublicClient().getCode({ address: smartAccountAddress });

    if (code && code !== "0x") {
      return { smartAccountAddress };
    }

    const signerPrivateKey = DEPLOYER_PRIVATE_KEY ?? RELAYER_PRIVATE_KEY;
    if (!signerPrivateKey) {
      throw new Error("Real AA provider is not configured yet. Missing: DEPLOYER_PRIVATE_KEY or RELAYER_PRIVATE_KEY.");
    }
    if (!RITUAL_RPC_URL) {
      throw new Error("Real AA provider is not configured yet. Missing: RITUAL_RPC_URL.");
    }

    const account = privateKeyToAccount(signerPrivateKey);
    const walletClient = createWalletClient({
      account,
      chain: ritualChain,
      transport: http(RITUAL_RPC_URL),
    });

    const deploymentTxHash = await walletClient.writeContract({
      address: AA_FACTORY_ADDRESS!,
      abi: ritualChatSmartAccountFactoryAbi,
      functionName: "createAccount",
      args: [walletAddress],
    });

    const receipt = await getPublicClient().waitForTransactionReceipt({ hash: deploymentTxHash });
    if (receipt.status !== "success") {
      throw new Error("Smart account creation failed on Ritual Testnet.");
    }

    const deployedCode = await getPublicClient().getCode({ address: smartAccountAddress });
    if (!deployedCode || deployedCode === "0x") {
      throw new Error("Smart account creation transaction confirmed, but no account code was found.");
    }

    return { smartAccountAddress, deploymentTxHash };
  }

  async getSmartAccountAddress(walletAddress: Address): Promise<Address> {
    this.assertConfigured();
    if (AA_PROVIDER_KIND === "custom" || AA_PROVIDER_KIND === "custom-factory") {
      return getPublicClient().readContract({
        address: AA_FACTORY_ADDRESS!,
        abi: ritualChatSmartAccountFactoryAbi,
        functionName: "getAccountAddress",
        args: [walletAddress],
      });
    }

    // TODO(real-aa): For ERC-4337 modes, call the selected factory's deterministic
    // address function. For EIP-7702, the smart account address may be the
    // connected EOA after delegation, but only after Ritual SetCodeTx support is
    // verified end-to-end.
    throw new Error("Real AA smart account address derivation is not implemented yet for this provider.");
  }

  async createSessionKey(walletAddress: Address, smartAccountAddress: Address): Promise<SessionKeyResult> {
    this.assertConfigured();
    void walletAddress;
    void smartAccountAddress;

    const account = getSessionExecutorAccount();
    return {
      sessionKeyAddress: account.address,
      sessionKeyExpiresAt: getSessionKeyExpiry().toISOString(),
    };
  }

  async validateSessionKey(sessionKeyAddress: Address, smartAccountAddress?: Address) {
    this.assertConfigured();
    if (!isAddress(sessionKeyAddress)) return false;
    if (!smartAccountAddress || !isAddress(smartAccountAddress)) return false;

    const [storedSessionKey, expiresAt, valid, latestBlock] = await Promise.all([
      getPublicClient().readContract({
        address: smartAccountAddress,
        abi: ritualChatSmartAccountAbi,
        functionName: "sessionKey",
      }),
      getPublicClient().readContract({
        address: smartAccountAddress,
        abi: ritualChatSmartAccountAbi,
        functionName: "sessionKeyExpiresAt",
      }),
      getPublicClient().readContract({
        address: smartAccountAddress,
        abi: ritualChatSmartAccountAbi,
        functionName: "isValidSessionKey",
        args: [sessionKeyAddress],
      }),
      getPublicClient().getBlock(),
    ]);

    return valid
      && storedSessionKey.toLowerCase() === sessionKeyAddress.toLowerCase()
      && expiresAt > latestBlock.timestamp;
  }

  async buildUserOperationOrTx(request: UserOperationOrTxRequest): Promise<UserOperationOrTx> {
    this.assertConfigured();
    const account = getSessionExecutorAccount();
    if (request.from.toLowerCase() !== account.address.toLowerCase()) {
      throw new Error("Authorized session key does not match the server-side session executor.");
    }
    if (request.value && request.value !== 0n) {
      throw new Error("Session key chat transactions cannot transfer value.");
    }
    if (!CHAT_MANAGER_ADDRESS || request.target.toLowerCase() !== CHAT_MANAGER_ADDRESS.toLowerCase()) {
      throw new Error("Session key can only submit approved RitualChatManager calls.");
    }
    if (!RITUAL_RPC_URL) {
      throw new Error("RPC unavailable. Set RITUAL_RPC_URL to submit chat transactions.");
    }

    const provider = new ethers.JsonRpcProvider(RITUAL_RPC_URL, Number(ritualChain.id));
    const signer = new ethers.Wallet(RELAYER_PRIVATE_KEY!, provider);
    const gasPrice = await getPublicClient().getGasPrice();

    const tx = await signer.sendTransaction({
      to: request.to,
      data: request.data,
      value: 0,
      gasLimit: 6_000_000n,
      gasPrice: gasPrice * 2n,
    });

    return {
      kind: "transaction",
      from: account.address,
      to: request.to,
      data: request.data,
      value: 0n,
      description: "Session-key chat transaction through RitualChatSmartAccount.executeChatCall.",
      txHash: tx.hash as `0x${string}`,
    };
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      const missing = getMissingConfiguration();
      throw new Error(missing.length ? `${NOT_READY} Missing: ${missing.join(", ")}.` : NOT_READY);
    }
  }
}

export function getSessionExecutorAccount() {
  const sessionPrivateKey = RELAYER_PRIVATE_KEY;
  if (!sessionPrivateKey) {
    throw new Error("Session key authorization is not configured. Missing RELAYER_PRIVATE_KEY.");
  }

  return privateKeyToAccount(sessionPrivateKey);
}

export function getSessionKeyExpiry() {
  return new Date(Date.now() + SESSION_KEY_TTL_HOURS * 60 * 60 * 1000);
}

export function buildSetSessionKeyCall(sessionKeyAddress: Address, expiresAt: bigint) {
  return encodeFunctionData({
    abi: ritualChatSmartAccountAbi,
    functionName: "setSessionKey",
    args: [sessionKeyAddress, expiresAt],
  });
}

export async function getSmartAccountOwner(smartAccountAddress: Address) {
  return getPublicClient().readContract({
    address: smartAccountAddress,
    abi: ritualChatSmartAccountAbi,
    functionName: "owner",
  });
}

export async function getSmartAccountSessionKeyState(params: {
  smartAccountAddress: Address;
  expectedSessionKeyAddress: Address;
}) {
  const [storedSessionKey, expiresAt, valid, latestBlock] = await Promise.all([
    getPublicClient().readContract({
      address: params.smartAccountAddress,
      abi: ritualChatSmartAccountAbi,
      functionName: "sessionKey",
    }),
    getPublicClient().readContract({
      address: params.smartAccountAddress,
      abi: ritualChatSmartAccountAbi,
      functionName: "sessionKeyExpiresAt",
    }),
    getPublicClient().readContract({
      address: params.smartAccountAddress,
      abi: ritualChatSmartAccountAbi,
      functionName: "isValidSessionKey",
      args: [params.expectedSessionKeyAddress],
    }),
    getPublicClient().getBlock(),
  ]);

  const zeroAddress = "0x0000000000000000000000000000000000000000";
  const matchesExpected = storedSessionKey.toLowerCase() === params.expectedSessionKeyAddress.toLowerCase();
  const isExpired = matchesExpected && expiresAt > 0n && expiresAt <= latestBlock.timestamp;

  return {
    storedSessionKey,
    sessionKeyAddress: matchesExpected ? storedSessionKey : zeroAddress,
    sessionKeyExpiresAt: expiresAt > 0n ? chainTimestampToDate(expiresAt).toISOString() : null,
    sessionKeyStatus: valid && matchesExpected ? "active" as const : isExpired ? "expired" as const : "pending" as const,
  };
}

function chainTimestampToDate(timestamp: bigint) {
  const value = Number(timestamp);
  return new Date(value > 1_000_000_000_000 ? value : value * 1000);
}

export async function isChatTargetApproved(target: Address) {
  if (!target || !isAddress(target)) return false;
  return getPublicClient().readContract({
    address: AA_FACTORY_ADDRESS!,
    abi: ritualChatSmartAccountFactoryAbi,
    functionName: "isApprovedChatTarget",
    args: [target],
  });
}

export function getMissingConfiguration() {
  if (AA_PROVIDER_KIND === "custom" || AA_PROVIDER_KIND === "custom-factory") {
    return !AA_FACTORY_ADDRESS || !isAddress(AA_FACTORY_ADDRESS) ? ["AA_FACTORY_ADDRESS"] : [];
  }

  if (AA_PROVIDER_KIND === "erc4337") {
    const missing: string[] = [];
    if (!AA_FACTORY_ADDRESS || !isAddress(AA_FACTORY_ADDRESS)) missing.push("AA_FACTORY_ADDRESS");
    if (!AA_ENTRYPOINT_ADDRESS || !isAddress(AA_ENTRYPOINT_ADDRESS)) missing.push("AA_ENTRYPOINT_ADDRESS");
    if (!AA_BUNDLER_RPC_URL) missing.push("AA_BUNDLER_RPC_URL");
    return missing;
  }

  if (AA_PROVIDER_KIND === "eip7702") {
    return !AA_SESSION_KEY_MODULE_ADDRESS || !isAddress(AA_SESSION_KEY_MODULE_ADDRESS)
      ? ["AA_SESSION_KEY_MODULE_ADDRESS"]
      : [];
  }

  return ["AA_PROVIDER_KIND"];
}

export function getAAProviderEnvironmentSummary() {
  return {
    providerKind: AA_PROVIDER_KIND,
    factoryConfigured: Boolean(AA_FACTORY_ADDRESS),
    entryPointConfigured: Boolean(AA_ENTRYPOINT_ADDRESS),
    bundlerConfigured: Boolean(AA_BUNDLER_RPC_URL),
    paymasterConfigured: Boolean(AA_PAYMASTER_RPC_URL),
    sessionKeyModuleConfigured: Boolean(AA_SESSION_KEY_MODULE_ADDRESS),
  };
}
