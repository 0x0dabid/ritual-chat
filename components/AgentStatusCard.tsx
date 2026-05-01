import type { AgentSession } from "@/lib/types";

interface AgentStatusCardProps {
  session: AgentSession;
  fundingPending?: boolean;
  onFundSmartAccount?: () => void;
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

export function AgentStatusCard({ session, fundingPending = false, onFundSmartAccount }: AgentStatusCardProps) {
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
    : session.sessionKeyStatus === "expired"
      ? "Expired"
      : "Pending authorization";
  const authorizedSessionAddress = session.sessionKeyStatus === "active"
    && session.sessionKeyAddress !== "0x0000000000000000000000000000000000000000";

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
        {authorizedSessionAddress ? (
          <Row label="Session Address" value={<span title={session.sessionKeyAddress}>{compact(session.sessionKeyAddress)}</span>} />
        ) : (
          <Row label="Session Address" value="Not authorized" />
        )}
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
      {!session.hasMinimumSmartAccountBalance && onFundSmartAccount ? (
        <button
          type="button"
          onClick={onFundSmartAccount}
          disabled={fundingPending}
          className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-ritual-green px-4 py-3 font-medium text-white transition hover:bg-ritual-green/90 disabled:cursor-not-allowed disabled:bg-ritual-green/55"
        >
          {fundingPending ? "Funding Smart Account..." : "Fund Smart Account 0.01 RITUAL"}
        </button>
      ) : null}
      {chatStatus !== "ready" ? (
        <div className="mt-4 rounded-lg border border-ritual-green/15 bg-white/35 p-3 text-sm leading-6 text-black/68">
          {chatStatus === "needs-funding"
            ? "Fund your Ritual Smart Account before chatting."
            : chatStatus === "needs-session-key"
              ? "Authorize the chat session key before chatting."
              : chatStatus === "target-not-approved"
                ? "ChatManager is not approved yet."
                : "ChatManager is not configured yet."}
        </div>
      ) : null}
    </section>
  );
}
