# Noxis — Project Handoff

Handoff date: August 16, 2026. Owner: Shadow-MMN. This file exists so the
project can be picked up cleanly after a break — read it before doing anything.

## What Noxis is

Private payments app for the [STRK20 Private Sprint](https://github.com/starkience/strk20-hackathon):
shield STRK (and USDC) into the STRK20 privacy pool, send privately, unshield.
Next.js 16 App Router + React 19 + TypeScript + Tailwind v4. No backend except
one API route (`/api/private-swap`, a server-side proxy for AVNU paymaster).

## Where things live

| Thing | Location |
|---|---|
| Repo | https://github.com/Shadow-MMN/noxis (public) |
| Live app | **https://noxis-jet.vercel.app** |
| Vercel project | `noxis` (scope `miracle-nnajis-projects`; GitHub-connected → auto-deploys on push to `main`) |
| Hub page | https://strk20.starknet.io/hackathon (re-reads repo every 30 min) |
| Demo script | `docs/DEMO_SCRIPT.md` (timed 3-min script, ready to record) |
| Integration plan | `STRK20_INTEGRATION_PLAN.md` |
| Submission manifest | `strk20.json` (repo root) |

## Hackathon submission status (4 items)

| # | Item | Status |
|---|---|---|
| 1 | Live demo | ✅ **DONE** — deployed on Vercel; `demo_url` set in `strk20.json`; repo Website field set to the live URL |
| 2 | Demo video | ⏳ **TODO** — script ready; record ≤3 min, upload (YouTube unlisted / Loom), set `demo_video` in `strk20.json` |
| 3 | Three mainnet txs | ⏳ **TODO** — see "Mainnet run" below; the three verified **Sepolia** hashes do NOT count (hub checks mainnet) |
| 4 | Contracts | ✅ **CORRECT AS-IS** — `contracts` stays `[]`: Noxis deploys no contracts (frontend using the shared pool). Do not fill with dummy addresses |

Current `strk20.json`:
```json
{
  "transactions": [],
  "contracts": [],
  "demo_video": "",
  "demo_url": "https://noxis-jet.vercel.app"
}
```

## Mainnet run (item 3) — the only real work left

STRK20 privacy actions are **wallet-mediated** (Ready X / Xverse only). They
cannot be executed from a bare private key or a script — the viewing key lives
in the wallet, the proving backend authenticates the wallet's privacy account,
and the wallet builds the pool actions (`strk20InvokeTransaction`). So the
owner must click through in the wallet; verify each hash on-chain afterwards.

Checklist:
1. Fund mainnet: **~20 STRK** (pool fee ≈ **6 STRK per operation**; gas is
   sponsored). STRK ≈ $0.023 (Aug 2026), so ~$0.50 total. Add **USDC.e** to
   Ready X if shielding USDC: `0x053c91253bc9682c04929ca02ed00b3e423f6710d2ee7e0d5ebb06f3ecf368a8` (6 decimals).
2. **One-time privacy activation on mainnet** in Ready X (separate from Sepolia —
   activation does not carry across networks). Account must be deployed first
   (any tiny send deploys it).
3. Loop (owner clicks, with explicit go-ahead before each):
   **Shield** → wait ~10 blocks (note maturity) → **Send privately** to the
   second account → **Unshield**.
4. Each hash must: exist, have SUCCEEDED/ACCEPTED_ON_L2, and carry a pool event
   (deposit / note-created / withdrawal). Verify on https://voyager.online.
5. Write the three hashes into `transactions` in `strk20.json` and commit.

## Testnet proof (already done, verified on-chain)

Sepolia pool: `0x254a6b2997ef52e9f830ce1f543f6b29768295e8d17e2267d672c552cfe0d91`
Mainnet pool: `0x040337b1af3c663e86e333bab5a4b28da8d4652a15a69beee2b677776ffe812a`

| Leg | Hash | Details |
|---|---|---|
| 1. Shield (10 STRK) | `0x53a9d29f9c8ba43b2fb7efb156ec414ba943334d29f68dc9b197d3771271fb` | Ready X acc1 |
| 2. Private transfer (5 STRK) | `0x022a659e5e81a34c4255cf6ddd5434731f018fad72911fbc2fe4870568471a85` | Ready X acc1 → Xverse |
| 3. Unshield (5 STRK) | `0x06c736aced052509822f1b923dc4c302f8ea49e8df0905250d82320761ebff28` | → Xverse public address |

Wallets:
- Ready X acc1: `0x02da0e2A7Cb3c51DC8Ab413686c6F8Ae05570B78f47160E2229926A61028506d` (10 STRK shielded earlier; ~79 STRK public)
- Ready X acc2: `0x02aA857b2e8e00d302eD51eFf209748d08Fc7009C2a3bD937e7e01103F164487` (activation never landed on-chain; balance untouched)
- Xverse: `0x0151805545ef65c4b35bc9c2d9e7b7f900e6db8d0bb07f8f198f557e57cca1c8` (80 STRK; privacy activated)

## Environment & secrets

- `.env` (gitignored ✓) holds `NEXT_PUBLIC_ALCHEMY_RPC_URL` — Starknet mainnet
  Alchemy URL. Sepolia is derived from the same key (`-sepolia.` host) unless
  `NEXT_PUBLIC_SEPOLIA_RPC_URL` is set.
- `.env.example` documents all vars (`AVNU_PAYMASTER_API_KEY` optional, for swaps).
- Vercel: `NEXT_PUBLIC_ALCHEMY_RPC_URL` set for **production**. **Preview env
  was never successfully added** (CLI prompt quirk) — add it from the Vercel
  dashboard if preview deploys are needed.
- **Never commit keys.** `.env*` is gitignored except `.env.example` (verified).

## Technical learnings (don't re-debug these)

- **Connect flow:** request accounts → permissions → then chain ID. Probing
  chain ID *before* a session hangs Xverse (fixed in `b111f65`).
- **Capability probe:** Xverse advertises STRK20 via `wallet_supportedWalletApi`
  ≥ 0.10.3, not `supportedSpecs`. Probe `supportedWalletApi` first, fall back to
  `supportedSpecs` (`c6f6518`).
- **`NOT_REGISTERED`** = privacy capabilities not activated for that account —
  a one-time **wallet-side** step ("activate privacy capabilities" prompt).
  Dapps cannot trigger it. Account must be deployed first.
- **Stuck "sending" state:** pool-relayed txs lag the RPC. Fixed with a
  resilient poller in `src/lib/tx.ts` + a **Check status** button on the
  submitted card (`005a94f`).
- **Self-transfer guard** and **address validation** live in the transfer panel.
- Swap is **mainnet-gated** — shows an amber notice on Sepolia (expected).

## Where to pick up next week

1. **Record the demo video** (`docs/DEMO_SCRIPT.md` has the timed script) →
   upload → set `demo_video` in `strk20.json` → commit.
2. **Mainnet run** (checklist above) — fund ~20 STRK + USDC.e, activate privacy
   on mainnet, run shield → transfer → unshield, verify hashes, write them in.
3. Re-check the hub (https://strk20.starknet.io/hackathon) until all rows are done.
4. Optional polish: PWA manifest (silences the `/manifest.json` 404), preview
   env var on Vercel, pool the "sending" state display.

## Recent commits (main)

```
6cd982a Set demo_url in strk20.json
c98ae87 Add live demo URL to README
0a7cb3b Replace Next.js default branding with Noxis shield favicon
c6f6518 Probe wallet API version for STRK20 capability, not just specs
005a94f Fix stuck "sending" state on STRK20 transactions
a948062 Correct the NOT_REGISTERED hint: activation is a wallet-side step
4bd65ad Surface actionable hint when the wallet returns NOT_REGISTERED
5a1fec6 Keep wallet connection when post-connect probes fail
b111f65 Fix wallet connect ordering so Xverse connects reliably
44cc386 Fix wallet-store infinite loop and add testnet support
c791215 Add USDC support and private swaps via AVNU
```
