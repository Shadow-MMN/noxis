# Noxis

**Private payments on Starknet.**

Noxis is a private payments app built for the [STRK20 Private Sprint](https://github.com/starkience/strk20-hackathon). It lets you hold, send, and receive STRK-backed value without publishing who paid whom, how much, or when. Payments flow through the STRK20 privacy pool on Starknet mainnet — visible on-chain is that *a* shielded payment happened, never *your* shielded payment.

## What it does

- **Shield** — deposit STRK into the STRK20 pool and mint a private note only you can spend.
- **Unshield** — redeem a note back to a fresh account, breaking the link to the deposit.
- **Private transfer** — move value from one note to another with no on-chain link between sender and recipient.
- **Private swap** — trade shielded tokens (e.g. USDC → STRK) through AVNU without leaving the pool; gas is sponsored, the pool fee comes from your shielded balance.
- **Shielded balances** — see your pool balances via wallet-mediated reads (consent-gated).
- **Clear transaction states** — pending / confirmed / failed are always legible, even though the underlying details stay private.

## What is and isn't private

- **Private:** the amount, the sender, the recipient, and the link between any two payments.
- **Public:** that the STRK20 pool is being used, and the fact that a payment occurred. This is inherent to the privacy pool design — Noxis does not and cannot hide the existence of activity, only its contents and participants.

## Status

- [x] Next.js + Tailwind scaffold, Noxis UI foundation (graphite + copper/amber)
- [x] Registered for the STRK20 Private Sprint
- [x] STRK20 integration plan (skill-driven)
- [x] Wallet picker (Ready X / Xverse, with graceful degradation)
- [x] Shield / private transfer / unshield flows (live pool fee, clear tx states)
- [x] Shielded balance reads (wallet-mediated, consent-gated)
- [ ] Mainnet transactions + `strk20.json` fields filled in (gated on owner approval)

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Mainnet RPC requires a free [Alchemy](https://www.alchemy.com) key. Copy `.env.example` to `.env.local` and fill in your key:

```
NEXT_PUBLIC_ALCHEMY_RPC_URL=https://starknet-mainnet.g.alchemy.com/v2/<YOUR_ALCHEMY_KEY>
AVNU_PAYMASTER_API_KEY=<YOUR_AVNU_PAYMASTER_API_KEY>
```

- `NEXT_PUBLIC_ALCHEMY_RPC_URL` — Starknet mainnet RPC (Alchemy).
- `AVNU_PAYMASTER_API_KEY` — AVNU Portal key for private swaps (https://portal.avnu.fi). Server-side only; the app proxies it through `/api/private-swap` and never ships it to the browser. Leave empty to use shield/transfer/unshield without swaps.

Never commit `.env.local` — it is gitignored.

## License

MIT — see [LICENSE](LICENSE).
