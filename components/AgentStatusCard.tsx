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
      : chatStatus === "needs-funding"
        ? "Needs funding"
        : chatStatus === "needs-session-key"
          ? "Needs session key"
          : chatStatus === "target-not-approved"
            ? "Target not approved"
            : "Pending";
  const balanceLabel = session.smartAccountBalanceFormatted
    ? `${Number(session.smartAccountBalanceFormatted).toLocaleString(undefined, { maximumFractionDigits: 5 })} RITUAL`
    : "Unknown";
  const sessionKeyLabel = session.sessionKeyStatus === "active"
    ? "Active"
    : "Pending authorization";

  return (
    <section className="rounded-lg border border-ritual-green/20 bg-ritual-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Smart Account Status</h2>
        <span className="rounded-full bg-ritual-green px-3 py-1 text-xs font-medium text-white">
          Active
        </span>
      </div>
      <div className="mt-4">
        <Row label="Connected Wallet" value={<span title={session.userWallet}>{compact(session.userWallet)}</span>} />
        <Row label="Smart Account" value={<span title={session.smartAccountAddress}>{compact(session.smartAccountAddress)}</span>} />
        <Row label="Network" value="Ritual Testnet" />
        <Row label="Status" value="Active" />
        <Row label="Balance" value={balanceLabel} />
        <Row label="Minimum Balance" value={session.hasMinimumSmartAccountBalance ? "Met" : "Fund needed"} />
        <Row label="Session Key" value={sessionKeyLabel} />
        {session.sessionKeyAddress !== "0x0000000000000000000000000000000000000000" ? (
          <Row label="Session Address" value={<span title={session.sessionKeyAddress}>{compact(session.sessionKeyAddress)}</span>} />
        ) : null}
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
              View Smart Account
            </a>
          )}
        />
      </div>
      {chatStatus !== "ready" ? (
        <div className="mt-4 rounded-lg border border-ritual-green/15 bg-white/35 p-3 text-sm leading-6 text-black/68">
          {chatStatus === "needs-funding"
            ? "Fund your Ritual Smart Account with a small amount of testnet RITUAL before chatting."
            : chatStatus === "needs-session-key"
              ? "Authorize the limited chat session key once to chat without wallet popups."
              : chatStatus === "target-not-approved"
                ? "CHAT_MANAGER_ADDRESS must be approved on the smart account factory before chat can run."
                : "Configure CHAT_MANAGER_ADDRESS before using Ritual LLM chat."}
        </div>
      ) : null}
    </section>
  );
}
