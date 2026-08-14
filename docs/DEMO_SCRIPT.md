# Noxis — 3-minute demo script

Record with a screen recorder (Loom, OBS, QuickTime). Target: **≤ 3 minutes**,
no login walls, plain audio. Record against the **live app** (deployed or
`npm run dev`), ideally with real mainnet transactions once approved — testnet
amounts are fine for the walkthrough, but the sprint's scored transactions are
the three mainnet hashes in `strk20.json`.

Before recording: connect Ready X, ensure funds, and (on mainnet) get the
explicit go-ahead from the repo owner before sending transactions.

## Structure

### 0:00–0:30 — What Noxis is (30s)
- One line: "Noxis is private payments on Starknet — shield STRK, send
  privately, unshield when you need to."
- Show the landing page. Point at the hidden-vs-visible labels on the three
  cards: sender/recipient/amount hidden; the fact of a payment public.
- Say plainly what stays public (deposit/withdrawal amounts, that a payment
  happened) — judges weight honest labeling.

### 0:30–1:10 — Connect + shield (40s)
- Connect Ready X (consent prompts on screen are fine — say "these are the
  wallet's own privacy prompts").
- Open the Shield section, type an amount, hit **MAX** and note the fee is
  reserved from the live pool read.
- Shield → approve twice (allowance, then deposit) → show the confirmed state
  with the Voyager link.
- Read the shielded balance (Reveal → consent → number appears).

### 1:10–2:00 — Private transfer (50s)
- Open Send privately. Paste a second address (or show a fresh one).
- Send → confirm → "Sender, recipient and amount stay hidden."
- Note: only matured notes (~10 blocks) are spendable.

### 2:00–2:40 — Unshield (40s)
- Open Unshield. Default recipient = connected account; paste a fresh account
  to show the link-break.
- Unshield → confirm → "The withdrawal amount is public on this leg."

### 2:40–3:00 — Close (20s)
- One honest summary of private vs public, and what's next (mainnet launch).
- Show the repo + strk20.json (or just the repo link).

## After recording

1. Upload (YouTube unlisted or Loom).
2. Paste the link into `demo_video` in `strk20.json` and commit — the hub
   picks it up within 30 minutes.
3. `demo_url`: only if the hub isn't already detecting the deployment (Vercel
   reports one automatically; the repo Website field also counts). Leave empty
   otherwise.

## Checklist (sprint scoring)

- [ ] Live demo anyone can open (Vercel deploy + repo Website field)
- [ ] `demo_video` set in `strk20.json`
- [ ] Three verified mainnet tx hashes in `strk20.json` (each touched the pool)
- [ ] README covers what Noxis does, why it needs privacy, how to run locally
