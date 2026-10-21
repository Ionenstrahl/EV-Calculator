# MTGA Event EV Calculator

A static website that calculates the expected value (in €) of MTG Arena events at your win rate:
Premier Draft, Traditional Draft, Contender Draft and Arena Direct.

Inputs:
- **Game win rate** (slider). For Bo3 events, the match win rate is derived as `p²·(3−2p)`.
- **€ per 10,000 gems**: what gems cost you.
- **Booster box value (€)**: used for Arena Direct box prizes.

Packs are not counted in the EV.

## Run locally
Open `index.html` in a browser. No build step is needed.

## Deploy
Push to `main` on GitHub. GitHub Pages serves the repo root
(one-time: Settings → Pages → Source: **Deploy from a branch**, `main` / `/ (root)`).

## Updating event data
Entry fees and payouts change by set. Edit `events.js`:
- `entryGems`: entry fee in gems
- `format`: `"bo1"` or `"bo3"` (Bo3 uses the derived match win rate)
- `maxWins` + `maxLosses` for "play until X wins or Y losses" events, or `fixedMatches` for a fixed number of matches
- `rewards[k]`: `{ gems, boxes }` paid for finishing with `k` wins
