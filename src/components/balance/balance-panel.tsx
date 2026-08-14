"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet/wallet-context";
import { TOKEN_LIST, fmtAmount } from "@/lib/pool";
import { ConnectWallet } from "@/components/wallet/connect-button";

// Read the user's own shielded balances through the wallet (consent-gated).
// Least privilege: request only the tokens Noxis moves, never probe everything.
const WATCHED = TOKEN_LIST.map((t) => t.address);

type Balances = Record<string, bigint>;

export function BalancePanel() {
  const { walletAccount, address, isConnected, strk20Capable } = useWallet();

  const [balances, setBalances] = useState<Balances | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleQuery = async () => {
    if (!walletAccount) return;
    setLoading(true);
    setError("");
    try {
      const entries = await walletAccount.strk20Balances(WATCHED);
      const map: Balances = {};
      for (const e of entries ?? []) {
        const token =
          (e as { token?: string; token_address?: string }).token ??
          (e as { token?: string; token_address?: string }).token_address;
        const raw =
          (e as { balance?: string | bigint }).balance ??
          (e as { amount?: string | bigint }).amount;
        if (token === undefined || raw === undefined) continue;
        map[token] = BigInt(raw);
      }
      setBalances(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  if (isConnected && !strk20Capable) {
    return (
      <div className="rounded-xl border border-graphite-800 bg-graphite-850 p-6">
        <p className="text-sm leading-6 text-amber-300">
          Shielded balances need a STRK20-capable wallet — install{" "}
          <a
            href="https://www.ready.co/"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            Ready X
          </a>
          .
        </p>
      </div>
    );
  }

  if (!isConnected || !address) {
    return (
      <div className="rounded-xl border border-graphite-800 bg-graphite-850 p-6">
        <p className="text-sm text-graphite-300">
          Connect a wallet to see your shielded balances.
        </p>
        <div className="mt-4">
          <ConnectWallet />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-graphite-800 bg-graphite-850 p-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          {TOKEN_LIST.map((t) => {
            const wei = balances?.[t.address];
            return (
              <div key={t.symbol} className="flex items-baseline justify-between">
                <span className="text-xs font-medium tracking-wide text-graphite-400">
                  {t.name}
                </span>
                <span className="font-mono text-xl text-graphite-50">
                  {wei !== undefined ? fmtAmount(wei, t.decimals) : "—"}{" "}
                  <span className="text-sm text-graphite-400">{t.symbol}</span>
                </span>
              </div>
            );
          })}
        </div>
        <button
          type="button"
          onClick={handleQuery}
          disabled={loading}
          className="shrink-0 rounded-lg border border-graphite-700 px-4 py-2.5 text-xs font-medium text-graphite-200 transition-colors hover:border-copper-500 hover:text-copper-300 disabled:opacity-40"
        >
          {loading ? "Reading…" : balances ? "Refresh" : "Reveal"}
        </button>
      </div>
      <p className="mt-4 text-xs leading-5 text-graphite-500">
        Read through your wallet — the first reveal shows a consent prompt. Only
        you can see these numbers.
      </p>
      {error ? (
        <p className="mt-3 break-all rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
