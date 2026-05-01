import { createPublicClient, defineChain, http } from "viem";
import { RITUAL_CHAIN_ID, RITUAL_RPC_URL } from "@/lib/config";

export const ritualChain = defineChain({
  id: RITUAL_CHAIN_ID,
  name: "Ritual Testnet",
  nativeCurrency: { name: "RITUAL", symbol: "RITUAL", decimals: 18 },
  rpcUrls: {
    default: {
      http: [RITUAL_RPC_URL ?? "https://rpc.ritualfoundation.org"],
    },
  },
});

export function getPublicClient() {
  if (!RITUAL_RPC_URL) {
    throw new Error("RPC unavailable. Set RITUAL_RPC_URL to use real Ritual mode.");
  }

  return createPublicClient({
    chain: ritualChain,
    transport: http(RITUAL_RPC_URL),
  });
}
