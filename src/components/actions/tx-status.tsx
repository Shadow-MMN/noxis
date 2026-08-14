"use client";

import { useState } from "react";
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

function CopyHash({ txHash }: { txHash: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(txHash).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="font-mono text-xs text-graphite-400 transition-colors hover:text-copper-300"
      title="Copy transaction hash"
    >
      {copied ? "copied ✓" : "copy hash"}
    </button>
  );
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
        <div className="mt-1 flex items-center gap-3">
          <a
            href={explorerTxUrl(tx.txHash, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-copper-300 underline underline-offset-2"
          >
            {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-6)} ↗
          </a>
          <CopyHash txHash={tx.txHash} />
        </div>
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
        <div className="mt-1 flex items-center gap-3">
          <a
            href={explorerTxUrl(tx.txHash, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-xs text-copper-300 underline underline-offset-2"
          >
            {tx.txHash.slice(0, 10)}…{tx.txHash.slice(-6)} ↗
          </a>
          <CopyHash txHash={tx.txHash} />
        </div>
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
    const notRegistered = /NOT_REGISTERED/.test(tx.detail);
    return (
      <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
        <p className="text-sm text-red-300">Transaction failed</p>
        <p className="mt-1 break-all font-mono text-xs text-graphite-400">
          {tx.detail}
        </p>
        {notRegistered ? (
          <p className="mt-2 text-xs leading-5 text-amber-300">
            Your account isn&apos;t registered with the privacy pool yet. Deploy
            it first: open your wallet, send any tiny transaction (e.g. 0.001
            STRK to any address — even your own), then retry. On a fresh
            testnet account the wallet can&apos;t register you until the account
            is deployed.
          </p>
        ) : null}
      </div>
    );
  }

  return null;
}
