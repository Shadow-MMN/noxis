# STRK20 Privacy Integration Plan — Noxis

Generated 2026-08-14 by the strk20-privacy-integration skill. Statuses were current at generation time — re-verify the "open items" before building against them.

## 1. Project snapshot

- **Stack:** Next.js 16.3.1 (App Router) + React 19.2.8 + TypeScript 5 + Tailwind CSS v4. No Starknet packages yet (greenfield). No Cairo contracts, no backend, no test setup (eslint only).
- **Relevant code:**
  - `src/app/page.tsx` — landing page + all current UI surfaces (hero, connect-wallet placeholder button, shield/transfer/unshield cards)
  - `src/app/layout.tsx` — root layout / fonts / theme
  - `.env` — `NEXT_PUBLIC_ALCHEMY_RPC_URL` (Starknet mainnet; verified live, chainId `SN_MAIN`)
- **Privacy goal (from interview):** hide who-pays-whom and amounts for P2P private transfers; show the user's own shielded balances privately via wallet-mediated reads. Deposit/withdrawal link stays public (accepted trade-off).
- **Environment:** testnet-first for dev/demo/flow testing. Mainnet only in the final phase, and only for the three required pool transactions, each with explicit per-transaction approval. Test wallet: **Ready X** (Argent's rebrand — the STRK20-ready wallet; formerly the "Ready" extension), Xverse secondary.

## 2. Chosen route: Privacy Wallet API via starknet.js

Normal dapp where users connect their own wallet → the **Wallet API route**: the dapp asks the user's privacy-enabled wallet to shield / transfer / unshield via `WalletAccountV6` in starknet.js v10.4.0. Buildable now. The starter kit (https://github.com/Akashneelesh/strk20-starter-kit) proves the exact wiring with get-starknet v6 + `WalletAccountV6`.

**The rule this follows:** this app never touches viewing keys, notes, or proofs — the user's wallet acts on its behalf via starknet.js (the Privacy Wallet API is wallet-facing plumbing underneath; we pitch it as "use starknet.js", not "implement a wallet API").

## 3. What this delivers — hidden vs visible

| Noxis flow | Private (inside the pool) | Public (visible onchain) |
|---|---|---|
| Shield | Note owner, shielded amount | Deposit amount (the ERC-20 leg), the fact that an address interacted with the pool, timing |
| Private transfer | Sender, recipient, amount | That a private transfer happened |
| Unshield | Source note | Withdrawal amount |
| Shielded balances | Balances, shown to owner only via wallet-mediated read | — |

Limit, stated plainly: deposit/withdrawal amounts and the timing of pool interactions stay public — that is inherent to the pool design. Bundling a deposit with the transfer it funds correlates them publicly; Noxis will keep shield as its own earlier transaction where the UX allows, and say so when it doesn't.

## 4. Prerequisites & versions

- `starknet@10.4.0` (pin exact — STRK20 lives in `WalletAccountV6`, shipped in v10.4.0)
- `@starknet-io/get-starknet-discovery@6.0.2` (npm `next` tag — pin explicitly or you get the wrong major)
- `@starknet-io/get-starknet-wallet-standard@6.0.2` (npm `next` tag — pin explicitly)
- `@starknet-io/types-js@0.10.3`

> **Drift found 2026-08-14:** the skill pinned discovery/wallet-standard 6.0.3, but `starknet@10.4.0`'s types reference wallet-standard 6.0.2 — installing 6.0.3 yields two incompatible type copies (TS2345 at the `WalletAccountV6.connect` boundary). Aligned to **6.0.2** (the starter kit's proven set).
- Test wallet: **Ready X**; Xverse as secondary (wallet API in progress)
- Node ≥ 24 recommended for SDK tooling; repo runs Node 25 ✓

## 5. Phase 1 — Wallet connection + capability detection ✅ done 2026-08-14

1. Install the pinned packages above (`package.json`).
2. Create the wallet layer, modeled on the starter kit's `walletContext.ts`: a store + `connect()` using get-starknet v6 discovery, exposing a `WalletAccountV6` (new `src/lib/wallet/` module).
3. **Capability detection, least privilege:** use `walletV6.supportedWalletApi(wallet)` (or `supportedSpecs`), treat wallet-API `>= 0.10` as STRK20-capable. Never probe `strk20Balances([])` to feature-detect — it triggers a user consent prompt for data the app doesn't need. Import the wallet type from the subpath: `@starknet-io/get-starknet-wallet-standard/features` (root export is TS2459).
4. Replace the disabled "Connect wallet" placeholder in `src/app/page.tsx` with the real picker.
5. **Graceful degradation:** a wallet without privacy support sees a clear "install Ready X to use private payments" state; private actions are hidden, the rest of the page still works.
6. Verify: headless build/lint; manual check with Ready X against the wallet test dapp (https://starknet-wallet-account.vercel.app/). Fetch the WalletAccount guide (https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6) for the exact current API before writing code — never guess method names.

## 6. Phase 2 — Shield flow ✅ done 2026-08-14

1. Shield UI on the landing page: token + amount, **"MAX" reserves the pool fee** (read it from the pool via `get_fee_amount`, not assumed — it was ~4 STRK on mainnet at skill-authoring time; re-read at build time).
2. **A deposit is two transactions** — the ERC-20 `approve` must be visible on-chain before the private deposit can be proven, so the wallet prompts twice. Name both steps in the UI ("Approve → Shield") so users don't read the second prompt as a duplicate bug.
3. **Notes mature ~10 blocks** — freshly shielded funds aren't immediately spendable. Phase 2 ships shield only; the spend path arrives in Phase 3 with either a composed single transaction or an honest "funds mature in ~10 blocks" wait state (the two options are not privacy-equivalent — prefer separate transactions; revisit in the Phase 3 build).
4. Surface screening-declined deposits as a state, not a bug (deposit screening is enforced onchain).
5. Verify headless + manual Ready X check.

## 7. Phase 3 — Private transfer + unshield

1. Private transfer flow: `strk20InvokeTransaction(actions)` takes an **array** — batch multiple transfers into one wallet request where a flow calls for it.
2. Unshield flow: withdraw to a fresh account; honest "withdrawal amount is public" labeling.
3. `waitForTransaction` gets a **ceiling** — paymaster-relayed txs can lag your RPC; treat timeout as "submitted" and show the explorer link as fallback.
4. **Normalize addresses before comparing** (`BigInt(a) === BigInt(b)`) — felts have many valid spellings; string equality duplicates list entries.
5. Verify headless + manual Ready X check at every handoff.

## 8. Phase 4 — Shielded balances, polish, demo

1. Shielded balance reads via `WalletAccountV6.strk20Balances(tokens)` — consent-gated by the wallet; confirm consent behavior against Ready X before designing the panel (least privilege: request only the tokens the screen shows).
2. Polish transaction states (pending / confirmed / failed stay legible — copper/sage/amber per the design system), honest hidden-vs-visible copy per flow.
3. Record the 3-minute demo (test amounts, testnet where possible), add `demo_video` + `demo_url` to `strk20.json` (Vercel deploy auto-detected for `demo_url`).

## 9. Phase 5 — Mainnet: the three required transactions *(gated)*

- **Entry criterion:** Phases 1–4 verified with Ready X; your explicit approval.
- Exactly **three mainnet transactions touching the pool** at `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a` — shield, private transfer, unshield, in minimal amounts.
- Each transaction sent only after your explicit go-ahead at that moment. Hashes go into `transactions` in `strk20.json` (hub re-reads within 30 min).
- `contracts` stays empty unless Noxis deploys its own contract (not currently planned — no anonymizer needed for P2P transfers).

## 10. Testing

- Headless: `npm run lint` + `npm run build` after every phase.
- Wallet-flow verification: Ready X, one manual checklist at each phase boundary (per the execute reference); sanity-check against the wallet test dapp.
- **Testnet note:** the pool is mainnet-live; re-verify at build time whether a testnet pool exists — if not, flow verification uses minimal mainnet amounts with per-transaction approval (matches your environment rule). Pure-local devnet doesn't exercise the wallet/proving path today.
- No test framework in the repo yet — adding one is optional; headless verification is lint + build.

## 11. Compliance & security notes

- Deposit screening is enforced onchain by the protocol (v0.14.3+) on every route; self-hosted proving does not bypass it. Surface screening outcomes in UX.
- Selective disclosure exists for legitimate regulatory requests; it is not automatic compliance and carries no regulator endorsement — Noxis owns its own legal/compliance decisions and any use-case KYC.
- No key material, ever: viewing keys / private keys / API keys stay out of files (`.env` gitignored — verified). Env-var placeholders only.

## 12. Open items to re-verify at build time

- Ready X wallet naming/status (Argent rebrand — user-confirmed STRK20-capable; confirm it surfaces in get-starknet v6 discovery).
- Version drift (2026-08-14): discovery/wallet-standard pinned to 6.0.2, not the skill's 6.0.3 — starknet 10.4.0 types require 6.0.2 (see §4).
- Xverse dapp-facing Wallet API status.
- Whether a testnet STRK20 pool exists.
- Current `starknet` / get-starknet dist-tags (STRK20-era releases live on the npm `next` tag).
- Pool fee amount at build time; paymaster/fee UX design. **Measured 2026-08-14: 6 STRK on mainnet** (`get_fee_amount`, no args — up from ~4 STRK at skill authoring; the fee read + MAX stay gated on Mainnet).
- `strk20-by-example.org` was unreachable from this machine at plan time — re-check pages before citing them in the UI.

## 13. Links

- Wallet API route overview: https://strk20-by-example.org/starknet-wallet-api/overview
- starknet.js wiring / `WalletAccountV6`: https://strk20-by-example.org/starknet-wallet-api/starknet-js
- React apps / `useStrk20` hooks: https://strk20-by-example.org/starknet-wallet-api/starknet-start-hook
- What STRK20 is / the pool model: https://strk20-by-example.org/what-is-strk20
- WalletAccount guide (fetch before writing code): https://starknet-js.com/docs/next/guides/account/walletAccount/#with-get-starknet-v6
- STRK20 starter kit (wiring reference): https://github.com/Akashneelesh/strk20-starter-kit
- Privacy SDK monorepo quickstart: https://github.com/starkware-libs/starknet-privacy/blob/main/sdk/README.md
- Pool contract (mainnet): https://voyager.online/contract/0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a
