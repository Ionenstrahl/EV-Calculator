// Event definitions. Update these when Wizards changes entry fees or payouts.
// entryGold: alternative entry price in gold (omit if the event is gems-only)
// rewards[k] = prize for finishing with k wins. Packs are intentionally not counted.
//   gems:  gems paid out
//   boxes: physical booster boxes (valued with the "booster box value" input)
window.EVENTS = [
  {
    id: "premier",
    name: "Premier Draft",
    entryGems: 1500,
    entryGold: 10000,
    format: "bo1",
    maxWins: 7,
    maxLosses: 3,
    rewards: [
      { gems: 50 }, { gems: 100 }, { gems: 250 }, { gems: 1000 },
      { gems: 1400 }, { gems: 1600 }, { gems: 1800 }, { gems: 2200 },
    ],
    note: "Bo1 · 7 wins or 3 losses",
    source: "https://draftsim.com/mtg-arena-draft-guide/",
    updated: "2026-10-09",
  },
  {
    id: "traditional",
    name: "Traditional Draft",
    entryGems: 1500,
    entryGold: 10000,
    format: "bo3",
    fixedMatches: 3,
    rewards: [{ gems: 100 }, { gems: 250 }, { gems: 1000 }, { gems: 2500 }],
    note: "Bo3 · always 3 matches",
    source: "https://draftsim.com/mtg-arena-draft-guide/",
    updated: "2026-10-09",
  },
  {
    id: "contender",
    name: "Contender Draft",
    entryGems: 3000,
    entryGold: 20000,
    format: "bo1",
    maxWins: 7,
    maxLosses: 3,
    rewards: [
      { gems: 0 }, { gems: 0 }, { gems: 0 }, { gems: 1400 },
      { gems: 2800 }, { gems: 3200 }, { gems: 4200 }, { gems: 7200 },
    ],
    note: "Bo1 · 7 wins or 3 losses",
    source: "https://draftsim.com/mtg-contender-draft/",
    updated: "2026-10-09",
  },
  {
    id: "direct",
    name: "Arena Direct",
    entryGems: 6000,
    format: "bo1",
    maxWins: 7,
    maxLosses: 2,
    rewards: [
      { gems: 0 }, { gems: 0 }, { gems: 0 }, { gems: 2700 },
      { gems: 5400 }, { gems: 8100 }, { boxes: 1 }, { boxes: 2 },
    ],
    note: "Bo1 Sealed · 7 wins or 2 losses",
    source: "https://magic.wizards.com/en/news/mtg-arena/arena-direct-terms-and-conditions",
    updated: "2026-10-12",
  },
  {
    // Arena Limited Championship Qualifier, Draft 1: 7 wins earn a Draft 2 token,
    // valued at Draft 2's own EV at your win rate.
    id: "alcq1",
    name: "ALC Qualifier Draft 1",
    entryGems: 5000,
    entryGold: 25000,
    payToggle: true, // card shows a gems/gold switch; gold is valued at the Premier Draft ratio
    format: "bo1",
    maxWins: 7,
    maxLosses: 2,
    rewards: [
      { gems: 0 }, { gems: 0 }, { gems: 0 }, { gems: 0 },
      { gems: 1000 }, { gems: 2500 }, { gems: 5000 }, { gems: 5500, next: alcqDraft2() },
    ],
    advanceLabel: "Draft 2 chance",
    note: "Bo1 Draft · 7 wins or 2 losses",
    source: "https://magic.wizards.com/en/news/mtg-arena/arena-limited-championship-terms-and-conditions",
    updated: "2026-10-08",
  },
  Object.assign(alcqDraft2(), {
    id: "alcq2",
    name: "ALC Qualifier Draft 2",
    entryGems: 0,
    entryLabel: "Draft 2 token (from Draft 1)",
    note: "Bo1 Draft · 6 wins or 2 losses",
    source: "https://magic.wizards.com/en/news/mtg-arena/arena-limited-championship-terms-and-conditions",
    updated: "2026-10-08",
  }),
];

// Arena Limited Championship Qualifier, Draft 2 (token entry).
// invite: invitation to the Arena Limited Championship (not valued in €).
function alcqDraft2() {
  return {
    name: "Draft 2",
    format: "bo1",
    maxWins: 6,
    maxLosses: 2,
    rewards: [
      { gems: 0 }, { gems: 6500 }, { gems: 7500 }, { gems: 8500 },
      { gems: 10000 }, { usd: 1000, invite: true }, { usd: 2000, invite: true },
    ],
  };
}
