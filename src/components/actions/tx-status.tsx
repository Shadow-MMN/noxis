"use client";

import { explorerTxUrl } from "@/lib/pool";

export type TxState =
  | { status: "idle" }
  | { status: "pending"; txHash: string }
  | { status: "submitted"; txHash: string }
  | { status: "confirmed"; txHash: string; detail: string; note?: string }
  | { status: "declined"; txHash: string; detail: string }
  | { status: "failed"; detail: string };

export function isScreeningError(message: string): boolean {
  return /screen/i.test(message);
}

export function TxStatusCard({
  tx,
  network,
}: {
  tx: TxState;
  network: string;
}) {
  if (tx.status === "pending" || tx.status === "submitted") {
    return (
      <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-amber-300">
          <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
          {tx.status === "pending"
            ? "Waiting for confirmation — proof generation can take a moment…"
            : "Submitted — confirmation pending on-chain. Check the explorer."}
        </p>
        <a
          href={explorerTxUrl(tx.txHash, network)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block font-mono text-xs text-copper-300 underline underline-offset-2"
        >
          {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-6)} ↗
        </a>
      </div>
    );
  }

  if (tx.status === "confirmed") {
    return (
      <div className="mt-4 rounded-lg border border-sage-500/30 bg-sage-500/10 px-4 py-3">
        <p className="flex items-center gap-2 text-sm text-sage-400">
          <span className="inline-block h-2 w-2 rounded-full bg-sage-500" />
          {tx.detail}
        </p>
        {tx.note ? (
          <p className="mt-1 text-xs leading-5 text-graphite-400">{tx.note}</p>
        ) : null}
        <a
          href={explorerTxUrl(tx.txHash, network)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block font-mono text-xs text-copper-300 underline underline-offset-2"
        >
          {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-6)} ↗
        </a>
      </div>
    );
  }

  if (tx.status === "declined") {
    return (
      <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
        <p className="text-sm text-amber-300">
          Deposit declined by screening — a protocol outcome, not an app bug.
        </p>
        <p className="mt-1 break-all font-mono text-xs text-graphite-400">
          {tx.detail}
        </p>
      </div>
    );
  }

  if (tx.status === "failed") {
    return (
      <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
        <p className="text-sm text-red-300">Transaction failed</p>
        <p className="mt-1 break-all font-mono text-xs text-graphite-400">
          {tx.detail}
        </p>
      </div>
    );
  }

  return null;
}
