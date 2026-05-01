import type { TxStatus } from "@/lib/types";

interface TxHashLinkProps {
  txHash: string;
  status: TxStatus;
}

function compactHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function TxHashLink({ txHash, status }: TxHashLinkProps) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-black/60">
      <span>Ritual TX:</span>
      <a
        className="font-medium text-ritual-green underline-offset-4 hover:underline"
        href={`https://explorer.ritualfoundation.org/tx/${txHash}`}
        target="_blank"
        rel="noreferrer"
      >
        {compactHash(txHash)}
      </a>
      <span className="rounded-full border border-ritual-green/20 px-2 py-0.5">
        Status: {status[0].toUpperCase() + status.slice(1)}
      </span>
    </div>
  );
}
