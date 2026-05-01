import { NextResponse } from "next/server";
import { getSession, getSessionMessages } from "@/lib/storage";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  const session = await getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found." }, { status: 404 });
  }

  return NextResponse.json({
    smartAccountAddress: session.smartAccountAddress,
    persistentAgentAddress: session.persistentAgentAddress,
    sessionStatus: session.status,
    agentStatus: session.status,
    session,
    messages: await getSessionMessages(session.id),
  });
}
