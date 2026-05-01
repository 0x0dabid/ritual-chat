import type { ChatMessage as ChatMessageType } from "@/lib/types";
import { ChatInput } from "@/components/ChatInput";
import { ChatMessage } from "@/components/ChatMessage";

interface ChatWindowProps {
  disabled: boolean;
  messages: ChatMessageType[];
  onSend: (prompt: string) => Promise<void>;
}

export function ChatWindow({ disabled, messages, onSend }: ChatWindowProps) {
  return (
    <section className="flex min-h-[620px] flex-col overflow-hidden rounded-lg border border-ritual-green/20 bg-ritual-card shadow-soft">
      <div className="border-b border-ritual-green/15 px-5 py-4">
        <h2 className="text-lg font-semibold">RITUAL CHAT</h2>
        <p className="mt-1 text-sm text-black/55">
          Basic chat uses Ritual LLM and tracks each message on Ritual Testnet.
        </p>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto p-5">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-80 items-center justify-center text-center text-sm leading-6 text-black/55">
            Start a conversation with Ritual LLM. Responses will appear here with a Ritual Testnet transaction hash.
          </div>
        ) : (
          messages.map((message) => <ChatMessage key={message.id} message={message} />)
        )}
      </div>
      <ChatInput disabled={disabled} onSend={onSend} />
    </section>
  );
}
