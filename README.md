# RITUAL CHAT

RITUAL CHAT is a simple public, text-only chat app for Ritual Testnet.

The current scope is intentionally narrow:

```text
connected wallet
-> MetaMask or optional browser-generated session wallet
-> RitualChatManager
-> Ritual LLM precompile 0x0802
-> real Ritual Testnet transaction hash
```

The app does not include media chat, image generation, file upload, voice chat, NFT launchpad features, or arbitrary transaction tools.

## Public v1 Flow

1. Connect an EVM wallet.
2. Use the connected wallet address as the user's public identity.
3. Optionally generate and fund a browser session wallet for no-popup chat sends.
4. Deposit RITUAL into RitualWallet for the active sender.
5. Send text prompts through `RitualChatManager.sendChatMessage(prompt)`.
6. See a real Ritual Testnet transaction hash for each chat submission.

Wallet is used for identity. Chat transactions are submitted by MetaMask or the optional browser session wallet to RitualChatManager. The backend validates prompts and builds the approved ChatManager calldata; it does not hold a relayer key.

## Security Model

- The browser never sends arbitrary target addresses or calldata for chat.
- The chat API builds only `RitualChatManager.sendChatMessage(prompt)` server-side.
- The frontend can only submit the server-built call to the configured `CHAT_MANAGER_ADDRESS`.
- `DEPLOYER_PRIVATE_KEY` is server-only.
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
DEPLOYER_PRIVATE_KEY=

RITUAL_LLM_PRECOMPILE_ADDRESS=0x0802
RITUAL_LLM_EXECUTOR_ADDRESS=
RITUAL_LLM_MODEL=zai-org/GLM-4.7-FP8
RITUAL_LLM_TTL=300
RITUAL_LLM_TEMPERATURE=700
RITUAL_LLM_MAX_COMPLETION_TOKENS=64
RITUAL_LLM_CONVO_HISTORY_ENABLED=false
RITUAL_LLM_CONVO_HISTORY_PROVIDER=
RITUAL_LLM_CONVO_HISTORY_PATH=
RITUAL_LLM_CONVO_HISTORY_KEY_REF=
RITUAL_WALLET_ADDRESS=0x532F0dF0896F353d8C3DD8cc134e8129DA2a3948
RITUAL_LLM_WALLET_FUNDING_WEI=10000000000000000
RITUAL_LLM_LOCK_DURATION=50000
CHAT_MANAGER_ADDRESS=

STORAGE_DRIVER=memory
MOCK_MODE=false
```

`RITUAL_LLM_LOCK_DURATION` must cover at least the request TTL. Deposit RITUAL into RitualWallet for whichever sender you use for chat: MetaMask or the generated session wallet.

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
RITUAL_LLM_MAX_COMPLETION_TOKENS=64
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
- the active sender has native Ritual testnet gas
- the active sender has a RitualWallet deposit with enough lock duration
- Ritual LLM config is working

If any condition is missing, the existing status card shows the blocking state.

## Troubleshooting

### ChatManager not configured

Set `CHAT_MANAGER_ADDRESS` after deploying `RitualChatManager`.

### RitualWallet deposit needed

Use the in-app RitualWallet deposit controls for MetaMask or the generated session wallet.
Ritual's current live text model, `zai-org/GLM-4.7-FP8`, locks worst-case escrow from the model registry max sequence length, not from prompt length or `RITUAL_LLM_MAX_COMPLETION_TOKENS`. The practical requirement is about `0.31 RITUAL` per in-flight LLM request, so the app defaults the RitualWallet deposit amount to `0.35 RITUAL` for headroom.

### Insufficient lock duration

If chat fails with:

```text
invalid async payload: insufficient lock duration
```

the active chat sender has no active RitualWallet lock. Deposit into RitualWallet with a lock duration that covers the LLM TTL.

### Wallet nonce / replacement transaction errors

Errors such as:

```text
replacement transaction underpriced
nonce too low
already known
transaction underpriced
```

usually mean the active chat sender has a pending or stuck transaction. Wait for the pending transaction to settle, then try again.

## Verification

Run:

```bash
npm run lint
npm run typecheck
npm run contracts:compile
npm run contracts:test
npm run build
```
