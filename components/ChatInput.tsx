import { Send } from "lucide-react";
import { FormEvent, useState } from "react";

interface ChatInputProps {
  disabled: boolean;
  onSend: (prompt: string) => Promise<void>;
}

export function ChatInput({ disabled, onSend }: ChatInputProps) {
  const [prompt, setPrompt] = useState("");
  const [sending, setSending] = useState(false);
  const trimmed = prompt.trim();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!trimmed || disabled || sending) return;
    setSending(true);
    setPrompt("");
    try {
      await onSend(trimmed);
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-ritual-green/15 bg-ritual-card p-3">
      <div className="flex items-end gap-2">
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          placeholder="Ask Ritual LLM anything..."
          disabled={disabled || sending}
          maxLength={1000}
          rows={2}
          className="max-h-32 min-h-12 flex-1 resize-none rounded-lg border border-ritual-green/20 bg-white/70 px-3 py-3 text-sm outline-none transition placeholder:text-black/38 focus:border-ritual-green"
        />
        <button
          type="submit"
          disabled={!trimmed || disabled || sending}
          aria-label="Send message"
          title="Send message"
          className="grid h-12 w-12 place-items-center rounded-lg bg-ritual-green text-white transition hover:bg-ritual-green/90 disabled:cursor-not-allowed disabled:bg-ritual-green/45"
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
      <div className="mt-2 flex justify-between text-xs text-black/45">
        <span>{sending ? "Sending to Ritual LLM..." : "Text only"}</span>
        <span>{prompt.length}/1000</span>
      </div>
    </form>
  );
}
