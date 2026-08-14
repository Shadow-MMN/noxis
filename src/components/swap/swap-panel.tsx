"use client";

import { useEffect, useState } from "react";
import {
  createStrk20WalletProver,
  getQuotes,
  quoteToCalls,
  type Quote,
} from "@avnu/avnu-sdk";
import { useWallet } from "@/lib/wallet/wallet-context";
import {
  TOKENS,
  fmtAmount,
  parseAmount,
  tokenAddress,
  tokensForNetwork,
} from "@/lib/pool";
import { ConnectWallet } from "@/components/wallet/connect-button";
import { TokenSelect } from "@/components/actions/token-select";
import { explorerTxUrl } from "@/lib/pool";

const SLIPPAGE = 0.05; // 5%
const FEE_TOKEN = "STRK"; // pool fee is STRK-denominated

type SwapStep =
  | "idle"
  | "proving"
  | "submitting"
  | "pending"
  | "submitted"
  | "confirmed"
  | "failed";

// bigint-safe JSON for anything crossing to the server proxy.
function jsonBody(value: unknown): string {
  return JSON.stringify(value, (_k, v) =>
    typeof v === "bigint" ? v.toString() : v
  );
}

export function SwapPanel() {
  const { walletAccount, address, isConnected, strk20Capable, network } = useWallet();

  const [sell, setSell] = useState("USDC");
  const [buy, setBuy] = useState("STRK");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteError, setQuoteError] = useState("");
  const [step, setStep] = useState<SwapStep>("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const tokens = tokensForNetwork(network);
  const sellInfo =
    tokens.some((t) => t.symbol === sell) && sell in TOKENS
      ? TOKENS[sell]
      : TOKENS.STRK;
  const buyInfo =
    tokens.some((t) => t.symbol === buy) && buy in TOKENS ? TOKENS[buy] : TOKENS.STRK;
  const sellWei = parseAmount(amount, sellInfo.decimals);
  const samePair = sell === buy;

  // Fetch a quote whenever the sell amount changes (debounced).
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(() => {
      if (samePair || !sellWei || sellWei <= 0n || !address) {
        if (!cancelled) {
          setQuote(null);
          setQuoteError("");
        }
        return;
      }
      getQuotes({
        sellTokenAddress: tokenAddress(sellInfo, network),
        buyTokenAddress: tokenAddress(buyInfo, network),
        sellAmount: sellWei,
        takerAddress: address,
        size: 1,
      })
        .then((quotes) => {
          if (cancelled) return;
          if (!quotes?.length) {
            setQuote(null);
            setQuoteError("No route found for this pair.");
          } else {
            setQuote(quotes[0]);
            setQuoteError("");
          }
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setQuote(null);
          setQuoteError(err instanceof Error ? err.message : String(err));
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [sell, buy, sellWei, address, samePair, sellInfo, buyInfo, network]);

  const handleSwap = async () => {
    if (!walletAccount || !quote || !sellWei || sellWei <= 0n) return;
    setStep("proving");
    setError("");
    try {
      // 1. Pool fee from the paymaster (server-side key).
      const feeRes = await fetch("/api/private-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({ action: "fee", feeMode: { poolFeeToken: FEE_TOKEN } }),
      });
      const feeJson = (await feeRes.json()) as {
        fee?: { token: string; recipient: string; amount: string };
        error?: string;
      };
      if (!feeRes.ok || !feeJson.fee) {
        throw new Error(
          feeJson.error ?? "Could not fetch the pool fee (paymaster key set?)"
        );
      }
      const fee = {
        token: feeJson.fee.token,
        recipient: feeJson.fee.recipient,
        amount: BigInt(feeJson.fee.amount),
      };

      // 2. Private swap calls (backend sets taker = executor).
      const { calls, executorAddress } = await quoteToCalls({
        quoteId: quote.quoteId,
        slippage: SLIPPAGE,
        private: true,
      });
      if (!executorAddress) {
        throw new Error(
          "AVNU returned no executor for this private swap — try a smaller amount or a different pair."
        );
      }

      // 3. Prove client-side with the user's wallet — keys never leave it.
      setStep("proving");
      const prover = createStrk20WalletProver(walletAccount);
      const callAndProof = await prover.buildAndProve({
        sellTokenAddress: tokenAddress(sellInfo, network),
        sellAmount: sellWei,
        buyTokenAddress: tokenAddress(buyInfo, network),
        executorAddress,
        executorCalls: calls,
        fee,
        takerAddress: address,
      });

      // 4. Submit through the paymaster (server-side key).
      setStep("submitting");
      const submitRes = await fetch("/api/private-swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody({
          action: "submit",
          callAndProof,
          feeMode: { poolFeeToken: FEE_TOKEN },
        }),
      });
      const submitJson = (await submitRes.json()) as {
        transactionHash?: string;
        error?: string;
      };
      if (!submitRes.ok || !submitJson.transactionHash) {
        throw new Error(submitJson.error ?? "Paymaster rejected the swap.");
      }
      setTxHash(submitJson.transactionHash);
      setStep("pending");
      try {
        await walletAccount.provider.waitForTransaction(submitJson.transactionHash, {
          retries: 60,
          retryInterval: 3000,
        });
        setStep("confirmed");
      } catch {
        setStep("submitted");
      }
    } catch (err) {
      setStep("failed");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  if (isConnected && !strk20Capable) {
    return (
      <p className="max-w-xl rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-300">
        Private swaps need a STRK20-capable wallet — install{" "}
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
    );
  }

  if (network !== "Mainnet") {
    return (
      <p className="max-w-xl rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm leading-6 text-amber-300">
        Private swaps run on Mainnet for now — switch your wallet to Mainnet to
        trade. Shield / send / unshield all work on Sepolia.
      </p>
    );
  }

  const busy = step === "proving" || step === "submitting" || step === "pending";

  return (
    <div className="max-w-xl rounded-xl border border-graphite-800 bg-graphite-850 p-6">
      {/* Sell */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-medium tracking-wide text-graphite-400">
            SELL
          </label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.00"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-2 w-44 rounded-lg border border-graphite-700 bg-graphite-800 px-4 py-3 font-mono text-xl text-graphite-50 outline-none transition-colors placeholder:text-graphite-600 focus:border-copper-500"
          />
        </div>
        <div className="pt-5">
          <TokenSelect value={sell} onChange={setSell} />
        </div>
      </div>

      {/* Buy */}
      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <label className="block text-xs font-medium tracking-wide text-graphite-400">
            BUY
          </label>
          <p className="mt-2 font-mono text-xl text-graphite-50">
            {quote ? (
              <>
                {fmtAmount(quote.buyAmount, buyInfo.decimals)}{" "}
                <span className="text-sm text-graphite-400">{buyInfo.symbol}</span>
              </>
            ) : (
              <span className="text-graphite-600">—</span>
            )}
          </p>
        </div>
        <div className="pt-5">
          <TokenSelect value={buy} onChange={setBuy} />
        </div>
      </div>

      {samePair ? (
        <p className="mt-3 text-xs text-amber-400">
          Pick two different tokens to swap.
        </p>
      ) : null}

      {quote ? (
        <div className="mt-4 space-y-1 font-mono text-xs text-graphite-400">
          <p>
            You receive ≈{" "}
            <span className="text-graphite-200">
              {fmtAmount(quote.buyAmount, buyInfo.decimals)} {buyInfo.symbol}
            </span>{" "}
            for {fmtAmount(sellWei!, sellInfo.decimals)} {sellInfo.symbol}
          </p>
          <p>
            Price impact:{" "}
            <span className="text-graphite-200">
              {(quote.priceImpact * 100).toFixed(2)}%
            </span>
          </p>
          <p>
            Max slippage:{" "}
            <span className="text-graphite-200">{SLIPPAGE * 100}%</span>
          </p>
        </div>
      ) : null}

      {quoteError ? (
        <p className="mt-3 text-xs leading-5 text-amber-400">{quoteError}</p>
      ) : null}

      <div className="mt-6">
        {isConnected ? (
          <button
            type="button"
            onClick={handleSwap}
            disabled={busy || !quote || !sellWei || sellWei <= 0n || samePair}
            className="w-full rounded-lg bg-copper-500 px-6 py-3 text-sm font-medium text-graphite-950 transition-colors hover:bg-copper-400 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {step === "proving"
              ? "Generating proof…"
              : step === "submitting"
              ? "Submitting…"
              : "Swap privately"}
          </button>
        ) : (
          <div className="flex justify-center">
            <ConnectWallet />
          </div>
        )}
        <p className="mt-3 text-xs leading-5 text-graphite-500">
          Your {sellInfo.symbol} must already be shielded. The swap is relayed
          gaslessly — the pool fee (STRK-denominated) is paid from your
          shielded balance. The seller, buyer and amounts stay private.
        </p>
      </div>

      {step === "pending" || step === "submitted" ? (
        <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-amber-300">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-amber-400" />
            {step === "pending"
              ? "Waiting for confirmation — relayed transactions can take a moment…"
              : "Submitted — confirmation pending on-chain. Check the explorer."}
          </p>
          <div className="mt-1 flex items-center gap-3">
            <a
              href={explorerTxUrl(txHash, network)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs text-copper-300 underline underline-offset-2"
            >
              {txHash.slice(0, 10)}…{txHash.slice(-6)} ↗
            </a>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(txHash).catch(() => {});
              }}
              className="font-mono text-xs text-graphite-400 transition-colors hover:text-copper-300"
            >
              copy hash
            </button>
          </div>
        </div>
      ) : null}

      {step === "confirmed" ? (
        <div className="mt-4 rounded-lg border border-sage-500/30 bg-sage-500/10 px-4 py-3">
          <p className="flex items-center gap-2 text-sm text-sage-400">
            <span className="inline-block h-2 w-2 rounded-full bg-sage-500" />
            Swap confirmed ✓ — {buyInfo.symbol} is in your shielded balance.
          </p>
          <a
            href={explorerTxUrl(txHash, network)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block font-mono text-xs text-copper-300 underline underline-offset-2"
          >
            {txHash.slice(0, 10)}…{txHash.slice(-6)} ↗
          </a>
        </div>
      ) : null}

      {step === "failed" ? (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-sm text-red-300">Swap failed</p>
          <p className="mt-1 break-all font-mono text-xs text-graphite-400">
            {error}
          </p>
        </div>
      ) : null}
    </div>
  );
}
