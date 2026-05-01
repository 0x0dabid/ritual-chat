import { ArrowRight } from "lucide-react";
import Image from "next/image";

interface HeroProps {
  onCreate: () => void;
  disabled?: boolean;
}

export function Hero({ onCreate, disabled = false }: HeroProps) {
  return (
    <section className="relative overflow-hidden py-5">
      <Image
        src="/background-logo.png"
        alt=""
        width={520}
        height={390}
        className="pointer-events-none absolute right-0 top-1/2 hidden w-[360px] -translate-y-1/2 opacity-[0.08] lg:block"
        priority
      />
      <div className="relative max-w-3xl">
        <h1 className="text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
          Your AI Agent on Ritual
        </h1>
        <p className="mt-4 text-lg leading-8 text-black/70">
          Text-only AI chat powered by Ritual LLM and tracked on Ritual Testnet.
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <button
            type="button"
            onClick={onCreate}
            disabled={disabled}
            className="inline-flex items-center gap-2 rounded-lg bg-ritual-green px-5 py-3 font-medium text-white shadow-soft transition hover:bg-ritual-green/90 disabled:cursor-not-allowed disabled:bg-ritual-green/55"
          >
            Create My Agent
            <ArrowRight size={18} aria-hidden="true" />
          </button>
          <p className="max-w-md text-sm text-black/62">
            Each user gets a permanent Ritual Smart Account and a Persistent Agent.
          </p>
        </div>
      </div>
    </section>
  );
}
