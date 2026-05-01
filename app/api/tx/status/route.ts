import { NextResponse } from "next/server";
import { isHash } from "viem";
import { getTxStatus } from "@/lib/ritual/relayer";
import { updateTxStatus } from "@/lib/storage";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const hash = url.searchParams.get("hash");
    if (!hash || !isHash(hash)) {
      return NextResponse.json({ error: "Transaction failed. Invalid hash." }, { status: 400 });
    }

    const status = await getTxStatus(hash);
    if (status.status === "confirmed" || status.status === "failed") {
      await updateTxStatus(hash, status.status);
    }

    return NextResponse.json(status);
  } catch {
    return NextResponse.json({ error: "RPC unavailable. Please try again later." }, { status: 503 });
  }
}
