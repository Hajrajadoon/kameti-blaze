# Kameti.cash (pre-hackathon version, v1)

An interest-free savings circle (kameti / committee / chama) on Bitcoin Cash. No custody, no fees: every member pays the round's receiver directly from their own wallet, and the page reads the blockchain to show who has paid.

**Status:** this repository is the version built BEFORE the BCH BLAZE 2026 hackathon (started 20 Oct 2026). It is frozen on 13 Nov 2026 (tag `pre-hackathon-final`). The hackathon version continues in a new repository, linked from the banner of the live demo.

**Demo (pre-hackathon):** https://kameti-v1.vercel.app/

## What exists in this version
- Create a circle: members, amount, period (days, weeks, months), first-week payment window
- Priority seat for an urgent need, or a fair draw: the payout order comes from the hash of a future BCH block
- Wallet connection with WizardConnect (@paytaca/wizardconnect-vue); the app recognises the member from the connected wallet
- Real mainnet payments signed in the user's own wallet, with an OP_RETURN note (circle id, round, payer)
- Payment tracking from the blockchain (Paid, Late, Pending)
- Join, leave and swap seats through small on-chain notes
- Reminders, a calendar file and a wallet balance check
- The whole circle lives in the share link: no database and no server

## What is NOT in this version
Landing page and redesign, group agreement, full README and presentation, final video. These are built during the hackathon (14-22 Nov 2026).

## Honest limits
Nobody can force a member to keep paying; the app makes defaults visible. BCH changes in value. Use it with people you know.

## Run locally
`npm install`, then `npm run dev`. Network settings are in `src/config.js`.