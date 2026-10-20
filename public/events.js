// Event definitions. Update these when Wizards changes entry fees or payouts.
// rewards[k] = prize for finishing with k wins. Packs are intentionally not counted.
//   gems:  gems paid out
//   boxes: physical booster boxes (valued with the "booster box value" input)
window.EVENTS = [
  {
    id: "premier",
    name: "Premier Draft",
    entryGems: 1500,
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
    format: "bo1",
    maxWins: 7,
    maxLosses: 3,
    rewards: [
      { gems: 0 }, { gems: 0 }, { gems: 0 }, { gems: 1400 },
      { gems: 2800 }, { gems: 3200 }, { gems: 4200 }, { gems: 7200 },
    ],
    note: "Bo1 · 7 wins or 3 losses · not available every set",
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
    note: "Bo1 Sealed · 7 wins or 2 losses · Reality Fracture (Oct 23 – Nov 2, 2026)",
    source: "https://magic.wizards.com/en/news/mtg-arena/arena-direct-terms-and-conditions",
    updated: "2026-10-12",
  },
];
