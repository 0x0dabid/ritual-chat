interface TestnetNoticeProps {
  mockMode: boolean;
}

export function TestnetNotice({ mockMode }: TestnetNoticeProps) {
  return (
    <div className="rounded-lg border border-ritual-green/20 bg-ritual-cardAlt px-4 py-3 text-sm text-black/75">
      This is a testnet application. No real value is involved.
      {mockMode ? (
        <span className="ml-2 font-medium text-ritual-green">
          Mock mode: addresses and tx hashes are simulated.
        </span>
      ) : null}
    </div>
  );
}
