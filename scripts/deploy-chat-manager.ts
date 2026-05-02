import hardhat from "hardhat";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: false });

const { ethers } = hardhat;

const DEFAULT_LLM_MODEL = "zai-org/GLM-4.7-FP8";
const DEFAULT_LLM_TTL = 300n;
const DEFAULT_LLM_TEMPERATURE = 700n;
const DEFAULT_LLM_MAX_COMPLETION_TOKENS = 512n;
const DEFAULT_RITUAL_WALLET_ADDRESS = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948";
const DEFAULT_LLM_WALLET_LOCK_DURATION = 5000n;

function normalizePrecompileAddress(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (/^0x[0-9a-fA-F]{1,4}$/.test(trimmed)) {
    return `0x${trimmed.slice(2).padStart(40, "0")}`;
  }
  return trimmed;
}

function readPrivateKey() {
  const key = process.env.DEPLOYER_PRIVATE_KEY ?? process.env.RELAYER_PRIVATE_KEY;
  if (!key) throw new Error("Missing DEPLOYER_PRIVATE_KEY or RELAYER_PRIVATE_KEY.");
  return key;
}

async function main() {
  const rpcUrl = process.env.RITUAL_RPC_URL;
  if (!rpcUrl) throw new Error("Missing RITUAL_RPC_URL.");

  const provider = new ethers.JsonRpcProvider(rpcUrl, 1979);
  const deployer = new ethers.Wallet(readPrivateKey(), provider);
  const chainId = (await provider.getNetwork()).chainId;
  const feeData = await provider.getFeeData();
  const maxFeePerGas = feeData.maxFeePerGas ?? feeData.gasPrice;
  const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas ?? (maxFeePerGas ? maxFeePerGas / 10n : null);
  if (!maxFeePerGas || !maxPriorityFeePerGas) throw new Error("Ritual RPC did not return EIP-1559 fee data.");

  const llmPrecompile = normalizePrecompileAddress(
    process.env.RITUAL_LLM_PRECOMPILE_ADDRESS,
    "0x0000000000000000000000000000000000000802",
  );
  const executor = process.env.RITUAL_LLM_EXECUTOR_ADDRESS?.trim();
  const factoryAddress = process.env.AA_FACTORY_ADDRESS?.trim();
  const model = process.env.RITUAL_LLM_MODEL?.trim() || DEFAULT_LLM_MODEL;
  const requestedTtl = BigInt(process.env.RITUAL_LLM_TTL || DEFAULT_LLM_TTL.toString());
  const ttl = requestedTtl < DEFAULT_LLM_TTL ? DEFAULT_LLM_TTL : requestedTtl;
  const temperature = BigInt(process.env.RITUAL_LLM_TEMPERATURE || DEFAULT_LLM_TEMPERATURE.toString());
  const maxCompletionTokens = BigInt(
    process.env.RITUAL_LLM_MAX_COMPLETION_TOKENS || DEFAULT_LLM_MAX_COMPLETION_TOKENS.toString(),
  );
  const convoHistoryEnabled = process.env.RITUAL_LLM_CONVO_HISTORY_ENABLED === "true";
  const convoHistoryProvider = convoHistoryEnabled ? process.env.RITUAL_LLM_CONVO_HISTORY_PROVIDER?.trim() : "";
  const convoHistoryPath = convoHistoryEnabled ? process.env.RITUAL_LLM_CONVO_HISTORY_PATH?.trim() : "";
  const convoHistoryKeyRef = convoHistoryEnabled ? process.env.RITUAL_LLM_CONVO_HISTORY_KEY_REF?.trim() : "";
  const ritualWalletAddress = process.env.RITUAL_WALLET_ADDRESS?.trim() || DEFAULT_RITUAL_WALLET_ADDRESS;
  const walletFundingWei = BigInt(process.env.RITUAL_LLM_WALLET_FUNDING_WEI || "0");
  const walletLockDuration = BigInt(process.env.RITUAL_LLM_LOCK_DURATION || DEFAULT_LLM_WALLET_LOCK_DURATION.toString());

  if (!executor) throw new Error("Missing RITUAL_LLM_EXECUTOR_ADDRESS. Select a live LLM executor from TEEServiceRegistry.");
  if (!ethers.isAddress(executor)) throw new Error("Invalid RITUAL_LLM_EXECUTOR_ADDRESS.");
  if (!ethers.isAddress(llmPrecompile)) throw new Error("Invalid RITUAL_LLM_PRECOMPILE_ADDRESS.");
  if (!model) throw new Error("Missing RITUAL_LLM_MODEL.");
  if (maxCompletionTokens <= 0n) throw new Error("RITUAL_LLM_MAX_COMPLETION_TOKENS must be positive.");
  const hasAnyConvoHistory = Boolean(convoHistoryProvider || convoHistoryPath || convoHistoryKeyRef);
  const hasCompleteConvoHistory = Boolean(convoHistoryProvider && convoHistoryPath && convoHistoryKeyRef);
  if (hasAnyConvoHistory && !hasCompleteConvoHistory) {
    throw new Error("Ritual LLM convoHistory config is incomplete. Set all three convoHistory vars or disable it.");
  }
  if (!ethers.isAddress(ritualWalletAddress)) throw new Error("Invalid RITUAL_WALLET_ADDRESS.");

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Chain ID: ${chainId.toString()}`);
  console.log(`Deploy nonce: ${await provider.getTransactionCount(deployer.address, "pending")}`);
  console.log(`LLM precompile: ${llmPrecompile}`);
  console.log(`LLM executor: ${executor}`);
  console.log(`LLM model: ${model}`);
  console.log(`LLM TTL: ${ttl.toString()} blocks`);
  console.log(`LLM temperature: ${temperature.toString()}`);
  console.log(`LLM max completion tokens: ${maxCompletionTokens.toString()}`);
  console.log(
    hasCompleteConvoHistory
      ? `LLM convoHistory: ${convoHistoryProvider}:${convoHistoryPath} (${convoHistoryKeyRef})`
      : "LLM convoHistory: disabled for simple v1 chat",
  );

  const Manager = await ethers.getContractFactory("RitualChatManager", deployer);
  const deployTx = await Manager.getDeployTransaction(
    llmPrecompile,
    executor,
    model,
    ttl,
    temperature,
    maxCompletionTokens,
    {
      platform: convoHistoryProvider ?? "",
      path: convoHistoryPath ?? "",
      keyRef: convoHistoryKeyRef ?? "",
    },
  );
  const deployGas = await provider.estimateGas({ ...deployTx, from: deployer.address });
  const deploymentTx = await deployer.sendTransaction({
    ...deployTx,
    gasLimit: deployGas + deployGas / 5n,
    maxFeePerGas: maxFeePerGas * 2n,
    maxPriorityFeePerGas,
  });

  console.log(`Deployment tx: ${deploymentTx.hash}`);
  const deploymentReceipt = await deploymentTx.wait();
  if (!deploymentReceipt || deploymentReceipt.status !== 1 || !deploymentReceipt.contractAddress) {
    throw new Error("RitualChatManager deployment failed.");
  }

  const managerAddress = deploymentReceipt.contractAddress;
  console.log(`CHAT_MANAGER_ADDRESS=${managerAddress}`);

  if (walletFundingWei > 0n) {
    const walletAbi = [
      "function depositFor(address user, uint256 lockDuration) payable",
      "function balanceOf(address account) view returns (uint256)",
      "function lockUntil(address account) view returns (uint256)",
    ];
    const ritualWallet = new ethers.Contract(ritualWalletAddress, walletAbi, deployer);
    const fundRitualWalletAccount = async (accountAddress: string, label: string) => {
      const fundingTx = await ritualWallet.depositFor(accountAddress, walletLockDuration, {
        value: walletFundingWei,
        maxFeePerGas: maxFeePerGas * 2n,
        maxPriorityFeePerGas,
      });
      console.log(`RitualWallet ${label} funding tx: ${fundingTx.hash}`);
      const fundingReceipt = await fundingTx.wait();
      if (!fundingReceipt || fundingReceipt.status !== 1) {
        throw new Error(`RitualWallet ${label} funding failed.`);
      }
      const [walletBalance, lockUntil] = await Promise.all([
        ritualWallet.balanceOf(accountAddress),
        ritualWallet.lockUntil(accountAddress),
      ]);
      console.log(`RitualWallet balance for ${label}: ${walletBalance.toString()} wei`);
      console.log(`RitualWallet lockUntil for ${label}: ${lockUntil.toString()}`);
    };

    await fundRitualWalletAccount(managerAddress, "ChatManager");
    if (process.env.RELAYER_PRIVATE_KEY) {
      const sessionExecutor = new ethers.Wallet(process.env.RELAYER_PRIVATE_KEY).address;
      if (sessionExecutor.toLowerCase() !== managerAddress.toLowerCase()) {
        await fundRitualWalletAccount(sessionExecutor, "session executor");
      }
    }
  } else {
    console.log("RITUAL_LLM_WALLET_FUNDING_WEI is 0. Fund RitualWallet for CHAT_MANAGER_ADDRESS and the session executor before live chat.");
  }

  if (factoryAddress && ethers.isAddress(factoryAddress)) {
    const factory = new ethers.Contract(
      factoryAddress,
      [
        "function isApprovedChatTarget(address target) view returns (bool)",
        "function setApprovedChatTarget(address target, bool approved)",
      ],
      deployer,
    );
    if (await factory.isApprovedChatTarget(managerAddress)) {
      console.log("RitualChatManager was already approved as chat target.");
    } else {
      const approvalTx = await factory.setApprovedChatTarget(managerAddress, true, {
        maxFeePerGas: maxFeePerGas * 2n,
        maxPriorityFeePerGas,
      });
      console.log(`Allowlist tx: ${approvalTx.hash}`);
      const approvalReceipt = await approvalTx.wait();
      if (!approvalReceipt || approvalReceipt.status !== 1) {
        throw new Error("Chat target allowlist transaction failed.");
      }
      console.log("RitualChatManager approved as chat target.");
    }
  } else {
    console.log("AA_FACTORY_ADDRESS not set. Approve CHAT_MANAGER_ADDRESS on the factory before using chat.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
