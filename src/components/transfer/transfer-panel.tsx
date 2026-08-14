"use client";

import { useEffect, useState } from "react";
import { num } from "starknet";
import type { WALLET_API } from "@starknet-io/types-js";
import { useWallet } from "@/lib/wallet/wallet-context";
import {
  TOKENS,
  fmtAmount,
  isValidAddress,
  parseAmount,
  readPoolFee,
  tokenAddress,
  tokensForNetwork,
} from "@/lib/pool";
import { ConnectWallet } from "@/components/wallet/connect-button";
import { TokenSelect } from "@/components/actions/token-select";
import {
  TxStatusCard,
  isScreeningError,
  type TxState,
} from "@/components/actions/tx-status";

export function TransferPanel() {
  const { walletAccount, address, isConnected, strk20Capable, network, rpcUrl } =
    useWallet();

  const [token, setToken] = useState("STRK");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [fee, setFee] = useState<bigint | null>(null);
  const [tx, setTx] = useState<TxState>({ status: "idle" });
  const [busy, setBusy] = useState(false);

  // Fall back to STRK when the selected token isn't deployed on this network.
  const tokens = tokensForNetwork(network);
  const info =
    tokens.some((t) => t.symbol === token) && token in TOKENS
      ? TOKENS[token]
      : TOKENS.STRK;

  // Read the live pool fee on the connected network for the fee note.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!rpcUrl) {
        if (!cancelled) setFee(null);
        return;
      }
      try {
        const f = await readPoolFee(rpcUrl, network);
        if (!cancelled) setFee(f);
      } catch {
        if (!cancelled) setFee(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [rpcUrl, network]);

  const amountWei = parseAmount(amount, info.decimals);
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
          token: tokenAddress(info, network),
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
          detail: `Sent ${fmtAmount(amountWei, info.decimals)} ${info.symbol} privately ✓`,
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
      <TokenSelect value={info.symbol} onChange={setToken} tokens={tokens} />

      <div className="mt-4">
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
          AMOUNT ({info.symbol})
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
          ? `Pool fee ≈ ${fmtAmount(fee, 18)} STRK (STRK-denominated) applies. `
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
