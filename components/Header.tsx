import Image from "next/image";

export function Header() {
  return (
    <header className="border-b border-ritual-green/15 bg-ritual-card/80">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <Image
            src="/background-logo.png"
            alt="RITUAL CHAT logo"
            width={38}
            height={38}
            className="h-10 w-10 object-contain"
            priority
          />
          <div className="text-lg font-semibold tracking-normal">RITUAL CHAT</div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full border border-ritual-green/25 px-3 py-1 text-ritual-green">
            Ritual Testnet
          </span>
          <span className="text-black/65">No real value. Testnet only.</span>
        </div>
      </div>
    </header>
  );
}
