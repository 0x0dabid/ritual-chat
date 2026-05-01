import hardhat from "hardhat";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: false });

const { ethers } = hardhat;

const DEFAULT_LLM_MODEL = "zai-org/GLM-4.7-FP8";
const DEFAULT_LLM_TTL = 30n;
const DEFAULT_LLM_TEMPERATURE = 700n;

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
  const model = process.env.RITUAL_LLM_MODEL ?? DEFAULT_LLM_MODEL;
  const ttl = BigInt(process.env.RITUAL_LLM_TTL ?? DEFAULT_LLM_TTL.toString());
  const temperature = BigInt(process.env.RITUAL_LLM_TEMPERATURE ?? DEFAULT_LLM_TEMPERATURE.toString());
  const convoHistoryProvider = process.env.RITUAL_LLM_CONVO_HISTORY_PROVIDER;
  const convoHistoryPath = process.env.RITUAL_LLM_CONVO_HISTORY_PATH;
  const convoHistoryKeyRef = process.env.RITUAL_LLM_CONVO_HISTORY_KEY_REF;

  if (!executor) {
    throw new Error("Missing RITUAL_LLM_EXECUTOR_ADDRESS. Select a live LLM executor from TEEServiceRegistry.");
  }
  if (!ethers.isAddress(executor)) throw new Error("Invalid RITUAL_LLM_EXECUTOR_ADDRESS.");
  if (!ethers.isAddress(llmPrecompile)) throw new Error("Invalid RITUAL_LLM_PRECOMPILE_ADDRESS.");
  if (!model) throw new Error("Missing RITUAL_LLM_MODEL.");
  if (ttl <= 0n) throw new Error("RITUAL_LLM_TTL must be greater than zero.");
  if (!convoHistoryProvider || !convoHistoryPath || !convoHistoryKeyRef) {
    throw new Error(
      "Missing Ritual LLM convoHistory config. Set RITUAL_LLM_CONVO_HISTORY_PROVIDER, RITUAL_LLM_CONVO_HISTORY_PATH, and RITUAL_LLM_CONVO_HISTORY_KEY_REF.",
    );
  }

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  console.log(`Deployer: ${deployer.address}`);
  console.log(`Chain ID: ${network.chainId.toString()}`);
  console.log(`LLM precompile: ${llmPrecompile}`);
  console.log(`LLM executor: ${executor}`);
  console.log(`LLM model: ${model}`);
  console.log(`LLM TTL: ${ttl.toString()} blocks`);
  console.log(`LLM temperature: ${temperature.toString()}`);
  console.log(`LLM convoHistory: ${convoHistoryProvider}:${convoHistoryPath} (${convoHistoryKeyRef})`);

  const Manager = await ethers.getContractFactory("RitualChatManager");
  const manager = await Manager.deploy(
    llmPrecompile,
    executor,
    model,
    ttl,
    temperature,
    {
      platform: convoHistoryProvider,
      path: convoHistoryPath,
      keyRef: convoHistoryKeyRef,
    },
  );
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
