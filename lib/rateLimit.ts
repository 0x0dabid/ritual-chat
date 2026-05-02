import {
  MAX_CHAT_MESSAGES_PER_AA_PER_DAY,
  MAX_REQUESTS_PER_IP_PER_DAY,
} from "@/lib/config";
import { countMessagesForSmartAccountToday, countMessagesForWalletToday, incrementRateLimit } from "@/lib/storage";

export async function checkIpRateLimit(ip: string, requestType: string) {
  const count = await incrementRateLimit({ ip, requestType });
  if (count > MAX_REQUESTS_PER_IP_PER_DAY) {
    throw new Error("You've reached the public test limit for today.");
  }
}

export async function checkWalletRateLimit(ip: string, wallet: string, requestType: string) {
  const count = await incrementRateLimit({ ip, wallet, requestType });
  if (count > MAX_REQUESTS_PER_IP_PER_DAY) {
    throw new Error("You've reached the public test limit for today.");
  }
}

export async function checkSmartAccountRateLimit(ip: string, smartAccountAddress: string, requestType: string) {
  const dailyMessages = await countMessagesForSmartAccountToday(smartAccountAddress);
  if (dailyMessages >= MAX_CHAT_MESSAGES_PER_AA_PER_DAY) {
    throw new Error("You've reached the public test limit for today.");
  }

  const count = await incrementRateLimit({ ip, smartAccountAddress, requestType });
  if (count > MAX_REQUESTS_PER_IP_PER_DAY) {
    throw new Error("You've reached the public test limit for today.");
  }
}

export async function checkWalletChatRateLimit(ip: string, wallet: string, requestType: string) {
  const dailyMessages = await countMessagesForWalletToday(wallet);
  if (dailyMessages >= MAX_CHAT_MESSAGES_PER_AA_PER_DAY) {
    throw new Error("You've reached the public test limit for today.");
  }

  const count = await incrementRateLimit({ ip, wallet, requestType });
  if (count > MAX_REQUESTS_PER_IP_PER_DAY) {
    throw new Error("You've reached the public test limit for today.");
  }
}

export function getRequestIp(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "local";
}
