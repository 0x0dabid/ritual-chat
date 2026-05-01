# Persistent Agent Integration

This document records the current Ritual Chat integration plan for real Persistent Agents on Ritual Testnet.

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

`launchPersistentCompressed` is the recommended v1 production path because it performs DKMS derivation, funding, launcher deployment, and scheduler arming in one atomic transaction.

## Required Inputs

Persistent Agent launch requires:

- `PERSISTENT_AGENT_FACTORY_ADDRESS`
- `PERSISTENT_AGENT_EXECUTOR_ADDRESS`
- `PERSISTENT_AGENT_LLM_PROVIDER`
- `PERSISTENT_AGENT_MODEL`
- `PERSISTENT_AGENT_LLM_API_KEY_REF`
- `PERSISTENT_AGENT_DA_PROVIDER`
- `PERSISTENT_AGENT_DA_PATH`
- `PERSISTENT_AGENT_DA_KEY_REF`
- `PERSISTENT_AGENT_ENCRYPTED_SECRETS`
- `PERSISTENT_AGENT_DKMS_FUNDING_WEI`
- `PERSISTENT_AGENT_SCHEDULER_FUNDING_WEI`
- `PERSISTENT_AGENT_SCHEDULER_LOCK_DURATION`

Optional defaults:

- `PERSISTENT_AGENT_SCHEDULER_GAS=8000000`
- `PERSISTENT_AGENT_SCHEDULER_TTL=500`
- `PERSISTENT_AGENT_MAX_FEE_PER_GAS=1000000000`
- `PERSISTENT_AGENT_MAX_PRIORITY_FEE_PER_GAS=100000000`

Persistent Agent provider enum:

```text
0 = anthropic
1 = openai
2 = gemini
3 = xai
4 = openrouter
```

The latest skills repo explicitly notes that the `ritual` provider is not available for Persistent Agent. It is available for Sovereign Agent, but this app intentionally uses Persistent Agent.

## Payload Requirements

The `persistentInput` argument is the full 26-field `0x0820` payload. The delivery target must match:

```text
predictCompressedLauncher(smartAccountAddress, userSalt)
```

for compressed mode.

Persistent Agent requires DA-backed state. At least one DA provider must be configured. DA references are used for:

- `daConfig`
- `soulRef`
- `memoryRef`
- `identityRef`
- `toolsRef`

API keys and DA credentials must be ECIES-encrypted to the selected executor public key and passed via `PERSISTENT_AGENT_ENCRYPTED_SECRETS`.

## Funding And DKMS

The compressed launch requires:

```text
msg.value == dkmsFunding + schedulerFunding
```

`dkmsFunding` funds the derived DKMS payment address used by the Persistent Agent for heartbeat/liveness operations. The skills repo recommends large development funding for DKMS heartbeat reliability.

`schedulerFunding` deposits into the launcher RitualWallet balance and is used to arm the one-shot scheduler call that triggers persistent spawn.

## Events

The adapter parses these factory events:

```solidity
event LauncherDeployed(address indexed owner, bytes32 indexed userSalt, bytes32 indexed childSalt, address launcher);
event PersistentLaunchCompressed(address indexed owner, bytes32 indexed userSalt, address indexed launcher, address dkmsPaymentAddress, uint256 schedulerCallId);
event PersistentLaunchFromDerivedDkms(address indexed owner, bytes32 indexed userSalt, address indexed launcher, address dkmsPaymentAddress, uint256 schedulerCallId);
```

These events identify the launcher address. Explorer recognition should be based on the launcher address and the factory transaction hash.

## Current Blocker

The deployed `RitualChatSmartAccount` can execute arbitrary owner calls only when `msg.sender` is the connected wallet owner. The backend relayer cannot call `executeOwnerCall`, and it must not call `PersistentAgentFactory` directly because that would make the relayer the owner/controller.

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

## If Ritual Infra Is Unavailable

Persistent Agent creation remains blocked if:

- no valid HTTP_CALL executor is available
- DKMS extraction/funding is unavailable
- RitualWallet funding is insufficient
- DA credentials are missing or invalid
- encrypted secrets cannot be decrypted by the selected executor
- the owner wallet has not authorized the smart account factory call

The app must keep Persistent Agent pending in all of these cases and must not fake a launcher address or enable real-mode chat.
