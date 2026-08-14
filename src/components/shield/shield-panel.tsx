"use client";

import { useCallback, useEffect, useState } from "react";
import { num } from "starknet";
import type { WALLET_API } from "@starknet-io/types-js";
import { useWallet } from "@/lib/wallet/wallet-context";
import {
  TOKENS,
  fmtAmount,
  parseAmount,
  readPoolFee,
  readTokenBalance,
} from "@/lib/pool";
import { ConnectWallet } from "@/components/wallet/connect-button";
import { TokenSelect } from "@/components/actions/token-select";
import {
  TxStatusCard,
  isScreeningError,
  type TxState,
} from "@/components/actions/tx-status";

const RPC_URL = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;

export function ShieldPanel() {
  const { walletAccount, address, isConnected, strk20Capable, network } = useWallet();

  const [token, setToken] = useState("STRK");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState<bigint | null>(null);
  const [balance, setBalance] = useState<bigint | null>(null);
  const [tx, setTx] = useState<TxState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  const info = TOKENS[token];
  const onMainnet = network === "Mainnet";

  // Read the live pool fee (mainnet) — never assume it. STRK-denominated.
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

  // Refresh the public balance of the selected token for the MAX button.
  const refreshBalance = useCallback(() => {
    if (!walletAccount || !address || !onMainnet) {
      return Promise.resolve(null);
    }
    return readTokenBalance(walletAccount, address, TOKENS[token]).catch(() => null);
  }, [walletAccount, address, onMainnet, token]);

  useEffect(() => {
    let cancelled = false;
    refreshBalance().then((b: bigint | null) => {
      if (!cancelled) setBalance(b);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshBalance]);

  const amountWei = parseAmount(amount, info.decimals);
  // The pool fee is STRK-denominated, so MAX only makes sense for STRK.
  const maxWei =
    token === "STRK" && balance !== null && fee !== null ? balance - fee : null;
  const exceedsBalance =
    amountWei !== null && balance !== null && amountWei > balance;

  const handleMax = () => {
    if (maxWei !== null && maxWei > 0n) setAmount(fmtAmount(maxWei, info.decimals));
  };

  const handleShield = async () => {
    if (!walletAccount || !amountWei || amountWei <= 0n) return;
    setBusy(true);
    setTx({ status: "idle" });
    try {
      const actions: WALLET_API.STRK20_ACTION[] = [
        { type: "deposit", token: info.address, amount: num.toHex(amountWei) },
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
          detail: `Shielded ${fmtAmount(amountWei, info.decimals)} ${info.symbol} ✓`,
          note: "Your note matures in ~10 blocks before it can be spent — you'll see it in private transfers shortly after.",
        });
      } catch {
        setTx({ status: "submitted", txHash });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setTx(
        isScreeningError(message)
          ? { status: "declined", txHash: "", detail: message }
          : { status: "failed", detail: message }
      );
    } finally {
      setBusy(false);
    }
  };

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
        to shield.
      </p>
    );
  }

  return (
    <div className="max-w-xl rounded-xl border border-graphite-800 bg-graphite-850 p-6">
      <div className="flex items-center justify-between gap-4">
        <TokenSelect value={token} onChange={setToken} />
        <button
          type="button"
          onClick={handleMax}
          disabled={maxWei === null || maxWei <= 0n}
          title={
            maxWei === null
              ? token === "STRK"
                ? "Connect on Mainnet to use MAX"
                : "MAX is STRK-only — the pool fee is STRK-denominated"
              : `Reserves the ${fee !== null ? fmtAmount(fee, 18) : ""} STRK pool fee`
          }
          className="rounded-lg border border-graphite-700 px-4 py-2 text-xs font-medium text-graphite-200 transition-colors hover:border-copper-500 hover:text-copper-300 disabled:opacity-40"
        >
          MAX
        </button>
      </div>

      <div className="mt-4">
        <label
          htmlFor="shield-amount"
          className="block text-xs font-medium tracking-wide text-graphite-400"
        >
          AMOUNT ({info.symbol})
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

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-xs text-graphite-400">
        {fee !== null ? (
          <span>
            Pool fee ≈{" "}
            <span className="text-graphite-200">{fmtAmount(fee, 18)} STRK</span>
          </span>
        ) : null}
        {balance !== null ? (
          <span>
            Balance{" "}
            <span className="text-graphite-200">
              {fmtAmount(balance, info.decimals)} {info.symbol}
            </span>
          </span>
        ) : null}
        {!onMainnet && isConnected ? (
          <span className="text-amber-400">
            Fee &amp; MAX need the Mainnet pool — switch your wallet network
          </span>
        ) : null}
        {token !== "STRK" && onMainnet ? (
          <span className="text-graphite-500">
            reserve STRK for the pool fee
          </span>
        ) : null}
      </div>

      {exceedsBalance ? (
        <p className="mt-3 text-xs leading-5 text-amber-400">
          Amount exceeds your public {info.symbol} balance.
        </p>
      ) : null}

      <div className="mt-6">
        {isConnected ? (
          <button
            type="button"
            onClick={handleShield}
            disabled={busy || !amountWei || amountWei <= 0n || exceedsBalance}
            className="w-full rounded-lg bg-copper-500 px-6 py-3 text-sm font-medium text-graphite-950 transition-colors hover:bg-copper-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Shielding…" : `Shield ${info.symbol}`}
          </button>
        ) : (
          <div className="flex justify-center">
            <ConnectWallet />
          </div>
        )}
        <p className="mt-3 text-xs leading-5 text-graphite-500">
          You&apos;ll approve <span className="text-graphite-300">twice</span> in
          your wallet — first the {info.symbol} allowance, then the shield
          deposit. That is normal, not a duplicate.
        </p>
      </div>

      <TxStatusCard tx={tx} network={network} />
    </div>
  );
}
