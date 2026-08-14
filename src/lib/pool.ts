import { RpcProvider, type AccountInterface } from "starknet";

// STRK20 privacy pool, per network. Mainnet matches the SDK's
// PRIVACY_POOL_ADDRESS export; Sepolia matches SEPOLIA_PRIVACY_POOL_ADDRESS
// and is live (get_fee_amount verified on-chain).
export const POOL_ADDRESSES: Record<string, string> = {
  Mainnet:
    "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a",
  Sepolia: "0x254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91",
};

// STRK ERC-20 — the canonical address is the same on Mainnet and Sepolia
// (verified on-chain: symbol "STRK", 18 decimals, on both).
export const STRK_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

// USDC.e (bridged USD Coin) — Mainnet only (verified on-chain: 6 decimals).
// The contract does not exist on Sepolia, so USDC is hidden there.
export const USDC_E_ADDRESS =
  "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";

export interface TokenInfo {
  addresses: Partial<Record<string, string>>;
  symbol: string;
  name: string;
  decimals: number;
}

export const TOKENS: Record<string, TokenInfo> = {
  STRK: {
    addresses: { Mainnet: STRK_ADDRESS, Sepolia: STRK_ADDRESS },
    symbol: "STRK",
    name: "Starknet Token",
    decimals: 18,
  },
  USDC: {
    addresses: { Mainnet: USDC_E_ADDRESS },
    symbol: "USDC",
    name: "USD Coin (USDC.e)",
    decimals: 6,
  },
};

// All tokens (used as the default selector list).
export const TOKEN_LIST: TokenInfo[] = Object.values(TOKENS);

// Tokens available on a given network (USDC.e is Mainnet-only).
export function tokensForNetwork(network: string): TokenInfo[] {
  return Object.values(TOKENS).filter((t) => t.addresses[network]);
}

// Resolve a token's contract address on the given network. Throws if the
// token isn't deployed there — callers should filter via tokensForNetwork.
export function tokenAddress(token: TokenInfo, network: string): string {
  const addr = token.addresses[network];
  if (!addr) {
    throw new Error(`${token.symbol} is not available on ${network}.`);
  }
  return addr;
}

// Frontend RPC per network. Sepolia derives from the Alchemy key when
// NEXT_PUBLIC_SEPOLIA_RPC_URL isn't set (same key, different host).
export function rpcUrlFor(network: string): string {
  const mainnet = process.env.NEXT_PUBLIC_ALCHEMY_RPC_URL;
  if (!mainnet) {
    throw new Error(
      "Missing NEXT_PUBLIC_ALCHEMY_RPC_URL — copy .env.example to .env and set your Alchemy key."
    );
  }
  if (network !== "Sepolia") return mainnet;
  const sepolia = process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL;
  if (sepolia) return sepolia;
  return mainnet.replace("-mainnet.", "-sepolia.");
}

const providers = new Map<string, RpcProvider>();

function getProvider(nodeUrl: string): RpcProvider {
  let p = providers.get(nodeUrl);
  if (!p) {
    p = new RpcProvider({ nodeUrl });
    providers.set(nodeUrl, p);
  }
  return p;
}

async function firstResult(res: unknown): Promise<string | undefined> {
  const arr = res as { result?: string[] } | string[] | null;
  return Array.isArray(arr) ? arr[0] : arr?.result?.[0];
}

// Read the flat per-operation pool fee from the pool itself (never assume it —
// it differs per network: 6 STRK on Mainnet, 2 STRK on Sepolia). Returns the
// smallest unit.
export async function readPoolFee(
  nodeUrl: string,
  network: string
): Promise<bigint> {
  const res = await getProvider(nodeUrl).callContract({
    contractAddress: POOL_ADDRESSES[network] ?? POOL_ADDRESSES.Mainnet,
    entrypoint: "get_fee_amount",
    calldata: [],
  });
  const raw = await firstResult(res);
  if (!raw) throw new Error("Pool returned no fee.");
  return BigInt(raw);
}

// Read a user's public balance of `token` (ERC-20 balanceOf). starknet.js v10
// has no Account.getBalance — the call goes through the account's provider.
export async function readTokenBalance(
  account: AccountInterface,
  address: string,
  token: TokenInfo,
  network: string
): Promise<bigint> {
  const res = await account.provider.callContract({
    contractAddress: tokenAddress(token, network),
    entrypoint: "balanceOf",
    calldata: [address],
  });
  const raw = await firstResult(res);
  return BigInt(raw ?? "0");
}

// Basic Starknet address validation: 0x-prefixed hex, non-zero.
export function isValidAddress(input: string): boolean {
  const s = input.trim();
  if (!/^0x[0-9a-fA-F]{1,64}$/.test(s)) return false;
  try {
    return BigInt(s) !== 0n;
  } catch {
    return false;
  }
}

// Parse a user amount string ("1.5") into the token's smallest unit. Returns
// null on invalid input (including more decimals than the token supports).
export function parseAmount(input: string, decimals: number): bigint | null {
  const s = input.trim();
  if (s === "" || s === "." || !/^\d*(\.\d*)?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > decimals) return null;
  const scale = BigInt(10) ** BigInt(decimals);
  const wei =
    BigInt(whole || "0") * scale + BigInt(frac.padEnd(decimals, "0") || "0");
  return wei;
}

// Format a smallest-unit amount as a human string ("1.5", "0.25").
export function fmtAmount(wei: bigint, decimals: number): string {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = abs / scale;
  const frac = (abs % scale)
    .toString()
    .padStart(decimals, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

export function explorerTxUrl(txHash: string, network: string): string {
  const base =
    network === "Sepolia" ? "https://sepolia.voyager.online" : "https://voyager.online";
  return `${base}/tx/${txHash}`;
}
