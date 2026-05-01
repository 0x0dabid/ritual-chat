import { isAddress, type Address } from "viem";
import {
  AA_BUNDLER_RPC_URL,
  AA_ENTRYPOINT_ADDRESS,
  AA_FACTORY_ADDRESS,
  AA_PAYMASTER_RPC_URL,
  AA_PROVIDER_KIND,
  AA_SESSION_KEY_MODULE_ADDRESS,
  SESSION_KEY_TTL_DAYS,
} from "@/lib/config";
import { addDays } from "@/lib/time";
import type {
  AAProviderAdapter,
  SessionKeyResult,
  UserOperationOrTx,
  UserOperationOrTxRequest,
} from "@/lib/ritual/aa/types";

const NOT_READY = "Real AA provider is not configured yet.";

export class RealAAProviderAdapter implements AAProviderAdapter {
  getProviderName() {
    return "RealAAProviderAdapter";
  }

  isConfigured() {
    if (AA_PROVIDER_KIND === "custom-factory") {
      return Boolean(AA_FACTORY_ADDRESS && isAddress(AA_FACTORY_ADDRESS));
    }

    if (AA_PROVIDER_KIND === "erc4337") {
      return Boolean(
        AA_FACTORY_ADDRESS &&
        isAddress(AA_FACTORY_ADDRESS) &&
        AA_ENTRYPOINT_ADDRESS &&
        isAddress(AA_ENTRYPOINT_ADDRESS) &&
        AA_BUNDLER_RPC_URL,
      );
    }

    if (AA_PROVIDER_KIND === "eip7702") {
      return Boolean(AA_SESSION_KEY_MODULE_ADDRESS && isAddress(AA_SESSION_KEY_MODULE_ADDRESS));
    }

    return false;
  }

  async createOrLoadSmartAccount(walletAddress: Address) {
    this.assertConfigured();
    return this.getSmartAccountAddress(walletAddress);
  }

  async getSmartAccountAddress(walletAddress: Address): Promise<Address> {
    this.assertConfigured();
    void walletAddress;

    // TODO(real-aa): For custom-factory and ERC-4337 modes, call the selected
    // factory's deterministic address function. For EIP-7702, the smart account
    // address may be the connected EOA after delegation, but only after Ritual
    // SetCodeTx support is verified end-to-end.
    throw new Error("Real AA smart account address derivation is not implemented yet.");
  }

  async createSessionKey(walletAddress: Address, smartAccountAddress: Address): Promise<SessionKeyResult> {
    this.assertConfigured();
    void walletAddress;
    void smartAccountAddress;

    // TODO(real-aa): Install a scoped session key on the user's smart account.
    // The key must only authorize chat/check/retry flows and must not authorize
    // transfers, arbitrary calls, owner changes, or relayer configuration.
    throw new Error("Real AA session key installation is not implemented yet.");
  }

  async validateSessionKey(sessionKeyAddress: Address) {
    this.assertConfigured();
    return isAddress(sessionKeyAddress) && addDays(new Date(), SESSION_KEY_TTL_DAYS).getTime() > Date.now();
  }

  async buildUserOperationOrTx(request: UserOperationOrTxRequest): Promise<UserOperationOrTx> {
    this.assertConfigured();
    void request;

    // TODO(real-aa): Build the provider-specific operation:
    // - custom-factory: relayed transaction from the user-owned account
    // - erc4337: UserOperation for EntryPoint/bundler/paymaster
    // - eip7702: SetCodeTx/delegated EOA transaction if supported by wallets
    throw new Error("Real AA transaction building is not implemented yet.");
  }

  private assertConfigured() {
    if (!this.isConfigured()) {
      const missing = getMissingConfiguration();
      throw new Error(missing.length ? `${NOT_READY} Missing: ${missing.join(", ")}.` : NOT_READY);
    }
  }
}

export function getMissingConfiguration() {
  if (AA_PROVIDER_KIND === "custom-factory") {
    return !AA_FACTORY_ADDRESS || !isAddress(AA_FACTORY_ADDRESS) ? ["AA_FACTORY_ADDRESS"] : [];
  }

  if (AA_PROVIDER_KIND === "erc4337") {
    const missing: string[] = [];
    if (!AA_FACTORY_ADDRESS || !isAddress(AA_FACTORY_ADDRESS)) missing.push("AA_FACTORY_ADDRESS");
    if (!AA_ENTRYPOINT_ADDRESS || !isAddress(AA_ENTRYPOINT_ADDRESS)) missing.push("AA_ENTRYPOINT_ADDRESS");
    if (!AA_BUNDLER_RPC_URL) missing.push("AA_BUNDLER_RPC_URL");
    return missing;
  }

  if (AA_PROVIDER_KIND === "eip7702") {
    return !AA_SESSION_KEY_MODULE_ADDRESS || !isAddress(AA_SESSION_KEY_MODULE_ADDRESS)
      ? ["AA_SESSION_KEY_MODULE_ADDRESS"]
      : [];
  }

  return ["AA_PROVIDER_KIND"];
}

export function getAAProviderEnvironmentSummary() {
  return {
    providerKind: AA_PROVIDER_KIND,
    factoryConfigured: Boolean(AA_FACTORY_ADDRESS),
    entryPointConfigured: Boolean(AA_ENTRYPOINT_ADDRESS),
    bundlerConfigured: Boolean(AA_BUNDLER_RPC_URL),
    paymasterConfigured: Boolean(AA_PAYMASTER_RPC_URL),
    sessionKeyModuleConfigured: Boolean(AA_SESSION_KEY_MODULE_ADDRESS),
  };
}
