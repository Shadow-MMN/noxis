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

export function UnshieldPanel() {
  const { walletAccount, address, isConnected, strk20Capable, network } = useWallet();

  // User-typed override; empty means "withdraw to the connected account".
  // Derived (not copied into state) so a fresh account can break the link.
  const [override, setOverride] = useState("");
  const recipient = override === "" ? address : override;
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

  const handleUnshield = async () => {
    if (!walletAccount || !amountWei || amountWei <= 0n || !recipientOk) return;
    setBusy(true);
    setTx({ status: "idle" });
    try {
      const actions: WALLET_API.STRK20_ACTION[] = [
        {
          type: "withdraw",
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
          detail: `Unshielded ${fmtStrk(amountWei)} STRK ✓`,
          note: "The withdrawal amount is public — anyone can see this leg.",
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
        to unshield.
      </p>
    );
  }

  return (
    <div className="max-w-xl rounded-xl border border-graphite-800 bg-graphite-850 p-6">
      <div>
        <label
          htmlFor="unshield-recipient"
          className="block text-xs font-medium tracking-wide text-graphite-400"
        >
          WITHDRAW TO
        </label>
        <input
          id="unshield-recipient"
          type="text"
          placeholder="0x…"
          value={recipient}
          onChange={(e) => setOverride(e.target.value)}
          className="mt-2 w-full rounded-lg border border-graphite-700 bg-graphite-800 px-4 py-3 font-mono text-sm text-graphite-50 outline-none transition-colors placeholder:text-graphite-600 focus:border-copper-500"
        />
        {override !== "" && !recipientOk ? (
          <p className="mt-1.5 text-xs text-red-400">
            Not a valid Starknet address.
          </p>
        ) : null}
        {recipientIsSelf ? (
          <p className="mt-1.5 text-xs text-graphite-500">
            {override === ""
              ? "Your connected account — paste a fresh address to break the deposit link further."
              : "That's your connected account."}
          </p>
        ) : null}
      </div>

      <div className="mt-4">
        <label
          htmlFor="unshield-amount"
          className="block text-xs font-medium tracking-wide text-graphite-400"
        >
          AMOUNT (STRK)
        </label>
        <input
          id="unshield-amount"
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
          ? `Pool fee ≈ ${fmtStrk(fee)} STRK applies to this withdrawal. `
          : ""}
        The withdrawal amount is public — that&apos;s the ERC-20 leg back to
        transparent Starknet.
      </p>

      <div className="mt-6">
        {isConnected ? (
          <button
            type="button"
            onClick={handleUnshield}
            disabled={busy || !amountWei || amountWei <= 0n || !recipientOk}
            className="w-full rounded-lg bg-copper-500 px-6 py-3 text-sm font-medium text-graphite-950 transition-colors hover:bg-copper-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Unshielding…" : "Unshield"}
          </button>
        ) : (
          <div className="flex justify-center">
            <ConnectWallet />
          </div>
        )}
      </div>

      <TxStatusCard tx={tx} network={network} />
    </div>
  );
}
