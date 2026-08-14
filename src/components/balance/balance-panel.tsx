"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet/wallet-context";
import { STRK_ADDRESS, fmtStrk } from "@/lib/pool";
import { ConnectWallet } from "@/components/wallet/connect-button";

// Read the user's own shielded STRK balance through the wallet (consent-gated).
// Least privilege: request only STRK, the one token Noxis moves — never probe
// every token just to feature-detect.
export function BalancePanel() {
  const { walletAccount, address, isConnected, strk20Capable } = useWallet();

  const [balance, setBalance] = useState<bigint | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleQuery = async () => {
    if (!walletAccount) return;
    setLoading(true);
    setError("");
    try {
      const entries = await walletAccount.strk20Balances([STRK_ADDRESS]);
      const entry = (entries ?? []).find((e) => {
        const token = (e as { token?: string; token_address?: string }).token
          ?? (e as { token?: string; token_address?: string }).token_address;
        try {
          return token !== undefined && BigInt(token) === BigInt(STRK_ADDRESS);
        } catch {
          return false;
        }
      });
      const raw =
        (entry as { balance?: string | bigint } | undefined)?.balance ??
        (entry as { amount?: string | bigint } | undefined)?.amount;
      setBalance(raw !== undefined ? BigInt(raw) : 0n);
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
          Connect a wallet to see your shielded balance.
        </p>
        <div className="mt-4">
          <ConnectWallet />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-graphite-800 bg-graphite-850 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-medium tracking-wide text-graphite-400">
            SHIELDED STRK
          </p>
          <p className="mt-2 font-mono text-3xl text-graphite-50">
            {balance !== null ? fmtStrk(balance) : "—"}
          </p>
        </div>
        <button
          type="button"
          onClick={handleQuery}
          disabled={loading}
          className="rounded-lg border border-graphite-700 px-4 py-2.5 text-xs font-medium text-graphite-200 transition-colors hover:border-copper-500 hover:text-copper-300 disabled:opacity-40"
        >
          {loading ? "Reading…" : balance !== null ? "Refresh" : "Reveal"}
        </button>
      </div>
      <p className="mt-4 text-xs leading-5 text-graphite-500">
        Read through your wallet — the first reveal shows a consent prompt. Only
        you can see this number.
      </p>
      {error ? (
        <p className="mt-3 break-all rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 font-mono text-xs text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
