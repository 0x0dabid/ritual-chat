import {
  createWalletClient,
  formatEther,
  type Address,
  type Hash,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  MOCK_MODE,
  RELAYER_PRIVATE_KEY,
  RITUAL_LLM_PRECOMPILE_ADDRESS,
  RITUAL_RPC_URL,
} from "@/lib/config";
import { mockTxHash } from "@/lib/mock";
import { getPublicClient, ritualChain } from "@/lib/ritual/chain";

const APPROVED_TARGETS = new Set<string>([
  RITUAL_LLM_PRECOMPILE_ADDRESS.toLowerCase(),
]);

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

export async function submitRelayedTransaction(params: {
  target: Address;
  data: Hex;
  sessionKeyAddress: Address;
}) {
  if (!APPROVED_TARGETS.has(params.target.toLowerCase())) {
    throw new Error("Transaction failed. Contract target is not approved.");
  }

  if (MOCK_MODE) return mockTxHash(params.data);

  if (!RELAYER_PRIVATE_KEY || !RITUAL_RPC_URL) {
    throw new Error("Relayer unavailable. Check server configuration.");
  }

  await checkRelayerBalance();

  // TODO(real-aa): Route production submissions through the selected AA provider's
  // user-operation flow so the AA smart account is the sender. The relayer should
  // sponsor/submit only approved calls and must not become the agent owner.
  const account = privateKeyToAccount(RELAYER_PRIVATE_KEY);
  const walletClient = createWalletClient({
    account,
    chain: ritualChain,
    transport: (await import("viem")).http(RITUAL_RPC_URL),
  });

  return walletClient.sendTransaction({
    to: params.target,
    data: params.data,
    gas: 3_000_000n,
  });
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
  return {
    txHash: hash,
    status: receipt.status === "success" ? "confirmed" as const : "failed" as const,
    blockNumber: Number(receipt.blockNumber),
  };
}
