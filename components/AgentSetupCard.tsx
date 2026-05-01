import { CheckCircle2, Loader2, Wallet } from "lucide-react";

interface AgentSetupCardProps {
  active: boolean;
  realModePending: boolean;
  loadingStep: string | null;
  walletAddress: string | null;
  walletPending: boolean;
  noInjectedWallet: boolean;
  sessionKeyStatus?: string;
  onAuthorizeSessionKey?: () => void;
  onConnectWallet: () => void;
  onDisconnectWallet: () => void;
  onCreate: () => void;
}

function compact(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AgentSetupCard({
  active,
  realModePending,
  loadingStep,
  walletAddress,
  walletPending,
  noInjectedWallet,
  sessionKeyStatus,
  onAuthorizeSessionKey,
  onConnectWallet,
  onDisconnectWallet,
  onCreate,
}: AgentSetupCardProps) {
  const hasWallet = Boolean(walletAddress);
  const createButtonLabel = realModePending
    ? "Smart Account Created"
    : active
      ? "Smart Account Active"
      : "Create My Smart Account";

  return (
    <section className="rounded-lg border border-ritual-green/20 bg-ritual-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        {active ? (
          <CheckCircle2 className="mt-1 text-ritual-green" size={20} aria-hidden="true" />
        ) : (
          <div className="mt-1 h-5 w-5 rounded-full border border-ritual-green/45" />
        )}
        <div>
          <h2 className="text-lg font-semibold">Create your Ritual Smart Account</h2>
          <p className="mt-2 text-sm leading-6 text-black/68">
            {active || realModePending
              ? "Your Ritual Smart Account is active."
              : hasWallet
                ? "Your connected wallet will be used as the identity for your permanent Ritual Smart Account."
                : "Connect your wallet to create your Ritual Smart Account."}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={hasWallet ? onDisconnectWallet : onConnectWallet}
        disabled={Boolean(loadingStep) || walletPending || (!hasWallet && noInjectedWallet)}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-ritual-green/25 bg-white/45 px-4 py-3 font-medium text-ritual-green transition hover:bg-white/70 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {walletPending ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : <Wallet size={18} aria-hidden="true" />}
        {walletAddress ? `Connected ${compact(walletAddress)}` : "Connect Wallet"}
      </button>
      {noInjectedWallet && !hasWallet ? (
        <p className="mt-3 text-sm leading-6 text-black/68">
          No injected wallet detected. Please install MetaMask or open in a browser with an EVM wallet.
        </p>
      ) : null}

      <button
        type="button"
        onClick={onCreate}
        disabled={Boolean(loadingStep) || active || realModePending || !hasWallet}
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ritual-green px-4 py-3 font-medium text-white transition hover:bg-ritual-green/90 disabled:cursor-not-allowed disabled:bg-ritual-green/55"
      >
        {loadingStep ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : null}
        {createButtonLabel}
      </button>
      {realModePending ? (
        <p className="mt-3 text-sm leading-6 text-black/68">
          Your Ritual Smart Account is active.
        </p>
      ) : null}
      {active && sessionKeyStatus !== "active" && onAuthorizeSessionKey ? (
        <button
          type="button"
          onClick={onAuthorizeSessionKey}
          disabled={Boolean(loadingStep) || !hasWallet}
          className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-ritual-green px-4 py-3 font-medium text-white transition hover:bg-ritual-green/90 disabled:cursor-not-allowed disabled:bg-ritual-green/55"
        >
          {loadingStep ? <Loader2 className="animate-spin" size={18} aria-hidden="true" /> : null}
          Authorize Chat Session
        </button>
      ) : null}
      {loadingStep ? (
        <p className="mt-3 text-sm text-ritual-green">{loadingStep}</p>
      ) : null}
    </section>
  );
}
