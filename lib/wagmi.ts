import { http, createConfig } from "wagmi";
import { injected } from "@wagmi/core";
import { defineChain } from "viem";

const ritualChainId = Number(process.env.NEXT_PUBLIC_RITUAL_CHAIN_ID ?? "1979");

export const ritualTestnet = defineChain({
  id: ritualChainId,
  name: "Ritual Testnet",
  nativeCurrency: {
    name: "RITUAL",
    symbol: "RITUAL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.ritualfoundation.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Ritual Explorer",
      url: "https://explorer.ritualfoundation.org",
    },
  },
});

export const wagmiConfig = createConfig({
  chains: [ritualTestnet],
  connectors: [
    injected({
      target: "metaMask",
    }),
  ],
  transports: {
    [ritualTestnet.id]: http(),
  },
  ssr: true,
});
