import { CheckCircle2, Loader2, Wallet } from "lucide-react";

interface AgentSetupCardProps {
  active: boolean;
  loadingStep: string | null;
  walletAddress: string | null;
  onConnectWallet: () => void;
  onCreate: () => void;
  onPublicSession: () => void;
}

function compact(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AgentSetupCard({
  active,
  loadingStep,
  walletAddress,
  onConnectWallet,
  onCreate,
  onPublicSession,
}: AgentSetupCardProps) {
  return (
    <section className="rounded-lg border border-ritual-green/20 bg-ritual-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        {active ? (
          <CheckCircle2 className="mt-1 text-ritual-green" size={20} aria-hidden="true" />
        ) : (
          <div className="mt-1 h-5 w-5 rounded-full border border-ritual-green/45" />
        )}
        <div>
          <h2 className="text-lg font-semibold">Create your Persistent Ritual Agent</h2>
          <p className="mt-2 text-sm leading-6 text-black/68">
            Your agent is owned by your permanent Ritual Smart Account. Chat transactions are submitted through a limited session key so you do not need to approve every message.
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={onConnectWallet}
        disabled={Boolean(loadingStep) || active}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ritual-green/25 bg-white/45 px-4 py-3 font-medium text-ritual-green transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Wallet size={18} aria-hidden="true" />
        {walletAddress ? `Wallet ${compact(walletAddress)}` : "Connect Wallet"}
      </button>

      <button
        type="button"
        onClick={onCreate}
        disabled={Boolean(loadingStep) || (!walletAddress && !active)}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ritual-green px-4 py-3 font-medium text-white transition hover:bg-ritual-green/90 disabled:cursor-not-allowed disabled:bg-ritual-green/55"
      >
        {loadingStep ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : null}
        {active ? "Ready to chat." : "Create My Agent"}
      </button>
      {!active ? (
        <button
          type="button"
          onClick={onPublicSession}
          disabled={Boolean(loadingStep)}
          className="mt-3 w-full rounded-lg px-4 py-2 text-sm font-medium text-black/60 transition hover:bg-ritual-green/10 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Start public test session
        </button>
      ) : null}
      {loadingStep ? (
        <p className="mt-3 text-sm text-ritual-green">{loadingStep}</p>
      ) : null}
    </section>
  );
}
