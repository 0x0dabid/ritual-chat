import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { MOCK_MODE } from "@/lib/config";
import { getRequestIp, checkIpRateLimit } from "@/lib/rateLimit";
import { buildSetSessionKeyCall } from "@/lib/ritual/aa/realAAProvider";
import { buildRealSession } from "@/lib/ritual/realSession";
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
    const sessionKey = await createSessionKey({
      walletAddress,
      smartAccountAddress: smartAccount.smartAccountAddress,
    });
    const expiresAtSeconds = BigInt(Math.floor(new Date(sessionKey.sessionKeyExpiresAt).getTime() / 1000));
    const data = buildSetSessionKeyCall(sessionKey.sessionKeyAddress, expiresAtSeconds);
    const session = await buildRealSession({
      walletAddress: walletAddress as Address,
      smartAccountAddress: smartAccount.smartAccountAddress,
      smartAccountDeploymentTxHash: smartAccount.deploymentTxHash,
    });

    return NextResponse.json({
      requiresWalletSubmission: true,
      txRequest: {
        to: smartAccount.smartAccountAddress,
        data,
        value: "0",
      },
      sessionKeyAddress: sessionKey.sessionKeyAddress,
      sessionKeyExpiresAt: sessionKey.sessionKeyExpiresAt,
      session,
      message: "Authorize the limited chat session key in your wallet.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Session key authorization failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
