# RITUAL CHAT

RITUAL CHAT is a simple public, text-only chat app for Ritual Testnet.

The current scope is intentionally narrow:

```text
connected wallet
-> server relayer
-> RitualChatManager
-> Ritual LLM precompile 0x0802
-> real Ritual Testnet transaction hash
```

The app does not include media chat, image generation, file upload, voice chat, NFT launchpad features, or arbitrary transaction tools.

## Public v1 Flow

1. Connect an EVM wallet.
2. Use the connected wallet address as the user's public identity.
3. Send text prompts without wallet popups per message.
4. The backend relayer submits `RitualChatManager.sendChatMessage(prompt)`.
5. See a real Ritual Testnet transaction hash for each chat submission.

Wallet is used for identity only. Chat transactions are submitted by the server relayer to RitualChatManager.

## Security Model

- The browser never sends arbitrary target addresses or calldata for chat.
- The chat API builds only `RitualChatManager.sendChatMessage(prompt)` server-side.
- The backend relayer sends only to the configured `CHAT_MANAGER_ADDRESS`.
- `RELAYER_PRIVATE_KEY` and `DEPLOYER_PRIVATE_KEY` are server-only.
- Never create `NEXT_PUBLIC_RELAYER_PRIVATE_KEY` or `NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY`.
- Real mode never returns fake transaction hashes.

## Required Environment

Copy `.env.example` to `.env.local` and fill the real values:

```bash
NEXT_PUBLIC_RITUAL_CHAIN_ID=1979
NEXT_PUBLIC_RITUAL_EXPLORER_URL=https://explorer.ritualfoundation.org
NEXT_PUBLIC_RITUAL_RPC_URL=https://rpc.ritualfoundation.org
NEXT_PUBLIC_MOCK_MODE=false

RITUAL_RPC_URL=https://rpc.ritualfoundation.org
TEE_SERVICE_REGISTRY_ADDRESS=0x9644e8562cE0Fe12b4deeC4163c064A8862Bf47F
RELAYER_PRIVATE_KEY=
DEPLOYER_PRIVATE_KEY=

RITUAL_LLM_PRECOMPILE_ADDRESS=0x0802
RITUAL_LLM_EXECUTOR_ADDRESS=
RITUAL_LLM_MODEL=zai-org/GLM-4.7-FP8
RITUAL_LLM_TTL=300
RITUAL_LLM_TEMPERATURE=700
RITUAL_LLM_CONVO_HISTORY_ENABLED=false
RITUAL_LLM_CONVO_HISTORY_PROVIDER=
RITUAL_LLM_CONVO_HISTORY_PATH=
RITUAL_LLM_CONVO_HISTORY_KEY_REF=
RITUAL_LLM_WALLET_FUNDING_WEI=10000000000000000
RITUAL_LLM_LOCK_DURATION=50000
CHAT_MANAGER_ADDRESS=

STORAGE_DRIVER=memory
MOCK_MODE=false
```

`RELAYER_PRIVATE_KEY` is used as the server-held chat sender key. It must stay server-side and needs enough testnet gas to submit chat transactions.

## Find a Ritual LLM Executor

Use the registry helper:

```bash
npm run ritual:list-llm-executors
```

Copy one live executor into:

```bash
RITUAL_LLM_EXECUTOR_ADDRESS=0x...
```

The script reads `TEEServiceRegistry` capability `1` for LLM. Use the executor `teeAddress`; the dApp does not use the registry endpoint.

## Deploy Contracts

Compile and test:

```bash
npm run contracts:compile
npm run contracts:test
```

Deploy the chat manager after setting the LLM executor:

```bash
RITUAL_RPC_URL=https://rpc.ritualfoundation.org
DEPLOYER_PRIVATE_KEY=0x...
RITUAL_LLM_EXECUTOR_ADDRESS=0x...
RITUAL_LLM_MODEL=zai-org/GLM-4.7-FP8
RITUAL_LLM_TTL=300
RITUAL_LLM_TEMPERATURE=700
RITUAL_LLM_CONVO_HISTORY_ENABLED=false
RITUAL_LLM_WALLET_FUNDING_WEI=10000000000000000
RITUAL_LLM_LOCK_DURATION=50000
npm run contracts:deploy:chat
```

The deploy script prints:

```bash
CHAT_MANAGER_ADDRESS=0x...
```

It also funds the ChatManager in RitualWallet when `RITUAL_LLM_WALLET_FUNDING_WEI` is set. Conversation history is
disabled by default for simple public v1 chat; set `RITUAL_LLM_CONVO_HISTORY_ENABLED=true` only when real DA
credentials are configured.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Mock Mode

Mock mode is only for local UI testing:

```bash
MOCK_MODE=true
NEXT_PUBLIC_MOCK_MODE=true
STORAGE_DRIVER=local-file
```

Mock mode may generate fake local addresses and fake tx hashes. Real mode must not.

## Chat Readiness

Chat is enabled only when:

- wallet is connected
- `CHAT_MANAGER_ADDRESS` is configured
- `RELAYER_PRIVATE_KEY` is configured server-side
- the relayer has enough Ritual testnet gas
- Ritual LLM config is working

If any condition is missing, the existing status card shows the blocking state.

## Troubleshooting

### ChatManager not configured

Set `CHAT_MANAGER_ADDRESS` after deploying `RitualChatManager`.

### Relayer not configured

Set `RELAYER_PRIVATE_KEY` on the server only. Never expose it in frontend code.

### Wallet nonce / replacement transaction errors

Errors such as:

```text
replacement transaction underpriced
nonce too low
already known
transaction underpriced
```

usually mean the relayer has a pending or stuck transaction. Wait for the pending transaction to settle, then try again.

## Verification

Run:

```bash
npm run lint
npm run typecheck
npm run contracts:compile
npm run contracts:test
npm run build
```
