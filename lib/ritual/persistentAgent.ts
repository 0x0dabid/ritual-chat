import {
  encodeAbiParameters,
  parseAbi,
  parseAbiParameters,
  toFunctionSelector,
  type Address,
  type Hex,
} from "viem";
import { addressExplorerLink, MOCK_MODE, PERSISTENT_AGENT_FACTORY_ADDRESS } from "@/lib/config";
import { mockAddress } from "@/lib/mock";
import { getPublicClient } from "@/lib/ritual/chain";
import type { AgentSession } from "@/lib/types";

export const persistentAgentFactoryAbi = parseAbi([
  "function predictLauncher(address owner, bytes32 userSalt) view returns (address launcher, bytes32 dkmsContext)",
  "function deployLauncher(bytes32 userSalt) returns (address launcher)",
]);

export async function createOrLoadPersistentAgent(params: {
  sessionId: string;
  smartAccountAddress: Address;
  existing?: AgentSession | null;
}) {
  if (params.existing) return params.existing.persistentAgentAddress;

  if (MOCK_MODE) {
    return mockAddress(`persistent-agent:${params.smartAccountAddress}`);
  }

  const publicClient = getPublicClient();
  const userSalt = sessionSalt(params.sessionId);

  // TODO(real-aa): After the AA provider is selected, call deployLauncher(bytes32)
  // through the user's AA smart account. Calling the factory from the relayer
  // would incorrectly make the relayer the owner/controller.
  const [launcher] = await publicClient.readContract({
    address: PERSISTENT_AGENT_FACTORY_ADDRESS,
    abi: persistentAgentFactoryAbi,
    functionName: "predictLauncher",
    args: [params.smartAccountAddress, userSalt],
  });

  return launcher;
}

export function getPersistentAgentStatus(session: AgentSession) {
  return {
    status: session.status,
    explorerLink: addressExplorerLink(session.persistentAgentAddress),
  };
}

export function buildPersistentAgentChatCall(params: {
  executor: Address;
  deliveryTarget: Address;
  provider: number;
  model: string;
  llmApiKeyRef: string;
  daPath: string;
  rpcUrl: string;
}) {
  // Confirmed from latest ritual-dapp-skills on 2026-05-01:
  // Persistent Agent precompile 0x0820 accepts a 26-field ABI payload.
  // Production deployments still need project-owned DA credentials and a callback
  // contract/launcher with this delivery selector.
  return encodeAbiParameters(
    parseAbiParameters([
      "address, bytes[], uint256, bytes[], bytes,",
      "uint64, address, bytes4, uint256, uint256, uint256, uint256,",
      "uint8, string, string,",
      "(string,string,string), (string,string,string),",
      "(string,string,string), (string,string,string),",
      "(string,string,string), (string,string,string),",
      "(string,string,string), (string,string,string),",
      "string, string, uint16",
    ].join("")),
    [
      params.executor,
      [],
      300n,
      [],
      "0x",
      600n,
      params.deliveryTarget,
      toFunctionSelector("onPersistentAgentResult(bytes32,bytes)"),
      500_000n,
      1_000_000_000n,
      100_000_000n,
      0n,
      params.provider,
      params.model,
      params.llmApiKeyRef,
      ["gcs", `${params.daPath}/manifest.json`, "GCS_CREDS"],
      ["gcs", `${params.daPath}/SOUL.md`, "GCS_CREDS"],
      ["", "", ""],
      ["", "", ""],
      ["gcs", `${params.daPath}/MEMORY.md`, "GCS_CREDS"],
      ["gcs", `${params.daPath}/IDENTITY.md`, "GCS_CREDS"],
      ["gcs", `${params.daPath}/TOOLS.md`, "GCS_CREDS"],
      ["", "", ""],
      "",
      JSON.stringify({ ritual: params.rpcUrl }),
      0,
    ],
  );
}

function sessionSalt(sessionId: string): Hex {
  const encoded = Buffer.from(sessionId).toString("hex").padEnd(64, "0").slice(0, 64);
  return `0x${encoded}`;
}
