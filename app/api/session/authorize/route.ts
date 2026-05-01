import { NextResponse } from "next/server";
import { isAddress } from "viem";
import { MOCK_MODE } from "@/lib/config";
import { getRequestIp, checkIpRateLimit } from "@/lib/rateLimit";
import { buildSetSessionKeyCall, getSmartAccountOwner } from "@/lib/ritual/aa/realAAProvider";
import { getPublicClient } from "@/lib/ritual/chain";
import { createOrLoadSmartAccount, createSessionKey } from "@/lib/ritual/smartAccount";

export async function POST(request: Request) {
  try {
    const ip = getRequestIp(request);
    await checkIpRateLimit(ip, "session:authorize");

    const body = await request.json().catch(() => ({}));
    const walletAddress = typeof body.walletAddress === "string" ? body.walletAddress : null;
    if (!walletAddress) throw new Error("Missing walletAddress.");
    if (!isAddress(walletAddress)) throw new Error("Invalid EVM wallet address.");
    if (MOCK_MODE) {
      return NextResponse.json({
        sessionKeyStatus: "active",
        message: "Mock session key active.",
      });
    }

    const smartAccount = await createOrLoadSmartAccount({ userWallet: walletAddress });
    const smartAccountCode = await getPublicClient().getCode({ address: smartAccount.smartAccountAddress });
    if (!smartAccountCode || smartAccountCode === "0x") {
      throw new Error("Smart account has no code on Ritual Testnet. Create the smart account before authorizing chat.");
    }

    const owner = await getSmartAccountOwner(smartAccount.smartAccountAddress);
    if (owner.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error("Connected wallet is not the owner of this smart account.");
    }

    const sessionKey = await createSessionKey({
      walletAddress,
      smartAccountAddress: smartAccount.smartAccountAddress,
    });
    if (!isAddress(sessionKey.sessionKeyAddress)) {
      throw new Error("Session key address is invalid. Check RELAYER_PRIVATE_KEY.");
    }

    const expiresAtSeconds = BigInt(Math.floor(new Date(sessionKey.sessionKeyExpiresAt).getTime() / 1000));
    if (expiresAtSeconds <= BigInt(Math.floor(Date.now() / 1000))) {
      throw new Error("Session key expiry is not in the future. Check SESSION_KEY_TTL_HOURS.");
    }

    const data = buildSetSessionKeyCall(sessionKey.sessionKeyAddress, expiresAtSeconds);

    return NextResponse.json({
      requiresWalletSubmission: true,
      txRequest: {
        to: smartAccount.smartAccountAddress,
        data,
        value: "0",
      },
      sessionKeyAddress: sessionKey.sessionKeyAddress,
      sessionKeyExpiresAt: sessionKey.sessionKeyExpiresAt,
      message: "Authorize the limited chat session key in your wallet.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Session key authorization failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
