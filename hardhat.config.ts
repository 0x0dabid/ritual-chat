import "@nomicfoundation/hardhat-toolbox";
import type { HardhatUserConfig } from "hardhat/config";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: ".env.local", override: false });

const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY ?? process.env.RELAYER_PRIVATE_KEY;

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {},
    ritual: {
      url: process.env.RITUAL_RPC_URL ?? "https://rpc.ritualfoundation.org",
      chainId: 1979,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
    },
  },
};

export default config;
