import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AgentSession, AppData, ChatMessage, RateLimitRecord } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "data");
const DATA_FILE = path.join(DATA_DIR, "ritual-chat.json");

const initialData: AppData = {
  sessions: [],
  messages: [],
  rateLimits: [],
};

async function readData(): Promise<AppData> {
  try {
    const raw = await readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as AppData;
  } catch {
    return structuredClone(initialData);
  }
}

async function writeData(data: AppData) {
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

export async function getSession(sessionId: string) {
  const data = await readData();
  return data.sessions.find((session) => session.id === sessionId) ?? null;
}

export async function getSessionByWallet(userWallet: string) {
  const data = await readData();
  return data.sessions.find((session) => (
    session.userWallet.toLowerCase() === userWallet.toLowerCase()
  )) ?? null;
}

export async function getSessionMessages(sessionId: string) {
  const data = await readData();
  return data.messages.filter((message) => message.sessionId === sessionId);
}

export async function upsertSession(session: AgentSession) {
  const data = await readData();
  const index = data.sessions.findIndex((item) => item.id === session.id);
  if (index >= 0) data.sessions[index] = session;
  else data.sessions.push(session);
  await writeData(data);
  return session;
}

export async function addChatMessage(message: ChatMessage) {
  const data = await readData();
  data.messages.push(message);
  await writeData(data);
  return message;
}

export async function updateTxStatus(txHash: string, txStatus: ChatMessage["txStatus"]) {
  const data = await readData();
  data.messages = data.messages.map((message) => (
    message.txHash === txHash ? { ...message, txStatus } : message
  ));
  await writeData(data);
}

export async function countMessagesForSmartAccountToday(smartAccountAddress: string) {
  const data = await readData();
  const today = new Date().toISOString().slice(0, 10);
  const sessionIds = data.sessions
    .filter((session) => session.smartAccountAddress === smartAccountAddress)
    .map((session) => session.id);

  return data.messages.filter((message) => (
    sessionIds.includes(message.sessionId) &&
    message.role === "user" &&
    message.createdAt.slice(0, 10) === today
  )).length;
}

export async function incrementRateLimit(match: Omit<RateLimitRecord, "id" | "count" | "date">) {
  const data = await readData();
  const date = new Date().toISOString().slice(0, 10);
  const existing = data.rateLimits.find((record) => (
    record.date === date &&
    record.requestType === match.requestType &&
    record.ip === match.ip &&
    record.wallet === match.wallet &&
    record.smartAccountAddress === match.smartAccountAddress
  ));

  if (existing) existing.count += 1;
  else {
    data.rateLimits.push({
      ...match,
      id: crypto.randomUUID(),
      count: 1,
      date,
    });
  }
  await writeData(data);
  return existing?.count ?? 1;
}
