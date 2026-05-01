import { privateKeyToAccount } from "viem/accounts";
import { addDays } from "@/lib/time";
import { MOCK_MODE, RELAYER_PRIVATE_KEY, SESSION_KEY_TTL_DAYS } from "@/lib/config";
import { mockAddress } from "@/lib/mock";
import type { AgentSession } from "@/lib/types";

export async function createOrLoadSmartAccount(params: {
  sessionId: string;
  userWallet: string;
  existing?: AgentSession | null;
}) {
  const { sessionId, userWallet, existing } = params;
  if (existing) return existing.smartAccountAddress;

  if (MOCK_MODE) {
    return mockAddress(`aa:${userWallet || sessionId}`);
  }

  // Confirmed Ritual docs do not prescribe a single AA implementation. Production
  // deployments should integrate the chosen ERC-4337/passkey smart-account factory
  // here. The relayer may submit/sponsor the deploy, but the smart account owner
  // must be the user's wallet/session key, not the relayer.
  // TODO(real-aa): Select the AA provider/factory, deploy or load one account per
  // user wallet, and return the deterministic smart-account address from here.
  throw new Error("Smart account creation failed. Configure a production AA factory before disabling MOCK_MODE.");
}

export function getSmartAccountAddress(session: AgentSession) {
  return session.smartAccountAddress;
}

export async function createSessionKey(sessionId: string) {
  if (MOCK_MODE) {
    return {
      sessionKeyAddress: mockAddress(`session-key:${sessionId}`),
      sessionKeyExpiresAt: addDays(new Date(), SESSION_KEY_TTL_DAYS).toISOString(),
    };
  }

  if (!RELAYER_PRIVATE_KEY) {
    throw new Error("Relayer unavailable. Set RELAYER_PRIVATE_KEY on the server.");
  }

  // TODO(real-aa): Replace this placeholder with a scoped session key installed
  // on the user's AA account. It must only authorize chat/check/retry calls.
  const relayer = privateKeyToAccount(RELAYER_PRIVATE_KEY);
  return {
    sessionKeyAddress: relayer.address,
    sessionKeyExpiresAt: addDays(new Date(), SESSION_KEY_TTL_DAYS).toISOString(),
  };
}

export function validateSessionKey(session: AgentSession) {
  if (new Date(session.sessionKeyExpiresAt).getTime() <= Date.now()) {
    throw new Error("Session key creation failed. Please create a new chat session.");
  }
}
