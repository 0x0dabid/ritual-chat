import hardhat from "hardhat";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: false });

const { ethers } = hardhat;

const DEFAULT_RITUAL_WALLET_ADDRESS = "0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948";
const DEFAULT_LLM_LOCK_DURATION = 10_000n;

function normalizePrecompileAddress(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  if (/^0x[0-9a-fA-F]{1,4}$/.test(value)) {
    return `0x${value.slice(2).padStart(40, "0")}`;
  }
  return value;
}

async function main() {
  const llmPrecompile = normalizePrecompileAddress(
    process.env.RITUAL_LLM_PRECOMPILE_ADDRESS,
    "0x0000000000000000000000000000000000000802",
  );
  const executor = process.env.RITUAL_LLM_EXECUTOR_ADDRESS;
  const factoryAddress = process.env.AA_FACTORY_ADDRESS;
  const ritualWallet = process.env.RITUAL_WALLET_ADDRESS ?? DEFAULT_RITUAL_WALLET_ADDRESS;
  const lockDuration = BigInt(process.env.RITUAL_LLM_LOCK_DURATION ?? DEFAULT_LLM_LOCK_DURATION.toString());
  const fundingWei = BigInt(process.env.RITUAL_LLM_WALLET_FUNDING_WEI ?? "0");

  if (!executor) {
    throw new Error("Missing RITUAL_LLM_EXECUTOR_ADDRESS. Select a live LLM executor from TEEServiceRegistry.");
  }
  if (!ethers.isAddress(executor)) throw new Error("Invalid RITUAL_LLM_EXECUTOR_ADDRESS.");
  if (!ethers.isAddress(llmPrecompile)) throw new Error("Invalid RITUAL_LLM_PRECOMPILE_ADDRESS.");
  if (!ethers.isAddress(ritualWallet)) throw new Error("Invalid RITUAL_WALLET_ADDRESS.");
  if (lockDuration <= 0n) throw new Error("RITUAL_LLM_LOCK_DURATION must be greater than zero.");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Chain ID: ${network.chainId.toString()}`);
  console.log(`LLM precompile: ${llmPrecompile}`);
  console.log(`LLM executor: ${executor}`);
  console.log(`RitualWallet: ${ritualWallet}`);
  console.log(`LLM lock duration: ${lockDuration.toString()} blocks`);

  const Manager = await ethers.getContractFactory("RitualChatManager");
  const manager = await Manager.deploy(llmPrecompile, executor, ritualWallet, lockDuration);
  await manager.waitForDeployment();

  const managerAddress = await manager.getAddress();
  const deploymentTx = manager.deploymentTransaction();
  console.log(`CHAT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`Deployment tx: ${deploymentTx?.hash ?? "unknown"}`);

  if (fundingWei > 0n) {
    const lockTx = await manager.refreshLlmWalletLock({ value: fundingWei });
    console.log(`RitualWallet lock tx: ${lockTx.hash}`);
    await lockTx.wait();
    console.log(`Locked ${fundingWei.toString()} wei for RitualChatManager async LLM calls.`);
  } else {
    console.log("RITUAL_LLM_WALLET_FUNDING_WEI not set. Fund/lock the ChatManager before sending LLM chat transactions.");
  }

  if (factoryAddress && ethers.isAddress(factoryAddress)) {
    const factory = await ethers.getContractAt("RitualChatSmartAccountFactory", factoryAddress);
    const tx = await factory.setApprovedChatTarget(managerAddress, true);
    console.log(`Allowlist tx: ${tx.hash}`);
    await tx.wait();
    console.log("RitualChatManager approved as chat target.");
  } else {
    console.log("AA_FACTORY_ADDRESS not set. Approve CHAT_MANAGER_ADDRESS on the factory before using chat.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
