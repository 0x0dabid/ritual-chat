import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

const ritualChainId = Number(process.env.NEXT_PUBLIC_RITUAL_CHAIN_ID ?? "1979");
const ritualRpcUrl = process.env.NEXT_PUBLIC_RITUAL_RPC_URL
  ?? process.env.RITUAL_RPC_URL
  ?? "https://rpc.ritualfoundation.org";

export const ritualTestnet = defineChain({
  id: ritualChainId,
  name: "Ritual Testnet",
  nativeCurrency: {
    name: "Ritual Testnet Token",
    symbol: "RITUAL",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [ritualRpcUrl],
    },
  },
  blockExplorers: {
    default: {
      name: "Ritual Explorer",
      url: "https://explorer.ritualfoundation.org",
    },
  },
});

export const config = createConfig({
  chains: [ritualTestnet],
  connectors: [injected()],
  transports: {
    [ritualTestnet.id]: http(ritualRpcUrl),
  },
  ssr: true,
});

export const wagmiConfig = config;
