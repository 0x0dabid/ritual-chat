# AA Provider Selection

This document records the first Account Abstraction provider decision for RITUAL CHAT.

## Goal

RITUAL CHAT needs one permanent smart account per connected wallet. That smart account must own the user's Persistent Ritual Agent. The backend relayer may sponsor or submit approved operations, but it must not become the owner of the smart account or Persistent Agent.

Target architecture:

`connected wallet -> permanent AA smart account -> owns Persistent Ritual Agent -> uses Ritual LLM -> returns tx hash`

## Options Considered

### 1. Simple Custom Smart Account Factory

A small app-owned factory deploys deterministic smart accounts for each wallet. The account can expose a narrow execution surface for approved chat operations and can later add a scoped session key module.

Pros:
- Direct control over ownership rules.
- No dependency on third-party bundler availability.
- Easy to verify that the relayer is not the owner.
- Fits the current adapter structure and local storage model.

Cons:
- Requires contract work, audits, deployment, and testnet verification.
- Session-key authorization must be implemented carefully.
- Gas sponsorship needs an app relayer policy until a more standard paymaster path exists.

### 2. ERC-4337 Smart Account

Use a standard smart account plus EntryPoint, bundler, and optional paymaster. This is the most common production AA shape across EVM chains.

Pros:
- Familiar architecture with UserOperations, bundlers, EntryPoint, and paymasters.
- Good path for sponsored gas and session keys if Ritual-compatible infrastructure exists.
- Can reuse known smart-account patterns.

Cons:
- Requires a Ritual-compatible bundler and EntryPoint deployment.
- Paymaster support must be verified before public gas sponsorship.
- If no bundler/paymaster exists for Ritual Testnet, the app cannot complete the flow.

### 3. EIP-7702 / Ritual Native Account Delegation

Ritual documentation says Ritual Chain supports EIP-7702 account abstraction. This lets an EOA delegate smart-account behavior without deploying a separate account address.

Pros:
- Ritual-native direction according to current Ritual docs.
- Avoids ERC-4337 bundler dependency.
- Potentially cleaner UX once wallet support is mature.

Cons:
- Wallet support and revocation UX must be verified.
- The product requirement says each user gets a permanent AA smart account; 7702 may keep the EOA address as the account identity rather than deploying a separate factory account.
- Session-key and relayer flows still need a concrete delegation contract.

### 4. Third-Party Embedded Wallet AA

Privy, Dynamic, ZeroDev, Biconomy, Safe, Gelato, Alchemy, or thirdweb may provide smart-account UX and infrastructure.

Pros:
- Faster to integrate if Ritual Testnet is supported.
- Some providers include paymaster, session key, or embedded wallet flows.

Cons:
- Chain support for Ritual Testnet must be confirmed.
- Can add unnecessary product complexity for a simple public text chat.
- Vendor lock-in may make agent ownership harder to reason about.

## Selected V1 Path

The selected v1 path is a simple custom smart account factory.

The custom factory path is the clearest way to preserve the required ownership model:

`wallet owner -> deterministic smart account -> PersistentAgentFactory deployLauncher -> user-owned Persistent Agent`

ERC-4337 remains a good option if Ritual-compatible bundler, EntryPoint, and paymaster infrastructure is available. EIP-7702 should be revisited because Ritual documents it as supported, but it needs an explicit delegation/session-key contract and wallet support verification before it can be called complete.

## Environment Variables

The real adapter currently checks these variables depending on `AA_PROVIDER_KIND`:

```bash
AA_PROVIDER=custom
AA_FACTORY_ADDRESS=

AA_PROVIDER=erc4337
AA_FACTORY_ADDRESS=
AA_ENTRYPOINT_ADDRESS=
AA_BUNDLER_RPC_URL=
AA_PAYMASTER_RPC_URL=

AA_PROVIDER=eip7702
AA_SESSION_KEY_MODULE_ADDRESS=
```

`AA_PAYMASTER_RPC_URL` is optional until sponsored ERC-4337 gas is implemented.

## Contracts To Deploy

For the recommended custom-factory path:

- `RitualChatSmartAccountFactory`
- `RitualChatSmartAccount`
- optional `RitualChatSessionKeyModule`

The smart account must:

- be owned by the connected wallet
- support deterministic lookup by wallet address
- allow only approved chat calls through the session key
- block arbitrary target addresses and arbitrary calldata
- call `PersistentAgentFactory.deployLauncher(bytes32)` as the smart account, not as the relayer

## Blockers

Real AA is not complete until these are verified on Ritual Testnet:

- smart account factory deployment
- deterministic smart account address derivation
- owner binding to the connected wallet
- session key installation and expiry
- relayed/sponsored execution without relayer ownership
- `PersistentAgentFactory` launcher deployment from the smart account
- Ritual LLM transaction execution through the approved account/session-key path

If Ritual-specific ERC-4337 bundler/paymaster infrastructure is unavailable, use the custom factory path or a verified EIP-7702 delegation flow instead.

## References

- Ritual Account Abstraction docs: https://www.ritualfoundation.org/docs/whats-new/evm%2B%2B/account-abstraction
- ERC-4337 documentation: https://docs.erc4337.io/resources/faqs.html
- EIP-4337 overview: https://eips.ethereum.org/EIPS/eip-4337
- EIP-7702: https://eips.ethereum.org/EIPS/eip-7702
