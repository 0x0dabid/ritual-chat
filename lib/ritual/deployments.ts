import type { Address } from "viem";

export interface RitualDeploymentInfo {
  network: string;
  chainId: number;
  deployedAt: string;
  deployer: Address;
  contracts: {
    RitualChatSmartAccountFactory: Address;
  };
}

export const deploymentFiles = {
  ritualSmartAccountFactory: "deployments/ritual-smart-account-factory.json",
} as const;
