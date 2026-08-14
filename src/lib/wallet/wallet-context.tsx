"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useSyncExternalStore,
  useState,
  type ReactNode,
} from "react";
import {
  compareVersions,
  constants,
  validateAndParseAddress,
  WalletAccountV6,
  walletV6,
} from "starknet";
import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";
import { rpcUrlFor } from "@/lib/pool";

// Lazy singleton discovery store — created once, shared across mounts.
// eip1193Adapters: [] keeps MetaMask's Snap probing out of discovery entirely.
let store: Store | undefined;
function getStore(): Store {
  if (!store) store = createStore({ eip1193Adapters: [] });
  return store;
}

// useSyncExternalStore requires a referentially stable snapshot: if the
// snapshot is a fresh array on every render, React re-renders forever. The
// discovery store's getWallets() clones the array every call, so cache the
// snapshot and only swap it when the wallet list actually changes (element
// identity — wallets are stable objects until they're replaced).
let cachedWallets: WalletWithStarknetFeatures[] = [];
function getWalletsSnapshot(): WalletWithStarknetFeatures[] {
  const next = getStore().getWallets();
  if (
    next.length !== cachedWallets.length ||
    next.some((w, i) => w !== cachedWallets[i])
  ) {
    cachedWallets = next;
  }
  return cachedWallets;
}

// STRK20-capable if the wallet supports the Privacy Wallet API >= 0.10.
// Detected with a version query (supportedSpecs) — never a data call like
// strk20Balances, which would prompt the user to disclose balances.
function isStrk20Capable(specs: string[]): boolean {
  return (specs ?? []).some((v) => {
    const [maj, min] = v.split(".").map((n) => Number(n));
    return (maj ?? 0) > 0 || ((maj ?? 0) === 0 && (min ?? 0) >= 10);
  });
}

function networkName(chainId: string): string {
  if (!chainId) return "";
  try {
    if (BigInt(chainId) === BigInt(constants.StarknetChainId.SN_MAIN)) return "Mainnet";
    if (BigInt(chainId) === BigInt(constants.StarknetChainId.SN_SEPOLIA)) return "Sepolia";
  } catch {
    /* fall through */
  }
  return chainId;
}

interface WalletContextValue {
  wallets: WalletWithStarknetFeatures[];
  walletAccount: WalletAccountV6 | undefined;
  address: string;
  chainId: string;
  network: string;
  rpcUrl: string;
  isConnected: boolean;
  connecting: boolean;
  error: string;
  pickerOpen: boolean;
  strk20Capable: boolean;
  openPicker: () => void;
  closePicker: () => void;
  connect: (wallet: WalletWithStarknetFeatures) => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function WalletProvider({ children }: { children: ReactNode }) {
  const wallets = useSyncExternalStore(
    useCallback((onChange: () => void) => getStore().subscribe(onChange), []),
    getWalletsSnapshot,
    getWalletsSnapshot
  );
  const [walletAccount, setWalletAccount] = useState<WalletAccountV6 | undefined>();
  const [address, setAddress] = useState("");
  const [chainId, setChainId] = useState("");
  const [isConnected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [strk20Capable, setStrk20Capable] = useState(false);

  const connect = useCallback(async (selected: WalletWithStarknetFeatures) => {
    setError("");
    setConnecting(true);
    try {
      // Connect first (no prompts), then request accounts. Chain-ID queries
      // only happen once the wallet has a session — some wallets hang or
      // reject pre-session RPC calls, which would make connect appear dead.
      const myWA = await WalletAccountV6.connect(
        { nodeUrl: rpcUrlFor("Mainnet") },
        selected
      );
      setWalletAccount(myWA);

      const accounts = await walletV6.requestAccounts(selected);
      if (typeof accounts === "string") {
        throw new Error("This wallet is not compatible with the Starknet Wallet API.");
      }
      if (Array.isArray(accounts) && accounts.length) {
        setAddress(validateAndParseAddress(accounts[0]));
      }

      // Everything below is introspection — if any probe fails, keep the
      // connection and degrade gracefully instead of resetting it (which
      // looked like "I confirmed but the dapp forgot me").
      let granted = Array.isArray(accounts) && accounts.length > 0;
      try {
        const permissions = await walletV6.getPermissions(selected);
        granted =
          Array.isArray(permissions) && permissions.includes("accounts");
      } catch {
        /* keep accounts-derived default */
      }
      setConnected(granted);

      try {
        const id = (await walletV6.requestChainId(selected)) as string;
        setChainId(id);
        // Point the WalletAccount at the wallet's actual network so reads and
        // waits target the right chain (testnet-first). Cheap — it only
        // constructs the account object. On failure, keep the initial one.
        const net = networkName(id);
        if (net !== "Mainnet") {
          try {
            const wa = await WalletAccountV6.connect(
              { nodeUrl: rpcUrlFor(net) },
              selected
            );
            setWalletAccount(wa);
          } catch {
            /* keep mainnet-RPC account; reads may lag until reconnect */
          }
        }
      } catch {
        /* chain probe failed — network shows empty */
      }

      let capable = false;
      // AVNU's documented probe: the STRK20 methods ship with wallet API
      // >= 0.10.3 (wallet_supportedWalletApi). Some wallets only advertise
      // this there, not in supportedSpecs — try it first, then fall back.
      try {
        const apiVersions = await walletV6.supportedWalletApi(selected);
        capable =
          Array.isArray(apiVersions) &&
          apiVersions.some((v) => compareVersions(String(v), "0.10.3") >= 0);
      } catch {
        /* wallet predates supportedWalletApi — fall through to specs */
      }
      if (!capable) {
        try {
          const specs = await walletV6.supportedSpecs(selected);
          capable = isStrk20Capable(Array.isArray(specs) ? specs : []);
        } catch {
          /* capability unknown — show as not capable */
        }
      }
      setStrk20Capable(capable);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setConnected(false);
      setAddress("");
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setWalletAccount(undefined);
    setAddress("");
    setChainId("");
    setConnected(false);
    setStrk20Capable(false);
    setError("");
  }, []);

  const openPicker = useCallback(() => {
    setError("");
    setPickerOpen(true);
  }, []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const value = useMemo<WalletContextValue>(
    () => ({
      wallets,
      walletAccount,
      address,
      chainId,
      network: networkName(chainId),
      rpcUrl: (() => {
        try {
          return rpcUrlFor(networkName(chainId));
        } catch {
          return "";
        }
      })(),
      isConnected,
      connecting,
      error,
      pickerOpen,
      strk20Capable,
      openPicker,
      closePicker,
      connect,
      disconnect,
    }),
    [
      wallets,
      walletAccount,
      address,
      chainId,
      isConnected,
      connecting,
      error,
      pickerOpen,
      strk20Capable,
      openPicker,
      closePicker,
      connect,
      disconnect,
    ]
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within a WalletProvider");
  return ctx;
}
