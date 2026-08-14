import { RpcProvider, type AccountInterface } from "starknet";

// STRK20 privacy pool, Starknet mainnet (canonical — matches the SDK's
// PRIVACY_POOL_ADDRESS export).
export const POOL_ADDRESS =
  "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";

// STRK ERC-20, Starknet mainnet.
export const STRK_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

// USDC.e (bridged USD Coin), Starknet mainnet — verified on-chain:
// name "USD Coin", symbol "USDC", 6 decimals.
export const USDC_E_ADDRESS =
  "0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8";

export interface TokenInfo {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
}

export const TOKENS: Record<string, TokenInfo> = {
  STRK: {
    address: STRK_ADDRESS,
    symbol: "STRK",
    name: "Starknet Token",
    decimals: 18,
  },
  USDC: {
    address: USDC_E_ADDRESS,
    symbol: "USDC",
    name: "USD Coin (USDC.e)",
    decimals: 6,
  },
};

export const TOKEN_LIST = Object.values(TOKENS);

let provider: RpcProvider | undefined;

function getProvider(nodeUrl: string): RpcProvider {
  if (!provider) provider = new RpcProvider({ nodeUrl });
  return provider;
}

async function firstResult(res: unknown): Promise<string | undefined> {
  const arr = res as { result?: string[] } | string[] | null;
  return Array.isArray(arr) ? arr[0] : arr?.result?.[0];
}

// Read the flat per-operation pool fee from the pool itself (never assume it —
// it moves on mainnet). The fee is STRK-denominated. Returns the smallest unit.
export async function readPoolFee(nodeUrl: string): Promise<bigint> {
  const res = await getProvider(nodeUrl).callContract({
    contractAddress: POOL_ADDRESS,
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
  token: TokenInfo
): Promise<bigint> {
  const res = await account.provider.callContract({
    contractAddress: token.address,
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
