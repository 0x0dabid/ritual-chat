import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { MOCK_MODE } from "@/lib/config";
import { getRequestIp, checkIpRateLimit } from "@/lib/rateLimit";
import { prepareSessionAuthorization } from "@/lib/ritual/sessionAuthorization";

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

    const preflight = await prepareSessionAuthorization({
      walletAddress: walletAddress as Address,
      createIfMissing: true,
    });

    return NextResponse.json({
      requiresWalletSubmission: true,
      txRequest: preflight.txRequest,
      sessionKeyAddress: preflight.expectedSessionKeyAddress,
      sessionKeyExpiresAt: preflight.sessionKeyExpiresAt,
      smartAccountOwner: preflight.smartAccountOwner,
      smartAccountAddress: preflight.smartAccountAddress,
      message: "Authorize the limited chat session key in your wallet.",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Session key authorization failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
