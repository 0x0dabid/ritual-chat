# RITUAL CHAT

RITUAL CHAT is a simple public, text-only chat app for Ritual Testnet.

The current scope is intentionally narrow:

```text
connected wallet
-> permanent Ritual Chat Smart Account
-> limited chat session key
-> RitualChatManager
-> Ritual LLM precompile 0x0802
-> real Ritual Testnet transaction hash
```

The app does not include media chat, image generation, file upload, voice chat, NFT launchpad features, or arbitrary transaction tools.

## Public v1 Flow

1. Connect an EVM wallet.
2. Create or load the user's deterministic Ritual Chat Smart Account.
3. Fund the smart account with a small amount of testnet RITUAL.
4. Authorize the limited chat session key once.
5. Send text prompts without wallet popups per message.
6. See a real Ritual Testnet transaction hash for each chat submission.

The connected wallet is used for setup and authorization. Chat messages are submitted by the backend session executor through the authorized smart-account chat path.

## Security Model

- One deterministic smart account per connected wallet.
- The backend does not own user smart accounts.
- The browser never sends arbitrary target addresses or calldata for chat.
- The chat API builds only `smartAccount.executeChatCall(CHAT_MANAGER_ADDRESS, sendChatMessage(prompt))`.
- The session key can call `executeChatCall` only while valid.
- `executeChatCall` only reaches targets approved by `RitualChatSmartAccountFactory`.
- The session key cannot call `executeOwnerCall`.
- The session key cannot approve targets, change ownership, or submit arbitrary calls.
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

AA_PROVIDER=custom
AA_PROVIDER_KIND=custom
AA_FACTORY_ADDRESS=

RITUAL_LLM_PRECOMPILE_ADDRESS=0x0802
RITUAL_LLM_EXECUTOR_ADDRESS=
RITUAL_LLM_MODEL=zai-org/GLM-4.7-FP8
RITUAL_LLM_TTL=30
RITUAL_LLM_TEMPERATURE=700
RITUAL_LLM_CONVO_HISTORY_PROVIDER=
RITUAL_LLM_CONVO_HISTORY_PATH=
RITUAL_LLM_CONVO_HISTORY_KEY_REF=
CHAT_MANAGER_ADDRESS=

MIN_SMART_ACCOUNT_BALANCE_WEI=1000000000000000
SESSION_KEY_TTL_HOURS=24

STORAGE_DRIVER=memory
MOCK_MODE=false
```

`RELAYER_PRIVATE_KEY` is used as the server-held chat session executor key. It must stay server-side and needs enough testnet gas to submit authorized chat transactions.

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

Deploy the smart account factory:

```bash
RITUAL_RPC_URL=https://rpc.ritualfoundation.org
DEPLOYER_PRIVATE_KEY=0x...
npm run contracts:deploy:aa
```

Set the printed:

```bash
AA_FACTORY_ADDRESS=0x...
```

Deploy the chat manager after setting the LLM executor and conversation history config:

```bash
RITUAL_RPC_URL=https://rpc.ritualfoundation.org
DEPLOYER_PRIVATE_KEY=0x...
AA_FACTORY_ADDRESS=0x...
RITUAL_LLM_EXECUTOR_ADDRESS=0x...
RITUAL_LLM_MODEL=zai-org/GLM-4.7-FP8
RITUAL_LLM_TTL=30
RITUAL_LLM_TEMPERATURE=700
RITUAL_LLM_CONVO_HISTORY_PROVIDER=gcs
RITUAL_LLM_CONVO_HISTORY_PATH=ritual-chat/conversations/session.jsonl
RITUAL_LLM_CONVO_HISTORY_KEY_REF=GCS_CREDS
npm run contracts:deploy:chat
```

The deploy script prints:

```bash
CHAT_MANAGER_ADDRESS=0x...
```

It also allowlists `CHAT_MANAGER_ADDRESS` on the factory when the deployer owns the factory.

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
- smart account is deployed
- smart account balance is at least `MIN_SMART_ACCOUNT_BALANCE_WEI`
- session key is authorized and not expired
- `CHAT_MANAGER_ADDRESS` is configured
- `CHAT_MANAGER_ADDRESS` is approved by the smart account factory

If any condition is missing, the existing status card shows the blocking state.

## Troubleshooting

### ChatManager not configured

Set `CHAT_MANAGER_ADDRESS` after deploying `RitualChatManager`.

### Chat target not approved

The factory owner must approve the deployed `CHAT_MANAGER_ADDRESS`. The deploy script does this automatically when `AA_FACTORY_ADDRESS` is set and the deployer owns the factory.

### Session key pending

Click `Authorize Chat Session` and approve the one-time setup transaction in the connected wallet.

### Smart account needs funding

Send a small amount of Ritual testnet token to the displayed smart account address.

### Wallet nonce / replacement transaction errors

Errors such as:

```text
replacement transaction underpriced
nonce too low
already known
transaction underpriced
```

usually mean the wallet has a pending or stuck setup transaction. Open the wallet activity queue and wait for, speed up, or cancel the pending transaction. If needed, clear activity/nonce data in the wallet settings, refresh, and try again.

## Verification

Run:

```bash
npm run lint
npm run typecheck
npm run contracts:compile
npm run contracts:test
npm run build
```
