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
import { constants, validateAndParseAddress, WalletAccountV6, walletV6 } from "starknet";
import { createStore, type Store } from "@starknet-io/get-starknet-discovery";
import type { WalletWithStarknetFeatures } from "@starknet-io/get-starknet-wallet-standard/features";

const RPC_URL = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;

// Lazy singleton discovery store — created once, shared across mounts.
// eip1193Adapters: [] keeps MetaMask's Snap probing out of discovery entirely.
let store: Store | undefined;
function getStore(): Store {
  if (!store) store = createStore({ eip1193Adapters: [] });
  return store;
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
    useCallback(() => getStore().getWallets().slice(), []),
    useCallback(() => getStore().getWallets().slice(), [])
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
      if (!RPC_URL) {
        throw new Error(
          "Missing NEXT_PUBLIC_ALCHEMY_RPC_URL — copy .env.example to .env and set your Alchemy key."
        );
      }
      const myWA = await WalletAccountV6.connect({ nodeUrl: RPC_URL }, selected);
      setWalletAccount(myWA);

      const accounts = await walletV6.requestAccounts(selected);
      if (typeof accounts === "string") {
        throw new Error("This wallet is not compatible with the Starknet Wallet API.");
      }
      if (Array.isArray(accounts) && accounts.length) {
        setAddress(validateAndParseAddress(accounts[0]));
      }

      const permissions = await walletV6.getPermissions(selected);
      const granted = Array.isArray(permissions) && permissions.includes("accounts");
      setConnected(granted);

      if (granted) {
        const id = (await walletV6.requestChainId(selected)) as string;
        setChainId(id);
      }

      const specs = await walletV6.supportedSpecs(selected);
      setStrk20Capable(isStrk20Capable(specs));
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
