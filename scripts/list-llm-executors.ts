import hardhat from "hardhat";
import dotenv from "dotenv";
import type { BaseContract } from "ethers";

dotenv.config();
dotenv.config({ path: ".env.local", override: false });

const { ethers } = hardhat;

const DEFAULT_TEE_SERVICE_REGISTRY_ADDRESS = "0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F";
const CAPABILITY_LLM = 1;

type TEEServiceNode = {
  paymentAddress: string;
  teeAddress: string;
  teeType: bigint;
  publicKey: string;
  endpoint: string;
  certPubKeyHash: string;
  capability: bigint;
};

type TEEServiceContext = {
  node: TEEServiceNode;
  isValid: boolean;
  workloadId: string;
};

type TEEServiceRegistryContract = BaseContract & {
  getCapabilityIndexStatus(): Promise<[bigint, bigint, boolean, boolean]>;
  getIndexedServiceCountByCapability(capability: number): Promise<bigint>;
  getIndexedServiceByCapabilityAt(capability: number, index: bigint): Promise<string>;
  getService(addr: string, checkValidity: boolean): Promise<TEEServiceContext>;
  getServicesByCapability(capability: number, checkValidity: boolean): Promise<TEEServiceContext[]>;
  pickServiceByCapability(
    capability: number,
    checkValidity: boolean,
    seed: bigint,
    maxProbes: bigint,
  ): Promise<[string, boolean]>;
};

const teeServiceRegistryAbi = [
  {
    name: "getCapabilityIndexStatus",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "cursor", type: "uint256" },
      { name: "total", type: "uint256" },
      { name: "initialized", type: "bool" },
      { name: "finalized", type: "bool" },
    ],
  },
  {
    name: "getIndexedServiceCountByCapability",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "capability", type: "uint8" }],
    outputs: [{ name: "count", type: "uint256" }],
  },
  {
    name: "getIndexedServiceByCapabilityAt",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "capability", type: "uint8" },
      { name: "index", type: "uint256" },
    ],
    outputs: [{ name: "teeAddress", type: "address" }],
  },
  {
    name: "getService",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "addr", type: "address" },
      { name: "checkValidity", type: "bool" },
    ],
    outputs: [
      {
        name: "service",
        type: "tuple",
        components: [
          {
            name: "node",
            type: "tuple",
            components: [
              { name: "paymentAddress", type: "address" },
              { name: "teeAddress", type: "address" },
              { name: "teeType", type: "uint8" },
              { name: "publicKey", type: "bytes" },
              { name: "endpoint", type: "string" },
              { name: "certPubKeyHash", type: "bytes32" },
              { name: "capability", type: "uint8" },
            ],
          },
          { name: "isValid", type: "bool" },
          { name: "workloadId", type: "bytes32" },
        ],
      },
    ],
  },
  {
    name: "getServicesByCapability",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "capability", type: "uint8" },
      { name: "checkValidity", type: "bool" },
    ],
    outputs: [
      {
        name: "services",
        type: "tuple[]",
        components: [
          {
            name: "node",
            type: "tuple",
            components: [
              { name: "paymentAddress", type: "address" },
              { name: "teeAddress", type: "address" },
              { name: "teeType", type: "uint8" },
              { name: "publicKey", type: "bytes" },
              { name: "endpoint", type: "string" },
              { name: "certPubKeyHash", type: "bytes32" },
              { name: "capability", type: "uint8" },
            ],
          },
          { name: "isValid", type: "bool" },
          { name: "workloadId", type: "bytes32" },
        ],
      },
    ],
  },
  {
    name: "pickServiceByCapability",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "capability", type: "uint8" },
      { name: "checkValidity", type: "bool" },
      { name: "seed", type: "uint256" },
      { name: "maxProbes", type: "uint256" },
    ],
    outputs: [
      { name: "teeAddress", type: "address" },
      { name: "found", type: "bool" },
    ],
  },
] as const;

function requireRpcUrl() {
  const rpcUrl = process.env.RITUAL_RPC_URL;
  if (!rpcUrl) {
    throw new Error("Missing RITUAL_RPC_URL. Set it to the Ritual Testnet RPC URL.");
  }
  return rpcUrl;
}

function getRegistryAddress() {
  const address = process.env.TEE_SERVICE_REGISTRY_ADDRESS ?? DEFAULT_TEE_SERVICE_REGISTRY_ADDRESS;
  if (!ethers.isAddress(address)) {
    throw new Error("Invalid TEE_SERVICE_REGISTRY_ADDRESS.");
  }
  return address;
}

function normalizeContext(context: TEEServiceContext): TEEServiceContext {
  return {
    node: {
      paymentAddress: context.node.paymentAddress,
      teeAddress: context.node.teeAddress,
      teeType: BigInt(context.node.teeType),
      publicKey: context.node.publicKey,
      endpoint: context.node.endpoint,
      certPubKeyHash: context.node.certPubKeyHash,
      capability: BigInt(context.node.capability),
    },
    isValid: Boolean(context.isValid),
    workloadId: context.workloadId,
  };
}

function dedupeServices(services: TEEServiceContext[]) {
  const byAddress = new Map<string, TEEServiceContext>();
  for (const service of services) {
    const address = service.node.teeAddress.toLowerCase();
    if (!byAddress.has(address)) byAddress.set(address, service);
  }
  return [...byAddress.values()];
}

async function loadServices(registry: TEEServiceRegistryContract) {
  const [cursor, total, initialized, finalized] = await registry.getCapabilityIndexStatus();
  console.log(`Capability index initialized: ${initialized}`);
  console.log(`Capability index finalized: ${finalized}`);
  console.log(`Capability index cursor: ${cursor.toString()} / ${total.toString()}`);

  if (finalized) {
    const count = await registry.getIndexedServiceCountByCapability(CAPABILITY_LLM);
    console.log(`Indexed LLM service count: ${count.toString()}`);

    const services: TEEServiceContext[] = [];
    for (let index = 0n; index < count; index += 1n) {
      const teeAddress = await registry.getIndexedServiceByCapabilityAt(CAPABILITY_LLM, index);
      const service = await registry.getService(teeAddress, true);
      services.push(normalizeContext(service));
    }
    return dedupeServices(services.filter((service) => service.isValid));
  }

  console.log("Capability index is not finalized. Falling back to getServicesByCapability(1, true).");
  const services = await registry.getServicesByCapability(CAPABILITY_LLM, true);
  return dedupeServices(services.map(normalizeContext).filter((service) => service.isValid));
}

async function main() {
  requireRpcUrl();

  const network = await ethers.provider.getNetwork();
  const registryAddress = getRegistryAddress();
  const registry = new ethers.Contract(
    registryAddress,
    teeServiceRegistryAbi,
    ethers.provider,
  ) as unknown as TEEServiceRegistryContract;

  console.log("Ritual LLM executor discovery");
  console.log(`Chain ID: ${network.chainId.toString()}`);
  console.log(`TEE registry: ${registryAddress}`);
  console.log(`Capability: ${CAPABILITY_LLM} (LLM)`);
  console.log("");

  const [pickedAddress, pickedFound] = await registry.pickServiceByCapability(
    CAPABILITY_LLM,
    true,
    BigInt(Date.now()),
    32n,
  );
  if (pickedFound) {
    console.log(`Registry pickServiceByCapability candidate: ${pickedAddress}`);
    console.log(`Copy candidate: RITUAL_LLM_EXECUTOR_ADDRESS=${pickedAddress}`);
    console.log("");
  }

  const services = await loadServices(registry);

  if (services.length === 0) {
    console.log("No live Ritual LLM executor found.");
    return;
  }

  console.log("");
  console.log(`Live Ritual LLM executors found: ${services.length}`);
  for (const [index, service] of services.entries()) {
    console.log("");
    console.log(`Executor ${index + 1}`);
    console.log(`  RITUAL_LLM_EXECUTOR_ADDRESS=${service.node.teeAddress}`);
    console.log(`  Public key: ${service.node.publicKey || "unavailable"}`);
    console.log(`  Payment address: ${service.node.paymentAddress}`);
    console.log(`  TEE type: ${service.node.teeType.toString()}`);
    console.log(`  Capability: ${service.node.capability.toString()} (LLM)`);
    console.log(`  Workload ID: ${service.workloadId}`);
    console.log(`  Certificate public key hash: ${service.node.certPubKeyHash}`);
    console.log("  Endpoint: registered but intentionally not used by this dApp flow");
  }

  console.log("");
  console.log("Copy one live executor into .env.local or Vercel:");
  console.log(`RITUAL_LLM_EXECUTOR_ADDRESS=${services[0].node.teeAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
