import type { AgentSession } from "@/lib/types";

interface AgentStatusCardProps {
  session: AgentSession;
}

function compact(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-ritual-green/10 py-2 last:border-b-0">
      <span className="text-sm text-black/58">{label}</span>
      <span className="min-w-0 text-right text-sm font-medium">{value}</span>
    </div>
  );
}

export function AgentStatusCard({ session }: AgentStatusCardProps) {
  const chatStatus = session.chatStatus ?? (session.basicChatStatus === "active" ? "ready" : "missing-chat-manager");
  const chatStatusLabel = chatStatus === "ready"
    ? "Ready"
    : chatStatus === "missing-chat-manager"
      ? "Missing ChatManager"
      : chatStatus === "missing-relayer"
        ? "Missing Relayer"
        : "Pending";

  return (
    <section className="rounded-lg border border-ritual-green/20 bg-ritual-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Ritual Chat Status</h2>
        <span className="rounded-full bg-ritual-green px-3 py-1 text-xs font-medium text-white">
          Active
        </span>
      </div>
      <div className="mt-4">
        <Row label="Connected Wallet" value={<span title={session.userWallet}>{compact(session.userWallet)}</span>} />
        <Row label="Network" value="Ritual Testnet" />
        <Row label="Status" value="Active" />
        <Row label="Chat Status" value={chatStatusLabel} />
        <Row
          label="Explorer"
          value={(
            <a
              className="text-ritual-green underline-offset-4 hover:underline"
              href={session.explorerLink}
              target="_blank"
              rel="noreferrer"
            >
              View ChatManager
            </a>
          )}
        />
      </div>
      {chatStatus !== "ready" ? (
        <div className="mt-4 rounded-lg border border-ritual-green/15 bg-white/35 p-3 text-sm leading-6 text-black/68">
          {chatStatus === "missing-relayer"
            ? "Server relayer is not configured yet."
            : "ChatManager is not configured yet."}
        </div>
      ) : null}
    </section>
  );
}
