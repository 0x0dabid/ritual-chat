import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";
import { inspectSessionAuthorization } from "@/lib/ritual/sessionAuthorization";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const walletAddress = url.searchParams.get("walletAddress");
  if (!walletAddress || !isAddress(walletAddress)) {
    return NextResponse.json({ error: "Invalid EVM wallet address." }, { status: 400 });
  }

  const result = await inspectSessionAuthorization(walletAddress as Address);
  return NextResponse.json({
    walletAddress: result.walletAddress,
    smartAccountAddress: result.smartAccountAddress,
    smartAccountCodeExists: result.smartAccountCodeExists,
    smartAccountOwner: result.smartAccountOwner,
    expectedSessionKeyAddress: result.expectedSessionKeyAddress,
    expiresAt: result.expiresAt,
    isOwner: result.isOwner,
    canSimulateSetSessionKey: result.canSimulateSetSessionKey,
    simulationError: result.simulationError,
  });
}
