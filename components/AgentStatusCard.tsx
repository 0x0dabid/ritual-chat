import type { AgentSession } from "@/lib/types";
import { groupPersistentAgentMissingConfig } from "@/components/persistentAgentConfigGroups";

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
  const hasPersistentAgent = session.persistentAgentAddress !== "0x0000000000000000000000000000000000000000";
  const missingConfigGroups = groupPersistentAgentMissingConfig(session.persistentAgentMissingConfig);
  const chatStatus = session.chatStatus ?? (session.basicChatStatus === "active" ? "ready" : "missing-chat-manager");
  const chatStatusLabel = chatStatus === "ready"
    ? "Ready"
    : chatStatus === "missing-chat-manager"
      ? "Missing ChatManager"
      : "Pending";

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
        <Row label="Chat Status" value={chatStatusLabel} />
        <Row
          label="Persistent Agent"
          value={hasPersistentAgent
            ? <span title={session.persistentAgentAddress}>{compact(session.persistentAgentAddress)}</span>
            : "Advanced recognition pending"}
        />
        {session.persistentAgentProviderLabel ? (
          <Row label="LLM Provider" value={session.persistentAgentProviderLabel} />
        ) : null}
        {session.persistentAgentCreateTxHash ? (
          <Row
            label="Persistent Agent Create TX"
            value={(
              <a
                className="text-ritual-green underline-offset-4 hover:underline"
                href={`https://explorer.ritualfoundation.org/tx/${session.persistentAgentCreateTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {compact(session.persistentAgentCreateTxHash)}
              </a>
            )}
          />
        ) : null}
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
      {session.persistentAgentMissingConfig?.length ? (
        <div className="mt-4 rounded-lg border border-ritual-green/15 bg-white/35 p-3 text-sm leading-6 text-black/68">
          <p>
            Advanced Persistent Agent recognition is pending. This public v1 lets users create a Ritual Smart Account
            and use the Ritual LLM chat path.
          </p>
          <div className="mt-3 space-y-2">
            {missingConfigGroups.map((group) => (
              <div key={group.title}>
                <div className="text-xs font-semibold uppercase tracking-wide text-ritual-green">
                  {group.title}
                </div>
                <div className="break-words font-mono text-xs text-black/58">
                  {group.items.join(", ")}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
