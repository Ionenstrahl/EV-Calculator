# MTGA Event EV Calculator

A static website that calculates the expected value (in €) of MTG Arena events at your win rate:
Premier Draft, Traditional Draft, Contender Draft and Arena Direct.

Inputs:
- **Game win rate** (slider). For Bo3 events, the match win rate is derived as `p²·(3−2p)`.
- **€ per 10,000 gems**: what gems cost you.
- **Booster box value (€)**: used for Arena Direct box prizes.

Packs are not counted in the EV.

## Run locally
Open `public/index.html` in a browser. No build step is needed.

## Deploy
Push to the default branch on GitLab. The `pages` job in `.gitlab-ci.yml` publishes `public/`.

## Updating event data
Entry fees and payouts change by set. Edit `public/events.js`:
- `entryGems`: entry fee in gems
- `format`: `"bo1"` or `"bo3"` (Bo3 uses the derived match win rate)
- `maxWins` + `maxLosses` for "play until X wins or Y losses" events, or `fixedMatches` for a fixed number of matches
- `rewards[k]`: `{ gems, boxes }` paid for finishing with `k` wins
