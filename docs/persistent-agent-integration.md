# Persistent Agent Integration

This document records the current Ritual Chat integration plan for real Persistent Agents on Ritual Testnet.

Sources checked on 2026-05-01:

- `ritual-foundation/ritual-dapp-skills/examples/persistent-agent`
- `ritual-foundation/ritual-dapp-skills/skills/ritual-dapp-agents/SKILL.md`

Do not guess Persistent Agent configuration values. Persistent Agent creation requires real Ritual executor, LLM, DA, DKMS, and scheduler configuration. Do not use placeholder values.

## Selected Flow

Use `PersistentAgentFactory` factory-backed launcher mode, not direct `0x0820` precompile calls from the relayer.

Factory:

```text
0xD4AA9D55215dc8149Af57605e70921Ea16b73591
```

The intended ownership path remains:

```text
connected wallet -> Ritual Chat Smart Account -> PersistentAgentFactory -> PersistentAgentLauncher
```

The Persistent Agent launcher must be created with the user smart account as `msg.sender`, so the relayer does not become the owner/controller.

## Factory Methods

The latest Ritual dApp Skills repo documents these Persistent Agent factory methods:

```solidity
predictLauncher(address owner, bytes32 userSalt) returns (address launcher, bytes32 childSalt)
predictCompressedLauncher(address owner, bytes32 userSalt) returns (address launcher, bytes32 compressedSalt, bytes32 childSalt)
getDkmsDerivation(address owner, bytes32 userSalt) returns (address dkmsOwner, uint256 keyIndex, uint8 keyFormat)
deployLauncher(bytes32 userSalt) returns (address launcher)
launchPersistentCompressed(
  bytes32 userSalt,
  address executor,
  uint64 dkmsTtl,
  uint256 dkmsFunding,
  bytes persistentInput,
  PersistentLaunchSchedule schedule,
  uint256 schedulerLockDuration,
  uint256 schedulerFunding
) payable returns (address launcher, address dkmsPaymentAddress, uint256 callId)
launchPersistentWithDerivedDkms(...)
```

`launchPersistentCompressed` remains the preferred v1 production path because it performs DKMS derivation, funding, launcher deployment, and scheduler arming in one atomic transaction. Ritual Chat still keeps this path guarded until owner-authorized smart account execution is wired.

## Required Config Table

These values are server-side deployment configuration. Do not prefix any secret or ciphertext value with `NEXT_PUBLIC_`.

| Env var | What it means | Example format only | Where to get it | Public or secret | Required for agent creation | Safe in Vercel |
|---|---|---|---|---|---|---|
| `PERSISTENT_AGENT_EXECUTOR_ADDRESS` | TEE executor address used by the Persistent Agent and DKMS/secrets flow. | `0x...` selected executor address | Query `TEEServiceRegistry.getServicesByCapability(0, true)` and use `node.teeAddress`, or use a Ritual team-provided live executor for testing. | Public address | Yes | Yes, server env is fine |
| `PERSISTENT_AGENT_LLM_PROVIDER` | Provider enum passed to the Persistent Agent payload. Supported Persistent Agent values are `0`/`anthropic`, `1`/`openai`, `2`/`gemini`, `3`/`xai`, `4`/`openrouter`. | `4` for OpenRouter | Choose based on the LLM credential included in encrypted secrets. The `ritual` provider is not available for Persistent Agent in the current skills docs. | Public config | Yes | Yes |
| `PERSISTENT_AGENT_MODEL` | Exact provider-routable model id. There is no safe default for production. | `provider-model-id` | Provider documentation/account dashboard, then verify with a direct provider API call before encrypting credentials. | Public config | Yes | Yes |
| `PERSISTENT_AGENT_LLM_API_KEY_REF` | Key name the executor uses to find the LLM API key inside `PERSISTENT_AGENT_ENCRYPTED_SECRETS`. | `LLM_API_KEY` | Choose a stable key name and include the same key in the encrypted JSON secrets map. | Public reference name, not the key | Yes | Yes |
| `PERSISTENT_AGENT_DA_PROVIDER` | Data Availability backend for persistent state continuity. Persistent Agents require DA. | `hf`, `gcs`, or `pinata` | Choose one supported DA provider from the skills example. | Public config | Yes | Yes |
| `PERSISTENT_AGENT_DA_PATH` | Base workspace path where Ritual Chat builds `manifest.json`, `SOUL.md`, `MEMORY.md`, `IDENTITY.md`, and `TOOLS.md` references. | `org/repo/agent-id`, `bucket-prefix/agent-id`, or provider-specific path | The DA resource you control: Hugging Face dataset path, GCS prefix, or Pinata path convention. | Public path unless provider says otherwise | Yes | Yes |
| `PERSISTENT_AGENT_DA_KEY_REF` | Key name the executor uses to find DA credentials inside encrypted secrets. | `HF_TOKEN`, `GCS_CREDENTIALS`, or `DA_PINATA_JWT` | Match the selected DA provider and include the same key in the encrypted JSON secrets map. | Public reference name, not the credential | Yes | Yes |
| `PERSISTENT_AGENT_ENCRYPTED_SECRETS` | ECIES ciphertext containing LLM and DA credentials encrypted to the selected executor public key. | `0x...` ciphertext | Fetch `node.publicKey` from `TEEServiceRegistry`, set ECIES symmetric nonce length to 12, and encrypt a JSON map containing the LLM and DA credentials. | Treat as secret/ciphertext | Yes | Yes, server env only |
| `PERSISTENT_AGENT_DKMS_FUNDING_WEI` | Native token amount sent to the derived DKMS payment/heartbeat address. | `1000000000000000000` | Pick based on Ritual testnet funding guidance and heartbeat requirements. The direct example funds the child DKMS address so heartbeat registration can operate. | Public amount | Yes | Yes |
| `PERSISTENT_AGENT_SCHEDULER_FUNDING_WEI` | Native token amount deposited for scheduled launcher execution. | `1000000000000000000` | Estimate from Scheduler/RitualWallet needs and testnet gas costs. Must be funded enough for launch. | Public amount | Yes | Yes |
| `PERSISTENT_AGENT_SCHEDULER_LOCK_DURATION` | RitualWallet lock duration in blocks for scheduler funding. | `1000000` | Choose a block duration long enough for scheduled execution and async settlement. Use Ritual block-time guidance when choosing this. | Public amount | Yes | Yes |

Current UI missing-config lists should use `PERSISTENT_AGENT_SCHEDULER_LOCK_DURATION`. If a note or screenshot says `PERSISTENT_AGENT_SCHEDULE_R_LOCK_DURATION`, treat that as a typo and use the canonical env var above.

Related adapter/system values:

| Env var | Meaning | Source |
|---|---|---|
| `RITUAL_RPC_URL` | Server-side Ritual Testnet RPC URL. | Ritual RPC endpoint, for example `https://rpc.ritualfoundation.org`. |
| `PERSISTENT_AGENT_FACTORY_ADDRESS` | Factory contract used for launcher mode. | Known Ritual factory address `0xD4AA9D55215dc8149Af57605e70921Ea16b73591`; verify code exists before launch. |
| `PERSISTENT_AGENT_PRECOMPILE_ADDRESS` | Persistent Agent precompile. | `0x0000000000000000000000000000000000000820`. |

Optional scheduling/gas defaults in the current adapter:

| Env var | Default | Meaning |
|---|---:|---|
| `PERSISTENT_AGENT_SCHEDULER_GAS` | `8000000` | Scheduler gas limit for launcher execution. |
| `PERSISTENT_AGENT_SCHEDULER_TTL` | `500` | Scheduler TTL in blocks. |
| `PERSISTENT_AGENT_MAX_FEE_PER_GAS` | `1000000000` | Max fee per gas for delivery/scheduler settings. |
| `PERSISTENT_AGENT_MAX_PRIORITY_FEE_PER_GAS` | `100000000` | Max priority fee per gas. |

## Persistent Agent Config Checklist

Executor config:

- Discover a live HTTP_CALL executor through `TEEServiceRegistry.getServicesByCapability(0, true)`.
- Use `node.teeAddress` for `PERSISTENT_AGENT_EXECUTOR_ADDRESS`.
- Use `node.publicKey` for ECIES encryption. Do not use the executor endpoint as a dApp routing target.

LLM config:

- Choose `PERSISTENT_AGENT_LLM_PROVIDER` from `0`/`anthropic`, `1`/`openai`, `2`/`gemini`, `3`/`xai`, or `4`/`openrouter`.
- Set `PERSISTENT_AGENT_MODEL` to a model id that the provider account can actually call.
- Put the raw LLM API key only inside the encrypted secrets JSON.
- Set `PERSISTENT_AGENT_LLM_API_KEY_REF` to the JSON key name, for example `LLM_API_KEY`.

### DeepSeek Through OpenRouter

The latest Ritual dApp Skills Persistent Agent docs confirm this provider enum:

```text
0 = Anthropic
1 = OpenAI
2 = Gemini
3 = xAI
4 = OpenRouter
```

OpenRouter provider enum `4` is supported for Persistent Agent. DeepSeek can be reached through OpenRouter by using an OpenRouter-routable DeepSeek model id:

```bash
PERSISTENT_AGENT_LLM_PROVIDER=4
PERSISTENT_AGENT_MODEL=deepseek/deepseek-chat
PERSISTENT_AGENT_LLM_API_KEY_REF=OPENROUTER_API_KEY
```

`PERSISTENT_AGENT_LLM_API_KEY_REF` is only the secret name the executor looks up after decrypting `PERSISTENT_AGENT_ENCRYPTED_SECRETS`. It is not the raw API key.

The encrypted secrets bundle must contain the OpenRouter key and the selected DA credential. For example, if the DA provider is Hugging Face, the decrypted JSON shape should be:

```json
{
  "OPENROUTER_API_KEY": "<real OpenRouter API key>",
  "HF_TOKEN": "<real Hugging Face token>"
}
```

Encrypt that JSON to the selected executor public key from `TEEServiceRegistry.getServicesByCapability(0, true)` using ECIES with symmetric nonce length `12`. Store only the resulting ciphertext in `PERSISTENT_AGENT_ENCRYPTED_SECRETS`.

Before submitting a real Persistent Agent transaction, verify the OpenRouter account can call `deepseek/deepseek-chat` directly. Do not submit placeholder keys, placeholder DA tokens, or untested model identifiers.

DA config:

- Choose exactly one DA provider: `hf`, `gcs`, or `pinata`.
- For `hf`, use a Hugging Face token and dataset/repo you control.
- For `gcs`, use a service account JSON and bucket/prefix you control.
- For `pinata`, use a Pinata JWT and optional gateway.
- Put raw DA credentials only inside encrypted secrets.

DKMS config:

- Build `PERSISTENT_AGENT_ENCRYPTED_SECRETS` by encrypting the LLM and DA credential map to the selected executor public key.
- Use ECIES with symmetric nonce length `12`, matching the skills repo.
- Make sure the encrypted map contains every key referenced by `PERSISTENT_AGENT_LLM_API_KEY_REF` and `PERSISTENT_AGENT_DA_KEY_REF`.

Scheduler config:

- Set `PERSISTENT_AGENT_SCHEDULER_LOCK_DURATION` to a block duration that remains valid through scheduling and async settlement.
- Optional scheduler gas/TTL values can stay at the adapter defaults until real testnet runs show otherwise.

Funding config:

- Fund the user smart account and/or owner-authorized launch transaction path enough to pay `dkmsFunding + schedulerFunding`.
- Set `PERSISTENT_AGENT_DKMS_FUNDING_WEI` for the derived DKMS payment/heartbeat address.
- Set `PERSISTENT_AGENT_SCHEDULER_FUNDING_WEI` for launcher scheduled execution.
- Keep only testnet funds in deployer/relayer wallets.

## Payload Requirements

The `persistentInput` argument is the full 26-field `0x0820` payload. The delivery target must match:

```text
predictCompressedLauncher(smartAccountAddress, userSalt)
```

for compressed mode.

Persistent Agent requires DA-backed state. The adapter currently maps the configured base path into:

- `daConfig`: `<base>/manifest.json`
- `soulRef`: `<base>/SOUL.md`
- `memoryRef`: `<base>/MEMORY.md`
- `identityRef`: `<base>/IDENTITY.md`
- `toolsRef`: `<base>/TOOLS.md`

API keys and DA credentials must be ECIES-encrypted to the selected executor public key and passed via `PERSISTENT_AGENT_ENCRYPTED_SECRETS`.

## Funding And DKMS

The compressed launch requires:

```text
msg.value == dkmsFunding + schedulerFunding
```

`dkmsFunding` funds the derived DKMS payment address used by the Persistent Agent for heartbeat/liveness operations.

`schedulerFunding` deposits into the launcher RitualWallet balance and is used to arm the scheduler call that triggers persistent spawn.

## Events

The adapter parses these factory events:

```solidity
event LauncherDeployed(address indexed owner, bytes32 indexed userSalt, bytes32 indexed childSalt, address launcher);
event PersistentLaunchCompressed(address indexed owner, bytes32 indexed userSalt, address indexed launcher, address dkmsPaymentAddress, uint256 schedulerCallId);
event PersistentLaunchFromDerivedDkms(address indexed owner, bytes32 indexed userSalt, address indexed launcher, address dkmsPaymentAddress, uint256 schedulerCallId);
```

These events identify the launcher address. Explorer recognition should be based on the launcher address and the factory transaction hash.

## Known Blockers

- Ritual team-provided executor or live testnet executor: needed if public registry discovery does not return a healthy HTTP_CALL executor.
- Encrypted secret setup: raw LLM and DA credentials must be encrypted to the selected executor public key before launch.
- DKMS payment address/funding: the derived DKMS address must be fundable and funded enough for heartbeat/liveness operations.
- Scheduler funding: launcher scheduled execution requires sufficient RitualWallet funding and lock duration.
- DA provider credentials: Persistent Agents cannot spawn without a working DA provider and write-capable credentials.
- Owner authorization: the deployed `RitualChatSmartAccount` can execute owner calls only when the connected wallet owner authorizes them. The backend relayer must not call `PersistentAgentFactory` directly because that would make the relayer the owner/controller.

Current real-mode behavior:

- load/deploy the user smart account
- predict the Persistent Agent launcher address
- detect an existing launcher if code already exists
- report missing Persistent Agent config clearly
- keep Persistent Agent pending when owner-authorized smart-account execution is not wired
- keep chat disabled

Next implementation step:

```text
connected wallet signs owner-authorized smart-account execution
-> smart account calls PersistentAgentFactory.launchPersistentCompressed
-> factory deploys/arms PersistentAgentLauncher owned by the smart account
```

The app must keep Persistent Agent pending in all blocked cases and must not fake a launcher address, fake a transaction hash, or enable real-mode chat.
