const POOL_ADDRESS =
  "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";

const pillars = [
  {
    step: "01",
    title: "Shield",
    body: "Deposit STRK into the STRK20 pool and mint a private note only you can spend.",
    hidden: ["Note owner", "Amount"],
    visible: ["Deposit event"],
  },
  {
    step: "02",
    title: "Private transfer",
    body: "Spend one note into a new one. On-chain, nobody can link the sender to the recipient.",
    hidden: ["Sender", "Recipient", "Amount"],
    visible: ["That a transfer happened"],
  },
  {
    step: "03",
    title: "Unshield",
    body: "Withdraw to a fresh account, breaking the link back to your deposit.",
    hidden: ["Source note"],
    visible: ["Withdrawal amount"],
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-graphite-800 px-6 py-5 sm:px-10">
        <span className="font-mono text-lg tracking-[0.3em] text-copper-400">
          NOXIS
        </span>
        <span className="hidden font-mono text-xs tracking-wider text-graphite-400 sm:block">
          STRK20 PRIVATE SPRINT · 2026
        </span>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 sm:px-10 sm:py-24">
        {/* Hero */}
        <section>
          <p className="mb-4 font-mono text-xs uppercase tracking-[0.25em] text-copper-400">
            Private payments on Starknet
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold leading-[1.1] tracking-tight text-graphite-50 sm:text-6xl">
            Payments without the paper trail.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-graphite-300">
            Shield STRK into the STRK20 privacy pool. Send privately. Unshield
            when you need to. Your wallet holds the keys — the chain never sees
            who paid whom, how much, or when.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="button"
              disabled
              title="Wallet integration lands with the STRK20 integration plan"
              className="cursor-not-allowed rounded-lg bg-copper-500 px-6 py-3 text-sm font-medium text-graphite-950 opacity-60 transition-colors hover:bg-copper-400"
            >
              Connect wallet — coming soon
            </button>
            <a
              href="#how-it-works"
              className="rounded-lg border border-graphite-700 px-6 py-3 text-sm font-medium text-graphite-200 transition-colors hover:border-copper-500 hover:text-copper-300"
            >
              How it works
            </a>
          </div>

          {/* Registration status */}
          <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-graphite-800 pt-6 font-mono text-xs text-graphite-400">
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-sage-500" />
              Registered — STRK20 Private Sprint
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-copper-400" />
              Integration plan — next
            </span>
            <span className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-graphite-600" />
              Mainnet live — pending
            </span>
          </div>
        </section>

        {/* Pillars */}
        <section id="how-it-works" className="mt-24">
          <h2 className="text-2xl font-semibold tracking-tight text-graphite-50">
            How Noxis works
          </h2>
          <p className="mt-3 max-w-xl text-graphite-300">
            Three moves, one privacy pool. Each step states plainly what stays
            hidden and what the chain can see.
          </p>
          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            {pillars.map((p) => (
              <article
                key={p.step}
                className="flex flex-col rounded-xl border border-graphite-800 bg-graphite-850 p-6"
              >
                <span className="font-mono text-xs text-copper-400">
                  {p.step}
                </span>
                <h3 className="mt-3 text-lg font-semibold text-graphite-50">
                  {p.title}
                </h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-graphite-300">
                  {p.body}
                </p>
                <dl className="mt-6 space-y-2 border-t border-graphite-800 pt-4 text-xs">
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-graphite-500">Hidden</dt>
                    <dd className="text-right text-graphite-200">
                      {p.hidden.join(" · ")}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="shrink-0 text-graphite-500">Visible</dt>
                    <dd className="text-right text-graphite-400">
                      {p.visible.join(" · ")}
                    </dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-graphite-800 px-6 py-6 sm:px-10">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 font-mono text-xs text-graphite-500 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Starknet mainnet · SN_MAIN · pool{" "}
            <span className="text-graphite-400">
              {POOL_ADDRESS.slice(0, 10)}…{POOL_ADDRESS.slice(-6)}
            </span>
          </span>
          <a
            href="https://github.com/Shadow-MMN/noxis"
            target="_blank"
            rel="noopener noreferrer"
            className="text-graphite-400 transition-colors hover:text-copper-400"
          >
            github.com/Shadow-MMN/noxis
          </a>
        </div>
      </footer>
    </div>
  );
}
