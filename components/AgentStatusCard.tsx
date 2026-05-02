import type { AgentSession } from "@/lib/types";

interface AgentStatusCardProps {
  session: AgentSession;
  sessionWalletAddress?: string | null;
  activeSenderLabel?: string;
  activeSender: "wallet" | "session";
  ritualWalletAmount: string;
  sessionWalletAmount: string;
  connectedNativeBalance: string;
  connectedRitualWalletBalance: string;
  connectedRitualWalletLock: string;
  sessionNativeBalance: string;
  sessionRitualWalletBalance: string;
  sessionRitualWalletLock: string;
  ritualWalletAddress: string;
  actionPending?: boolean;
  onGenerateSessionWallet: () => void;
  onUseConnectedWallet: () => void;
  onUseSessionWallet: () => void;
  onFundSessionWallet: () => void;
  onWithdrawSessionNative: () => void;
  onDepositConnected: () => void;
  onWithdrawConnected: () => void;
  onDepositSession: () => void;
  onWithdrawSession: () => void;
  onSessionAmountChange: (value: string) => void;
  onRitualWalletAmountChange: (value: string) => void;
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
  activeSender,
  ritualWalletAmount,
  sessionWalletAmount,
  connectedNativeBalance,
  connectedRitualWalletBalance,
  connectedRitualWalletLock,
  sessionNativeBalance,
  sessionRitualWalletBalance,
  sessionRitualWalletLock,
  ritualWalletAddress,
  actionPending = false,
  onGenerateSessionWallet,
  onUseConnectedWallet,
  onUseSessionWallet,
  onFundSessionWallet,
  onWithdrawSessionNative,
  onDepositConnected,
  onWithdrawConnected,
  onDepositSession,
  onWithdrawSession,
  onSessionAmountChange,
  onRitualWalletAmountChange,
}: AgentStatusCardProps) {
  const chatStatus = session.chatStatus ?? (session.basicChatStatus === "active" ? "ready" : "missing-chat-manager");
  const chatStatusLabel = chatStatus === "ready"
    ? "Ready"
    : chatStatus === "missing-chat-manager"
      ? "Missing ChatManager"
      : "Pending";
  const currentOwnerWallet = activeSender === "session" && sessionWalletAddress
    ? sessionWalletAddress
    : session.userWallet;
  const activeRitualWalletBalance = activeSender === "session" && sessionWalletAddress
    ? sessionRitualWalletBalance
    : connectedRitualWalletBalance;
  const activeRitualWalletLock = activeSender === "session" && sessionWalletAddress
    ? sessionRitualWalletLock
    : connectedRitualWalletLock;

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-ritual-green/20 bg-ritual-card p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Execution Mode</h2>
          <span className="rounded-full bg-ritual-green px-3 py-1 text-xs font-medium text-white">
            {activeSenderLabel}
          </span>
        </div>
        <div className="mt-4">
          <Row label="Active Sender" value={activeSenderLabel} />
          <Row label="MetaMask Native Balance" value={connectedNativeBalance} />
          <Row label="Session Wallet Native Balance" value={sessionWalletAddress ? sessionNativeBalance : "Not generated"} />
          <Row label="Network" value="Ritual Testnet" />
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
        <div className="mt-4 grid grid-cols-2 gap-3">
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
        {chatStatus !== "ready" ? (
          <div className="mt-4 rounded-lg border border-ritual-green/15 bg-white/35 p-3 text-sm leading-6 text-black/68">
            ChatManager is not configured yet.
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-ritual-green/20 bg-ritual-card p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">Session Wallet</h2>
          <span className="rounded-full bg-ritual-green px-3 py-1 text-xs font-medium text-white">
            {sessionWalletAddress ? "Local" : "Not created"}
          </span>
        </div>
        <div className="mt-4">
          <Row
            label="Session Wallet Address"
            value={sessionWalletAddress ? <span title={sessionWalletAddress}>{compact(sessionWalletAddress)}</span> : "Not generated"}
          />
          <Row label="Native Balance" value={sessionWalletAddress ? sessionNativeBalance : "Not generated"} />
        </div>
        {!sessionWalletAddress ? (
          <p className="mt-4 rounded-lg border border-ritual-green/15 bg-white/35 p-3 text-sm leading-6 text-black/68">
            This wallet is local to this device and browser unless you back it up.
          </p>
        ) : null}
        <button
          type="button"
          onClick={onGenerateSessionWallet}
          disabled={actionPending}
          className="inline-flex w-full items-center justify-center rounded-lg bg-ritual-green px-4 py-3 font-medium text-white transition hover:bg-ritual-green/90 disabled:cursor-not-allowed disabled:bg-ritual-green/55"
        >
          {sessionWalletAddress ? "Session Wallet Ready" : "Create Session Wallet"}
        </button>
        <input
          type="number"
          min="0"
          step="any"
          value={sessionWalletAmount}
          onChange={(event) => onSessionAmountChange(event.target.value)}
          placeholder="RITUAL amount"
          aria-label="Session wallet native RITUAL amount"
          className="w-full rounded-lg border border-ritual-green/20 bg-white/55 px-4 py-3 text-sm outline-none transition placeholder:text-black/35 focus:border-ritual-green/50"
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onFundSessionWallet}
            disabled={actionPending || !sessionWalletAddress}
            className="inline-flex items-center justify-center rounded-lg border border-ritual-green/25 bg-white/45 px-4 py-3 font-medium text-ritual-green transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Fund Session Wallet
          </button>
          <button
            type="button"
            onClick={onWithdrawSessionNative}
            disabled={actionPending || !sessionWalletAddress}
            className="inline-flex items-center justify-center rounded-lg border border-ritual-green/25 bg-white/45 px-4 py-3 font-medium text-ritual-green transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Withdraw to MetaMask
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-ritual-green/20 bg-ritual-card p-5 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">RitualWallet</h2>
          <span className="rounded-full bg-ritual-green px-3 py-1 text-xs font-medium text-white">
            Protocol
          </span>
        </div>
        <div className="mt-4">
          <Row label="RitualWallet Contract" value={<span title={ritualWalletAddress}>{compact(ritualWalletAddress)}</span>} />
          <Row label="Current Owner Wallet" value={<span title={currentOwnerWallet}>{compact(currentOwnerWallet)}</span>} />
          <Row label="RitualWallet Balance" value={activeRitualWalletBalance} />
          <Row label="Lock Until" value={activeRitualWalletLock} />
        </div>
        <input
          type="number"
          min="0"
          step="any"
          value={ritualWalletAmount}
          onChange={(event) => onRitualWalletAmountChange(event.target.value)}
          placeholder="RITUAL amount"
          aria-label="RitualWallet RITUAL amount"
          className="mt-4 w-full rounded-lg border border-ritual-green/20 bg-white/55 px-4 py-3 text-sm outline-none transition placeholder:text-black/35 focus:border-ritual-green/50"
        />
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={activeSender === "session" ? onDepositSession : onDepositConnected}
            disabled={actionPending || (activeSender === "session" && !sessionWalletAddress)}
            className="inline-flex items-center justify-center rounded-lg border border-ritual-green/25 bg-white/45 px-4 py-3 font-medium text-ritual-green transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Deposit to RitualWallet
          </button>
          <button
            type="button"
            onClick={activeSender === "session" ? onWithdrawSession : onWithdrawConnected}
            disabled={actionPending || (activeSender === "session" && !sessionWalletAddress)}
            className="inline-flex items-center justify-center rounded-lg border border-ritual-green/25 bg-white/45 px-4 py-3 font-medium text-ritual-green transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Withdraw from RitualWallet
          </button>
        </div>
      </section>
    </div>
  );
}
