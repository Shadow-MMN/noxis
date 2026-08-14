import type { ProviderInterface } from "starknet";

export type TxOutcome = "confirmed" | "reverted" | "unknown";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Poll a transaction until it settles, tolerating RPC lag and transient
 * errors. STRK20 pool transactions are paymaster-relayed, so they can take a
 * while to become visible on your RPC — "not found yet" and network hiccups
 * are treated as "keep waiting", never as failures.
 *
 * Returns:
 *  - "confirmed" once execution SUCCEEDED
 *  - "reverted"  once execution REVERTED
 *  - "unknown"   when the budget runs out without a definitive result
 */
export async function pollTxOutcome(
  provider: ProviderInterface,
  txHash: string,
  opts: { timeoutMs?: number; intervalMs?: number } = {}
): Promise<TxOutcome> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 5_000;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const receipt = await provider.getTransactionReceipt(txHash);
      if ("execution_status" in receipt) {
        const exec = receipt.execution_status;
        if (exec === "SUCCEEDED") return "confirmed";
        if (exec === "REVERTED") return "reverted";
      }
      // RECEIVED / ACCEPTED_ON_L2 without an execution status: keep waiting.
    } catch {
      // Not indexed yet or a transient RPC error — keep waiting.
    }
    await sleep(intervalMs);
  }
  return "unknown";
}
