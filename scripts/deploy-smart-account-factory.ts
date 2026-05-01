import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { ethers } from "hardhat";

async function main() {
  if (!process.env.RITUAL_RPC_URL) {
    throw new Error("Missing RITUAL_RPC_URL. Set it to the Ritual Testnet RPC endpoint before deploying.");
  }

  if (!process.env.DEPLOYER_PRIVATE_KEY && !process.env.RELAYER_PRIVATE_KEY) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY or RELAYER_PRIVATE_KEY. Use a server-side deployer key only.");
  }

  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY or RELAYER_PRIVATE_KEY.");
  }

  const network = await ethers.provider.getNetwork();
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Network chain ID:", network.chainId.toString());
  console.log("Deployer address:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "RITUAL");

  const Factory = await ethers.getContractFactory("RitualChatSmartAccountFactory");
  const factory = await Factory.deploy();
  const deploymentTx = factory.deploymentTransaction();

  if (!deploymentTx) {
    throw new Error("Factory deployment transaction was not available.");
  }

  console.log("Deployment tx hash:", deploymentTx.hash);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const deployment = {
    network: "ritual",
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    deploymentTxHash: deploymentTx.hash,
    contracts: {
      RitualChatSmartAccountFactory: factoryAddress,
    },
  };

  await mkdir(path.join(process.cwd(), "deployments"), { recursive: true });
  await writeFile(
    path.join(process.cwd(), "deployments", "ritual-smart-account-factory.json"),
    `${JSON.stringify(deployment, null, 2)}\n`,
    "utf8",
  );

  console.log("RitualChatSmartAccountFactory deployed to:", factoryAddress);
  console.log("AA_FACTORY_ADDRESS=", factoryAddress);
  console.log("Deployment saved to deployments/ritual-smart-account-factory.json");
}

main().catch((error) => {
  console.error("Failed to deploy RitualChatSmartAccountFactory:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
