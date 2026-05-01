import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error("Missing DEPLOYER_PRIVATE_KEY or RELAYER_PRIVATE_KEY.");
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deploying RitualChatSmartAccountFactory with:", deployer.address);
  console.log("Deployer balance:", ethers.formatEther(balance), "RITUAL");

  const Factory = await ethers.getContractFactory("RitualChatSmartAccountFactory");
  const factory = await Factory.deploy();
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const deployment = {
    network: "ritual",
    chainId: 1979,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
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
  console.error(error);
  process.exitCode = 1;
});
