import clsx from "clsx";
import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { TxHashLink } from "@/components/TxHashLink";

interface ChatMessageProps {
  message: ChatMessageType;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={clsx("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={clsx(
          "max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6",
          isUser
            ? "bg-ritual-green text-white"
            : "border border-ritual-green/18 bg-ritual-cardAlt text-black",
        )}
      >
        <p className="whitespace-pre-wrap break-words">{message.content}</p>
        {!isUser && message.txHash ? (
          <TxHashLink txHash={message.txHash} status={message.txStatus} />
        ) : null}
      </div>
    </div>
  );
}
