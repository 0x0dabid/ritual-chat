import type { AgentSession } from "@/lib/types";

interface AgentStatusCardProps {
  session: AgentSession;
  sessionWalletAddress?: string | null;
  activeSenderLabel?: string;
  ritualWalletAmount: string;
  actionPending?: boolean;
  onGenerateSessionWallet: () => void;
  onUseConnectedWallet: () => void;
  onUseSessionWallet: () => void;
  onFundSessionWallet: () => void;
  onDepositDefault: () => void;
  onDepositAmount: () => void;
  onWithdrawAmount: () => void;
  onAmountChange: (value: string) => void;
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

export function AgentStatusCard({
  session,
  sessionWalletAddress,
  activeSenderLabel = "Connected Wallet",
  ritualWalletAmount,
  actionPending = false,
  onGenerateSessionWallet,
  onUseConnectedWallet,
  onUseSessionWallet,
  onFundSessionWallet,
  onDepositDefault,
  onDepositAmount,
  onWithdrawAmount,
  onAmountChange,
}: AgentStatusCardProps) {
  const chatStatus = session.chatStatus ?? (session.basicChatStatus === "active" ? "ready" : "missing-chat-manager");
  const chatStatusLabel = chatStatus === "ready"
    ? "Ready"
    : chatStatus === "missing-chat-manager"
      ? "Missing ChatManager"
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
        <Row
          label="Session Wallet"
          value={sessionWalletAddress ? <span title={sessionWalletAddress}>{compact(sessionWalletAddress)}</span> : "Not generated"}
        />
        <Row label="Chat Sender" value={activeSenderLabel} />
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
      <div className="mt-4 grid gap-3">
        <button
          type="button"
          onClick={onGenerateSessionWallet}
          disabled={actionPending}
          className="inline-flex w-full items-center justify-center rounded-lg bg-ritual-green px-4 py-3 font-medium text-white transition hover:bg-ritual-green/90 disabled:cursor-not-allowed disabled:bg-ritual-green/55"
        >
          {sessionWalletAddress ? "Session Wallet Ready" : "Generate Session Wallet"}
        </button>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onUseConnectedWallet}
            disabled={actionPending}
            className="inline-flex items-center justify-center rounded-lg border border-ritual-green/25 bg-white/45 px-4 py-3 font-medium text-ritual-green transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Use MetaMask
          </button>
          <button
            type="button"
            onClick={onUseSessionWallet}
            disabled={actionPending || !sessionWalletAddress}
            className="inline-flex items-center justify-center rounded-lg border border-ritual-green/25 bg-white/45 px-4 py-3 font-medium text-ritual-green transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Use Session
          </button>
        </div>
        <button
          type="button"
          onClick={onFundSessionWallet}
          disabled={actionPending || !sessionWalletAddress}
          className="inline-flex w-full items-center justify-center rounded-lg bg-ritual-green px-4 py-3 font-medium text-white transition hover:bg-ritual-green/90 disabled:cursor-not-allowed disabled:bg-ritual-green/55"
        >
          Fund Session Wallet 0.01 RITUAL
        </button>
        <button
          type="button"
          onClick={onDepositDefault}
          disabled={actionPending}
          className="inline-flex w-full items-center justify-center rounded-lg bg-ritual-green px-4 py-3 font-medium text-white transition hover:bg-ritual-green/90 disabled:cursor-not-allowed disabled:bg-ritual-green/55"
        >
          Deposit 0.01 RITUAL to RitualWallet
        </button>
        <input
          type="number"
          min="0"
          step="0.001"
          value={ritualWalletAmount}
          onChange={(event) => onAmountChange(event.target.value)}
          placeholder="Amount"
          className="w-full rounded-lg border border-ritual-green/20 bg-white/55 px-4 py-3 text-sm outline-none transition placeholder:text-black/35 focus:border-ritual-green/50"
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onDepositAmount}
            disabled={actionPending}
            className="inline-flex items-center justify-center rounded-lg border border-ritual-green/25 bg-white/45 px-4 py-3 font-medium text-ritual-green transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Deposit
          </button>
          <button
            type="button"
            onClick={onWithdrawAmount}
            disabled={actionPending}
            className="inline-flex items-center justify-center rounded-lg border border-ritual-green/25 bg-white/45 px-4 py-3 font-medium text-ritual-green transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Withdraw
          </button>
        </div>
      </div>
      {chatStatus !== "ready" ? (
        <div className="mt-4 rounded-lg border border-ritual-green/15 bg-white/35 p-3 text-sm leading-6 text-black/68">
          ChatManager is not configured yet.
        </div>
      ) : null}
    </section>
  );
}
