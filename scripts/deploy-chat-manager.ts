import hardhat from "hardhat";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: false });

const { ethers } = hardhat;

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

  if (!executor) {
    throw new Error("Missing RITUAL_LLM_EXECUTOR_ADDRESS. Select a live LLM executor from TEEServiceRegistry.");
  }
  if (!ethers.isAddress(executor)) throw new Error("Invalid RITUAL_LLM_EXECUTOR_ADDRESS.");
  if (!ethers.isAddress(llmPrecompile)) throw new Error("Invalid RITUAL_LLM_PRECOMPILE_ADDRESS.");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Chain ID: ${network.chainId.toString()}`);
  console.log(`LLM precompile: ${llmPrecompile}`);
  console.log(`LLM executor: ${executor}`);

  const Manager = await ethers.getContractFactory("RitualChatManager");
  const manager = await Manager.deploy(llmPrecompile, executor);
  await manager.waitForDeployment();

  const managerAddress = await manager.getAddress();
  const deploymentTx = manager.deploymentTransaction();
  console.log(`CHAT_MANAGER_ADDRESS=${managerAddress}`);
  console.log(`Deployment tx: ${deploymentTx?.hash ?? "unknown"}`);

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
