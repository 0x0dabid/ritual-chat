import hardhat from "hardhat";

const { ethers } = hardhat;

function requireAddress(value: string | undefined, label: string) {
  if (!value) {
    throw new Error(`Missing ${label}.`);
  }

  if (!ethers.isAddress(value)) {
    throw new Error(`${label} is not a valid EVM address.`);
  }

  return ethers.getAddress(value);
}

async function main() {
  if (!process.env.RITUAL_RPC_URL) {
    throw new Error("Missing RITUAL_RPC_URL. Set it to the Ritual Testnet RPC endpoint before verifying.");
  }

  const factoryAddress = requireAddress(process.env.AA_FACTORY_ADDRESS, "AA_FACTORY_ADDRESS");
  const [signer] = await ethers.getSigners();
  const ownerAddress = requireAddress(
    process.env.TEST_OWNER_ADDRESS ?? process.env.OWNER_WALLET_ADDRESS ?? signer?.address,
    "TEST_OWNER_ADDRESS or OWNER_WALLET_ADDRESS",
  );
  const shouldCreate = process.env.CREATE_ACCOUNT_IF_MISSING !== "false";
  const network = await ethers.provider.getNetwork();

  console.log("Network chain ID:", network.chainId.toString());
  console.log("Factory address:", factoryAddress);
  console.log("Owner wallet:", ownerAddress);

  const factory = await ethers.getContractAt("RitualChatSmartAccountFactory", factoryAddress);
  const predictedAccount = await factory.getAccountAddress(ownerAddress);
  let accountCode = await ethers.provider.getCode(predictedAccount);
  let accountDeployed = accountCode !== "0x";
  let txHash: string | undefined;

  console.log("Predicted smart account:", predictedAccount);
  console.log("Account deployed:", accountDeployed);

  if (!accountDeployed && shouldCreate) {
    if (!signer) {
      throw new Error(
        "Account is not deployed and no DEPLOYER_PRIVATE_KEY or RELAYER_PRIVATE_KEY is configured to create it.",
      );
    }

    console.log("Creating smart account for owner:", ownerAddress);
    const tx = await factory.connect(signer).createAccount(ownerAddress);
    txHash = tx.hash;
    console.log("Create account tx hash:", txHash);
    await tx.wait();

    accountCode = await ethers.provider.getCode(predictedAccount);
    accountDeployed = accountCode !== "0x";
  }

  if (!accountDeployed) {
    console.log("No code found at predicted smart account.");
  }

  console.log("Owner wallet:", ownerAddress);
  console.log("Predicted smart account:", predictedAccount);
  console.log("Account deployed:", accountDeployed);
  if (txHash) {
    console.log("Created tx hash:", txHash);
  }
}

main().catch((error) => {
  console.error("Failed to verify RitualChatSmartAccountFactory:");
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
