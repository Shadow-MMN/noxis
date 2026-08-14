"use client";

import { useCallback, useEffect, useState } from "react";
import { num } from "starknet";
import type { WALLET_API } from "@starknet-io/types-js";
import { useWallet } from "@/lib/wallet/wallet-context";
import {
  STRK_ADDRESS,
  fmtStrk,
  readPoolFee,
  readStrkBalance,
  strkToWei,
} from "@/lib/pool";
import { ConnectWallet } from "@/components/wallet/connect-button";
import {
  TxStatusCard,
  isScreeningError,
  type TxState,
} from "@/components/actions/tx-status";

const RPC_URL = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;

export function ShieldPanel() {
  const { walletAccount, address, isConnected, strk20Capable, network } = useWallet();

  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState<bigint | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [tx, setTx] = useState<TxState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  const onMainnet = network === "Mainnet";

  // Read the live pool fee (mainnet) — never assume it.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!RPC_URL || !onMainnet) {
        if (!cancelled) setFee(null);
        return;
      }
      try {
        const f = await readPoolFee(RPC_URL);
        if (!cancelled) setFee(f);
      } catch {
        if (!cancelled) setFee(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [onMainnet]);

  // Refresh the public STRK balance for the MAX button.
  const refreshBalance = useCallback(() => {
    if (!walletAccount || !address || !onMainnet) {
      return Promise.resolve(null);
    }
    return readStrkBalance(walletAccount, address).catch(() => null);
  }, [walletAccount, address, onMainnet]);

  useEffect(() => {
    let cancelled = false;
    refreshBalance().then((b: bigint | null) => {
      if (!cancelled) setBalance(b);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshBalance]);

  const amountWei = strkToWei(amount);
  const maxWei = balance !== null && fee !== null ? balance - fee : null;
  const exceedsBalance =
    amountWei !== null && balance !== null && amountWei > balance;

  const handleMax = () => {
    if (maxWei !== null && maxWei > 0n) setAmount(fmtStrk(maxWei));
  };

  const handleShield = async () => {
    if (!walletAccount || !amountWei || amountWei <= 0n) return;
    setBusy(true);
    setTx({ status: "idle" });
    try {
      const actions: WALLET_API.STRK20_ACTION[] = [
        { type: "deposit", token: STRK_ADDRESS, amount: num.toHex(amountWei) },
      ];
      const res = await walletAccount.strk20InvokeTransaction(actions);
      const txHash = res.transaction_hash;
      setTx({ status: "pending", txHash });
      try {
        await walletAccount.provider.waitForTransaction(txHash, {
          retries: 60,
          retryInterval: 3000,
        });
        refreshBalance();
        setTx({
          status: "confirmed",
          txHash,
          detail: `Shielded ${fmtStrk(amountWei)} STRK ✓`,
          note: "Your note matures in ~10 blocks before it can be spent — you'll see it in private transfers shortly after.",
        });
      } catch {
        // Relayed txs can lag your RPC — treat the ceiling as "submitted"
        // and hand the explorer link to the user.
        setTx({ status: "submitted", txHash });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const txHash = tx.status === "pending" ? tx.txHash : "";
      setTx(
        isScreeningError(message)
          ? { status: "declined", txHash, detail: message }
          : { status: "failed", detail: message }
      );
    } finally {
      setBusy(false);
    }
  };

  // Connected but wallet lacks STRK20 support.
  if (isConnected && !strk20Capable) {
    return (
      <p className="max-w-xl rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-300">
        Your connected wallet doesn&apos;t support STRK20 privacy yet. Install{" "}
        <a
          href="https://www.ready.co/"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-2"
        >
          Ready X
        </a>{" "}
        to shield STRK.
      </p>
    );
  }

  return (
    <div className="max-w-xl rounded-xl border border-graphite-800 bg-graphite-850 p-6">
      {/* Token + amount */}
      <div className="flex items-end justify-between gap-4">
        <div>
          <label
            htmlFor="shield-amount"
            className="block text-xs font-medium tracking-wide text-graphite-400"
          >
            AMOUNT (STRK)
          </label>
          <input
            id="shield-amount"
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-2 w-48 rounded-lg border border-graphite-700 bg-graphite-800 px-4 py-3 font-mono text-xl text-graphite-50 outline-none transition-colors placeholder:text-graphite-600 focus:border-copper-500"
          />
        </div>
        <button
          type="button"
          onClick={handleMax}
          disabled={maxWei === null || maxWei <= 0n}
          title={
            maxWei === null
              ? "Connect on Mainnet to use MAX"
              : `Reserves the ${fee !== null ? fmtStrk(fee) : ""} STRK pool fee`
          }
          className="rounded-lg border border-graphite-700 px-4 py-3 text-xs font-medium text-graphite-200 transition-colors hover:border-copper-500 hover:text-copper-300 disabled:opacity-40"
        >
          MAX
        </button>
      </div>

      {/* Fee + balance line */}
      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs text-graphite-400">
        {fee !== null ? (
          <span>
            Pool fee ≈{" "}
            <span className="text-graphite-200">{fmtStrk(fee)} STRK</span>
          </span>
        ) : null}
        {balance !== null ? (
          <span>
            Balance{" "}
            <span className="text-graphite-200">{fmtStrk(balance)} STRK</span>
          </span>
        ) : null}
        {!onMainnet && isConnected ? (
          <span className="text-amber-400">
            MAX &amp; fee display are Mainnet-only for now — enter an amount
            manually
          </span>
        ) : null}
      </div>

      {exceedsBalance ? (
        <p className="mt-3 text-xs leading-5 text-amber-400">
          Amount exceeds your public STRK balance.
        </p>
      ) : null}

      {/* Action */}
      <div className="mt-6">
        {isConnected ? (
          <button
            type="button"
            onClick={handleShield}
            disabled={busy || !amountWei || amountWei <= 0n || exceedsBalance}
            className="w-full rounded-lg bg-copper-500 px-6 py-3 text-sm font-medium text-graphite-950 transition-colors hover:bg-copper-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Shielding…" : "Shield STRK"}
          </button>
        ) : (
          <div className="flex justify-center">
            <ConnectWallet />
          </div>
        )}
        <p className="mt-3 text-xs leading-5 text-graphite-500">
          You&apos;ll approve <span className="text-graphite-300">twice</span> in
          your wallet — first the STRK allowance, then the shield deposit. That
          is normal, not a duplicate.
        </p>
      </div>

      {/* Transaction state */}
      <TxStatusCard tx={tx} network={network} />
    </div>
  );
}
