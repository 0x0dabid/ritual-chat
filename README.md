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
STORAGE_DRIVER=memory
MOCK_MODE=false
```

Only `NEXT_PUBLIC_*` values are available to the browser. Keep `RELAYER_PRIVATE_KEY` server-side only and keep only small testnet funds in that wallet.

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Mock Mode

For local UI-only testing, explicitly set:

```bash
MOCK_MODE=true
NEXT_PUBLIC_MOCK_MODE=true
STORAGE_DRIVER=local-file
```

`MOCK_MODE=true` is available for local UI testing only. It creates fake local smart account addresses, fake Persistent Agent addresses, mock text responses, and fake tx hashes. The UI labels mock mode clearly.

Mock mode is not real on-chain execution. Production mode must not use fake tx hashes.

## Current Integration Status

- Mock mode works.
- Wallet connection is now used as the user identity layer.
- Real AA smart account deployment is still adapter-gated.
- `MockAAProviderAdapter` works.
- `RealAAProviderAdapter` exists but requires provider/factory configuration.
- Real `PersistentAgentFactory` integration is next.
- Real Ritual LLM transaction flow comes after AA provider/factory selection.
- The relayer does not own user agents.

## AA Provider Status

The AA provider layer lives under `lib/ritual/aa`.

- `MockAAProviderAdapter` is the default when `MOCK_MODE=true`.
- `RealAAProviderAdapter` exists for real mode, checks provider-specific environment variables, and can use `RitualChatSmartAccountFactory` when `AA_PROVIDER=custom` and `AA_FACTORY_ADDRESS` are configured.
- Real AA is still not considered complete until smart account deployment/loading is verified on Ritual Testnet.
- The relayer must never be used as the user's smart account or Persistent Agent owner.

See `docs/aa-provider-selection.md` for the current provider recommendation and remaining blockers.

## Custom Smart Account Factory

This repo includes the first custom AA path:

- `contracts/RitualChatSmartAccount.sol`
- `contracts/RitualChatSmartAccountFactory.sol`
- `scripts/deploy-smart-account-factory.ts`

Compile contracts:

```bash
npm run contracts:compile
```

Run contract tests:

```bash
npm run contracts:test
```

Deploy to Ritual Testnet:

```bash
RITUAL_RPC_URL=https://rpc.ritualfoundation.org
DEPLOYER_PRIVATE_KEY=0x...
npm run contracts:deploy:ritual
```

The deploy script prints `AA_FACTORY_ADDRESS=` and writes deployment metadata to:

```bash
deployments/ritual-smart-account-factory.json
```

Then set:

```bash
MOCK_MODE=false
AA_PROVIDER=custom
AA_FACTORY_ADDRESS=0x...
RITUAL_RPC_URL=https://rpc.ritualfoundation.org
RELAYER_PRIVATE_KEY=0x...
```

Complete in this milestone:

- deterministic smart account factory contract
- one smart account address per wallet owner
- allowlisted chat-call execution surface
- owner-only session key setup and owner-only arbitrary calls
- real adapter can deploy/load the smart account through the configured factory

Still pending:

- owner-authorized session key setup from the connected wallet
- PersistentAgentFactory launcher deployment through the smart account
- Ritual LLM transaction flow through the approved account/session-key path
- full Ritual Testnet verification of the deployed factory

## Persistent Agent Integration Status

The real Persistent Agent adapter lives in `lib/ritual/persistentAgent.ts`.

Current real-mode behavior:

- predicts the user's `PersistentAgentLauncher` from `PersistentAgentFactory.predictLauncher(smartAccountAddress, userSalt)`
- checks whether launcher bytecode already exists
- reports missing Persistent Agent configuration without faking an agent address
- builds the guarded `launchPersistentCompressed` call data once all required env vars are present
- keeps chat disabled until a real launcher is active and the session path is safe

The backend relayer does not call `PersistentAgentFactory` directly because that would make the relayer the launcher owner/controller. The next step is owner-authorized smart-account execution from the connected wallet.

See `docs/persistent-agent-integration.md` for the confirmed factory methods, required env vars, funding notes, events, and current blocker.

## Deploy Smart Account Factory to Ritual Testnet

Use a fresh deployer wallet with only testnet funds. Never commit `.env.local`.

1. Create or update `.env.local`:

```bash
RITUAL_RPC_URL=https://rpc.ritualfoundation.org
DEPLOYER_PRIVATE_KEY=0x...
RELAYER_PRIVATE_KEY=
AA_PROVIDER=custom
AA_FACTORY_ADDRESS=
```

`DEPLOYER_PRIVATE_KEY` is server-only. Do not prefix it with `NEXT_PUBLIC_`.

2. Compile contracts:

```bash
npm run contracts:compile
```

3. Run tests:

```bash
npm run contracts:test
```

4. Deploy the factory:

```bash
npm run contracts:deploy:aa
```

The deploy script prints the deployer address, network chain ID, deployment transaction hash, and:

```bash
AA_FACTORY_ADDRESS=0x...
```

It also writes deployment metadata to:

```bash
deployments/ritual-smart-account-factory.json
```

5. Copy the printed factory address into `.env.local`:

```bash
AA_FACTORY_ADDRESS=0x...
```

6. Verify one wallet can create or load a smart account:

```bash
TEST_OWNER_ADDRESS=0xYourWalletAddress
npm run contracts:verify:aa
```

By default, the verification script creates the predicted smart account if no code exists. To make it read-only:

```bash
CREATE_ACCOUNT_IF_MISSING=false npm run contracts:verify:aa
```

The verification script prints the owner wallet, predicted smart account, whether account code exists, and the create-account transaction hash if it deployed one.

### Deployment Troubleshooting

- Missing `RITUAL_RPC_URL`: set it in `.env.local`, for example `https://rpc.ritualfoundation.org`.
- Missing `DEPLOYER_PRIVATE_KEY`: set a server-only deployer key, or use `RELAYER_PRIVATE_KEY` only if that key is intended to deploy contracts.
- Deployment reverted: confirm the deployer has testnet RITUAL, the RPC is Ritual Testnet, and the contracts compile locally.
- Insufficient testnet gas: fund the deployer from the Ritual faucet, then rerun the deploy command.
- `AA_FACTORY_ADDRESS` not set: copy the printed `AA_FACTORY_ADDRESS=0x...` value into `.env.local`.
- `createAccount` fails: confirm `AA_FACTORY_ADDRESS` points to `RitualChatSmartAccountFactory` on chain ID `1979`.
- No code found at predicted smart account: rerun `npm run contracts:verify:aa` with `CREATE_ACCOUNT_IF_MISSING=true` and a funded deployer key.

## Real Ritual Mode

Set `MOCK_MODE=false`, configure `RITUAL_RPC_URL`, and set a server-only `RELAYER_PRIVATE_KEY`.

Before production use, finish the app-specific AA adapter in `lib/ritual/smartAccount.ts` so each user gets exactly one permanent smart account and that smart account owns the Persistent Agent launcher. Do not replace this with one shared relayer-owned agent.

Real AA deployment is currently adapter-gated. The repo is mock-ready and safe to run locally, but production mode intentionally refuses to pretend that a relayer wallet is the user's smart account. The real provider/factory integration belongs in the `lib/ritual/*` adapter layer.

## Vercel Real Mode

For Vercel, run the app with:

```bash
MOCK_MODE=false
NEXT_PUBLIC_MOCK_MODE=false
AA_PROVIDER=custom
STORAGE_DRIVER=memory
NEXT_PUBLIC_RITUAL_CHAIN_ID=1979
NEXT_PUBLIC_RITUAL_EXPLORER_URL=https://explorer.ritualfoundation.org
NEXT_PUBLIC_RITUAL_RPC_URL=https://rpc.ritualfoundation.org
RITUAL_RPC_URL=https://rpc.ritualfoundation.org
AA_FACTORY_ADDRESS=0x98fb3c3Cb0291E43D138dA1051a7b98Bfa75eda0
PERSISTENT_AGENT_FACTORY_ADDRESS=0xD4AA9D55215dc8149Af57605e70921Ea16b73591
PERSISTENT_AGENT_PRECOMPILE_ADDRESS=0x0820
```

In real mode, RITUAL CHAT does not use file-based session storage on Vercel. The connected `walletAddress` is the session identity, and the deterministic smart account is derived from the onchain `RitualChatSmartAccountFactory`. Smart Account status is determined by checking code at the predicted smart account address.

File-backed JSON storage remains for mock/local testing only and is disabled on Vercel real mode. A database should be added later for chat history and durable session records, not as the source of truth for smart account ownership.

Storage drivers:

- `STORAGE_DRIVER=memory`: ephemeral request/runtime cache, suitable for Vercel real-mode account lookup because onchain state remains the source of truth.
- `STORAGE_DRIVER=local-file`: local development only. Vercel automatically refuses this path.
- `STORAGE_DRIVER=database`: reserved for future persistent chat history/session records. Until a database adapter is implemented, production features that need persistence return `Database storage is required for this production feature.`

Never set `NEXT_PUBLIC_RELAYER_PRIVATE_KEY`. If backend transaction submission is enabled later, `RELAYER_PRIVATE_KEY` must stay server-side only.

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
- Never use `NEXT_PUBLIC_DEPLOYER_PRIVATE_KEY`.
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
