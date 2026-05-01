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
  const agentIsActive = session.status === "active";
  const hasPersistentAgent = session.persistentAgentAddress !== "0x0000000000000000000000000000000000000000";
  const hasSessionKey = session.sessionKeyAddress !== "0x0000000000000000000000000000000000000000";

  return (
    <section className="rounded-lg border border-ritual-green/20 bg-ritual-card p-5 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Agent Status</h2>
        <span className="rounded-full bg-ritual-green px-3 py-1 text-xs font-medium text-white">
          {agentIsActive ? "Active" : "Pending"}
        </span>
      </div>
      <div className="mt-4">
        <Row label="Connected Wallet" value={<span title={session.userWallet}>{compact(session.userWallet)}</span>} />
        <Row label="Smart Account" value={<span title={session.smartAccountAddress}>{compact(session.smartAccountAddress)} · Active</span>} />
        <Row
          label="Persistent Agent"
          value={hasPersistentAgent
            ? <span title={session.persistentAgentAddress}>{compact(session.persistentAgentAddress)}</span>
            : "Pending Ritual integration"}
        />
        <Row label="Agent Type" value="Persistent Agent" />
        <Row label="Owner" value="User AA Smart Account" />
        <Row label="Network" value="Ritual Testnet" />
        <Row label="Session Key" value={hasSessionKey ? "Active" : "Pending owner authorization"} />
        <Row label="Session" value={agentIsActive ? "Active" : "Pending"} />
        <Row label="Chat" value={agentIsActive ? "Enabled" : "Disabled until agent is active"} />
        <Row label="Gas" value="Sponsored / Relayed on Testnet" />
        <Row
          label="Explorer"
          value={(
            <a
              className="text-ritual-green underline-offset-4 hover:underline"
              href={session.explorerLink}
              target="_blank"
              rel="noreferrer"
            >
              View Agent
            </a>
          )}
        />
      </div>
    </section>
  );
}
