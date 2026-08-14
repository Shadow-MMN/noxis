"use client";

import { useEffect, useState } from "react";
import { num } from "starknet";
import type { WALLET_API } from "@starknet-io/types-js";
import { useWallet } from "@/lib/wallet/wallet-context";
import {
  STRK_ADDRESS,
  fmtStrk,
  isValidAddress,
  readPoolFee,
  strkToWei,
} from "@/lib/pool";
import { ConnectWallet } from "@/components/wallet/connect-button";
import { TxStatusCard, isScreeningError, type TxState } from "@/components/actions/tx-status";

const RPC_URL = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;

export function TransferPanel() {
  const { walletAccount, address, isConnected, strk20Capable, network } = useWallet();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState<bigint | null>(null);
  const [tx, setTx] = useState<TxState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  // Read the live pool fee (mainnet) for the fee note — never assume it.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!RPC_URL || network !== "Mainnet") {
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
  }, [network]);

  const amountWei = strkToWei(amount);
  const recipientOk = recipient.trim() !== "" && isValidAddress(recipient);
  const recipientIsSelf =
    recipientOk && address !== "" && BigInt(recipient) === BigInt(address);

  const handleTransfer = async () => {
    if (!walletAccount || !amountWei || amountWei <= 0n || !recipientOk) return;
    setBusy(true);
    setTx({ status: "idle" });
    try {
      const actions: WALLET_API.STRK20_ACTION[] = [
        {
          type: "transfer",
          token: STRK_ADDRESS,
          amount: num.toHex(amountWei),
          recipient: recipient.trim(),
        },
      ];
      const res = await walletAccount.strk20InvokeTransaction(actions);
      const txHash = res.transaction_hash;
      setTx({ status: "pending", txHash });
      try {
        await walletAccount.provider.waitForTransaction(txHash, {
          retries: 60,
          retryInterval: 3000,
        });
        setTx({
          status: "confirmed",
          txHash,
          detail: `Sent ${fmtStrk(amountWei)} STRK privately ✓`,
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
        to send privately.
      </p>
    );
  }

  return (
    <div className="max-w-xl rounded-xl border border-graphite-800 bg-graphite-850 p-6">
      <div>
        <label
          htmlFor="transfer-recipient"
          className="block text-xs font-medium tracking-wide text-graphite-400"
        >
          RECIPIENT (STARKNET ADDRESS)
        </label>
        <input
          id="transfer-recipient"
          type="text"
          placeholder="0x…"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className="mt-2 w-full rounded-lg border border-graphite-700 bg-graphite-800 px-4 py-3 font-mono text-sm text-graphite-50 outline-none transition-colors placeholder:text-graphite-600 focus:border-copper-500"
        />
        {recipient.trim() !== "" && !recipientOk ? (
          <p className="mt-1.5 text-xs text-red-400">
            Not a valid Starknet address.
          </p>
        ) : null}
        {recipientIsSelf ? (
          <p className="mt-1.5 text-xs text-graphite-500">
            That&apos;s your own address — a self-transfer.
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <label
          htmlFor="transfer-amount"
          className="block text-xs font-medium tracking-wide text-graphite-400"
        >
          AMOUNT (STRK)
        </label>
        <input
          id="transfer-amount"
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="mt-2 w-48 rounded-lg border border-graphite-700 bg-graphite-800 px-4 py-3 font-mono text-xl text-graphite-50 outline-none transition-colors placeholder:text-graphite-600 focus:border-copper-500"
        />
      </div>

      <p className="mt-3 text-xs leading-5 text-graphite-400">
        {fee !== null
          ? `Pool fee ≈ ${fmtStrk(fee)} STRK applies to this transfer. `
          : ""}
        Only matured notes are spendable — notes settle ~10 blocks after
        shielding.
      </p>

      <div className="mt-6">
        {isConnected ? (
          <button
            type="button"
            onClick={handleTransfer}
            disabled={
              busy || !amountWei || amountWei <= 0n || !recipientOk || recipientIsSelf
            }
            className="w-full rounded-lg bg-copper-500 px-6 py-3 text-sm font-medium text-graphite-950 transition-colors hover:bg-copper-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Sending…" : "Send privately"}
          </button>
        ) : (
          <div className="flex justify-center">
            <ConnectWallet />
          </div>
        )}
        <p className="mt-3 text-xs leading-5 text-graphite-500">
          Sender, recipient and amount stay hidden. Only the fact that a
          transfer happened is visible on-chain.
        </p>
      </div>

      <TxStatusCard tx={tx} network={network} />
    </div>
  );
}
