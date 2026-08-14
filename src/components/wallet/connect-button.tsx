"use client";

import { useState } from "react";
import { useWallet } from "@/lib/wallet/wallet-context";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";

// Normalize wallet display names so MetaMask / Braavos detection is robust
// to casing and separators.
function normalizeId(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

// Show every detected wallet except MetaMask (its Snap probing spams an
// unlock popup) and Braavos (not STRK20-ready as of writing).
function pickable(wallets: WalletWithStarknetFeatures[]): WalletWithStarknetFeatures[] {
  return wallets.filter((w) => {
    const id = normalizeId(w.name);
    return !id.includes("metamask") && !id.includes("braavos");
  });
}

export function ConnectWallet() {
  const {
    wallets,
    address,
    network,
    isConnected,
    connecting,
    error,
    pickerOpen,
    strk20Capable,
    openPicker,
    closePicker,
    connect,
    disconnect,
  } = useWallet();
  const [selectedName, setSelectedName] = useState("");

  const list = pickable(wallets);
  const shortAddr = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "";

  const handleSelect = async (w: WalletWithStarknetFeatures) => {
    setSelectedName(w.name);
    await connect(w);
    closePicker();
    setSelectedName("");
  };

  // Connected state: address pill + privacy capability, click to disconnect.
  if (isConnected && address) {
    return (
      <div className="flex flex-col items-start gap-2 sm:items-end">
        <button
          type="button"
          onClick={disconnect}
          title="Disconnect"
          className="flex items-center gap-2 rounded-lg border border-graphite-700 bg-graphite-850 px-4 py-2.5 font-mono text-sm text-graphite-200 transition-colors hover:border-copper-500 hover:text-copper-300"
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              strk20Capable ? "bg-sage-500" : "bg-amber-500"
            }`}
          />
          {shortAddr}
          {network ? <span className="text-graphite-500">· {network}</span> : null}
        </button>
        {!strk20Capable && (
          <p className="max-w-xs text-xs leading-5 text-amber-400">
            This wallet doesn&apos;t support STRK20 privacy yet — install{" "}
            <a
              href="https://www.ready.co/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-amber-500/50 underline-offset-2 hover:text-amber-300"
            >
              Ready X
            </a>{" "}
            or{" "}
            <a
              href="https://www.xverse.app/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-amber-500/50 underline-offset-2 hover:text-amber-300"
            >
              Xverse
            </a>{" "}
            to use private payments.
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className="rounded-lg bg-copper-500 px-6 py-3 text-sm font-medium text-graphite-950 transition-colors hover:bg-copper-400"
      >
        Connect wallet
      </button>

      {pickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => !connecting && closePicker()}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-graphite-700 bg-graphite-850 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold tracking-wide text-graphite-50">
                Connect a wallet
              </h2>
              <button
                type="button"
                onClick={closePicker}
                aria-label="Close"
                disabled={connecting}
                className="text-graphite-400 transition-colors hover:text-graphite-100"
              >
                ✕
              </button>
            </div>

            {list.length ? (
              <ul className="mt-4 space-y-2">
                {list.map((w) => (
                  <li key={w.name}>
                    <button
                      type="button"
                      disabled={connecting}
                      onClick={() => handleSelect(w)}
                      className="flex w-full items-center gap-3 rounded-lg border border-graphite-700 bg-graphite-800 px-4 py-3 text-left transition-colors hover:border-copper-500 disabled:opacity-50"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img className="h-6 w-6 rounded-full" src={w.icon} alt="" />
                      <span className="flex-1 text-sm font-medium text-graphite-100">
                        {w.name}
                      </span>
                      <span className="font-mono text-xs text-graphite-400">
                        {connecting && selectedName === w.name ? "connecting…" : "→"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm leading-6 text-graphite-300">
                No STRK20-ready wallet detected. Install{" "}
                <a
                  href="https://www.ready.co/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-copper-300 underline underline-offset-2"
                >
                  Ready X
                </a>{" "}
                or{" "}
                <a
                  href="https://www.xverse.app/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-copper-300 underline underline-offset-2"
                >
                  Xverse
                </a>{" "}
                and refresh.
              </p>
            )}

            {error && (
              <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs leading-5 text-red-300">
                {error}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
