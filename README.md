# RITUAL CHAT

RITUAL CHAT is a simple public, text-only ChatGPT-style app for Ritual Testnet. It gives each user a permanent smart-account identity, creates or loads a Persistent Ritual Agent for that smart account, submits chat through a limited session key, and shows a clickable Ritual Testnet transaction hash for every assistant response.

This app intentionally does not include media chat, image generation, file upload, voice chat, NFT launchpad features, or arbitrary transaction tools.

## Why Persistent Agents

RITUAL CHAT uses Persistent Agents because the product is a long-lived assistant. A user expects "my agent" to continue existing across sessions with a stable identity. Sovereign Agents are better for autonomous jobs, workflows, scheduled execution, and one-off task runs.

## Ownership Model

The intended ownership model is:

`user wallet/session -> permanent AA smart account -> owns Persistent Ritual Agent -> uses Ritual LLM -> returns tx hash`

Each user should have one permanent AA smart account. The app stores and displays that smart account address, and the Persistent Agent is tied to that account, not to a shared backend wallet.

## Relayer Model

The backend relayer only submits or sponsors approved chat transactions. It must not own all Persistent Agents, accept arbitrary targets, accept arbitrary calldata, sign unrestricted transactions, or expose its private key.

Never expose RELAYER_PRIVATE_KEY in frontend code. Never prefix it with NEXT_PUBLIC_. The relayer key must stay server-side only.

## Gasless-Feeling Chat

The app creates a limited session key so the user does not need a wallet popup for every message. The allowed session-key surface is intentionally narrow:

- `sendChatMessage(prompt)`
- `checkChatResponse(messageId)`
- `retryChatMessage(messageId)`

The session key must not transfer funds, withdraw funds, deploy arbitrary contracts, change agent ownership, edit relayer config, or call unrelated contracts.

## Ritual References Confirmed

The implementation was checked against the latest `ritual-foundation/ritual-dapp-skills` repository on May 1, 2026.

- PersistentAgentFactory: `0xD4AA9D55215dc8149Af57605e70921Ea16b73591`
- Persistent Agent precompile: `0x0000000000000000000000000000000000000820`
- Ritual LLM precompile: `0x0000000000000000000000000000000000000802`
- PersistentAgentFactory methods confirmed: `predictLauncher(address,bytes32)` and `deployLauncher(bytes32)`
- Persistent Agent raw payload: 26 fields
- Ritual LLM payload: 30 fields
- Current live text model: `zai-org/GLM-4.7-FP8`

Production AA deployment is intentionally left behind a guarded adapter because the Ritual skills confirm the agent factory and precompile ABIs, but do not mandate one universal ERC-4337 smart-account factory for every app.

## Configure Environment

Copy `.env.example` to `.env.local` for local development.

```bash
NEXT_PUBLIC_RITUAL_CHAIN_ID=1979
NEXT_PUBLIC_RITUAL_EXPLORER_URL=https://explorer.ritualfoundation.org

RITUAL_RPC_URL=
RELAYER_PRIVATE_KEY=
PERSISTENT_AGENT_FACTORY_ADDRESS=0xD4AA9D55215dc8149Af57605e70921Ea16b73591
PERSISTENT_AGENT_PRECOMPILE_ADDRESS=0x0000000000000000000000000000000000000820
RITUAL_LLM_PRECOMPILE_ADDRESS=0x0000000000000000000000000000000000000802

DATABASE_URL=
MOCK_MODE=true
```

Only `NEXT_PUBLIC_*` values are available to the browser. Keep `RELAYER_PRIVATE_KEY` server-side only and keep only small testnet funds in that wallet.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Mock Mode

`MOCK_MODE=true` is the default for local UI testing. It creates fake local smart account addresses, fake Persistent Agent addresses, mock text responses, and fake tx hashes. The UI labels mock mode clearly.

Mock mode is not real on-chain execution. Production mode must not use fake tx hashes.

## Real Ritual Mode

Set `MOCK_MODE=false`, configure `RITUAL_RPC_URL`, and set a server-only `RELAYER_PRIVATE_KEY`.

Before production use, finish the app-specific AA adapter in `lib/ritual/smartAccount.ts` so each user gets exactly one permanent smart account and that smart account owns the Persistent Agent launcher. Do not replace this with one shared relayer-owned agent.

Real AA deployment is currently adapter-gated. The repo is mock-ready and safe to run locally, but production mode intentionally refuses to pretend that a relayer wallet is the user's smart account. The real provider/factory integration belongs in the `lib/ritual/*` adapter layer.

## Transaction Links

Every assistant response includes:

`https://explorer.ritualfoundation.org/tx/{txHash}`

The app polls `/api/tx/status?hash=...` until the status is `pending`, `confirmed`, or `failed`.

## Public Testnet Limits

- Max 1 AA smart account per wallet/session
- Max 1 Persistent Agent per AA smart account
- Max 20 chat messages per AA account per day
- Max 50 requests per IP per day
- Max prompt length: 1000 characters

These limits are enforced server-side for the local JSON storage v1.

## Security Notes

- Never commit `.env` or `.env.local`.
- Never expose private keys in frontend code.
- Never use `NEXT_PUBLIC_RELAYER_PRIVATE_KEY`.
- Do not accept arbitrary target addresses from the browser.
- Do not accept arbitrary calldata from the browser.
- Only submit approved Ritual chat calls from server-side adapters.
- Validate prompts and rate limits before relaying.
- Check relayer testnet balance before submitting transactions.

## Next Steps

- Select AA provider/factory.
- Wire real smart account deployment.
- Wire `PersistentAgentFactory` deployment through the user's AA account.
- Wire Ritual LLM transaction flow through the approved AA/session-key path.
- Test on Ritual Testnet.
