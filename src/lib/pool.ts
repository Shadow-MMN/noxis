import { RpcProvider, type AccountInterface } from "starknet";

// STRK20 privacy pool, Starknet mainnet (canonical).
export const POOL_ADDRESS =
  "0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a";

// STRK ERC-20 on Starknet mainnet.
export const STRK_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";

export const STRK_DECIMALS = 18;

let provider: RpcProvider | undefined;

function getProvider(nodeUrl: string): RpcProvider {
  if (!provider) provider = new RpcProvider({ nodeUrl });
  return provider;
}

// Read a user's public STRK balance (ERC-20 balanceOf). starknet.js v10 has no
// Account.getBalance — the call goes through the wallet account's provider.
async function firstResult(res: unknown): Promise<string | undefined> {
  const arr = res as { result?: string[] } | string[] | null;
  return Array.isArray(arr) ? arr[0] : arr?.result?.[0];
}

export async function readStrkBalance(
  account: AccountInterface,
  address: string
): Promise<bigint> {
  const res = await account.provider.callContract({
    contractAddress: STRK_ADDRESS,
    entrypoint: "balanceOf",
    calldata: [address],
  });
  const raw = await firstResult(res);
  return BigInt(raw ?? "0");
}

// Read the flat per-operation pool fee from the pool itself (never assume it —
// it moves on mainnet). Returns wei (smallest unit).
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

// Parse a user amount string ("1.5") into the smallest unit. Returns null on
// invalid input (including more than 18 decimals).
export function strkToWei(input: string): bigint | null {
  const s = input.trim();
  if (s === "" || s === "." || !/^\d*(\.\d*)?$/.test(s)) return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > STRK_DECIMALS) return null;
  const scale = BigInt(10) ** BigInt(STRK_DECIMALS);
  const wei = BigInt(whole || "0") * scale + BigInt(frac.padEnd(STRK_DECIMALS, "0") || "0");
  return wei;
}

// Format a wei amount as a human STRK string ("1.5", "0.25").
export function fmtStrk(wei: bigint): string {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const scale = BigInt(10) ** BigInt(STRK_DECIMALS);
  const whole = abs / scale;
  const frac = (abs % scale)
    .toString()
    .padStart(STRK_DECIMALS, "0")
    .replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${frac ? `.${frac}` : ""}`;
}

export function explorerTxUrl(txHash: string, network: string): string {
  const base =
    network === "Sepolia" ? "https://sepolia.voyager.online" : "https://voyager.online";
  return `${base}/tx/${txHash}`;
}
