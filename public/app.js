(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "mtga-ev-settings";
  const COLORS = ["#2a78d6", "#d9822b", "#8a5cd1", "#1f9e74", "#c2417a", "#9a7b1c"];

  // --- Probability -----------------------------------------------------------

  function binom(n, k) {
    if (k < 0 || k > n) return 0;
    let r = 1;
    for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  }

  // Play until maxWins wins or maxLosses losses. Returns P(finish with k wins), k = 0..maxWins.
  function winDistribution(q, maxWins, maxLosses) {
    const dist = [];
    for (let k = 0; k < maxWins; k++) {
      // last match is the final loss; k wins and (maxLosses - 1) losses before it in any order
      dist.push(binom(k + maxLosses - 1, k) * Math.pow(q, k) * Math.pow(1 - q, maxLosses));
    }
    let reachMax = 0;
    for (let l = 0; l < maxLosses; l++) {
      // last match is the final win
      reachMax += binom(maxWins - 1 + l, l) * Math.pow(q, maxWins) * Math.pow(1 - q, l);
    }
    dist.push(reachMax);
    return dist;
  }

  function fixedMatchDistribution(q, n) {
    const dist = [];
    for (let k = 0; k <= n; k++) dist.push(binom(n, k) * Math.pow(q, k) * Math.pow(1 - q, n - k));
    return dist;
  }

  const bo3MatchRate = (p) => p * p * (3 - 2 * p);

  function distributionFor(ev, p) {
    const q = ev.format === "bo3" ? bo3MatchRate(p) : p;
    return ev.fixedMatches
      ? fixedMatchDistribution(q, ev.fixedMatches)
      : winDistribution(q, ev.maxWins, ev.maxLosses);
  }

  // --- Valuation -------------------------------------------------------------

  // gold is valued at the Premier Draft entry ratio (10,000 gold = 1,500 gems)
  const premier = window.EVENTS.find((ev) => ev.id === "premier");
  const GOLD_PER_GEM = premier.entryGold / premier.entryGems;

  // entry cost in gem-equivalents; payGold = ids of events entered with gold
  const entryGemsFor = (ev, prices) =>
    prices.payGold && prices.payGold.has(ev.id) ? ev.entryGold / GOLD_PER_GEM : (ev.entryGems || 0);

  // prices = { euroPerGem, boxEuro, euroPerUsd (after tax), payGold }
  function rewardEuro(r, p, prices) {
    return (r.gems || 0) * prices.euroPerGem + (r.boxes || 0) * prices.boxEuro +
      (r.usd || 0) * prices.euroPerUsd + (r.next ? evaluate(r.next, p, prices).returnEuro : 0);
  }

  function evaluate(ev, p, prices) {
    const dist = distributionFor(ev, p);
    let gems = 0, returnEuro = 0;
    dist.forEach((prob, k) => {
      const r = ev.rewards[k] || {};
      gems += prob * (r.gems || 0);
      returnEuro += prob * rewardEuro(r, p, prices);
    });
    const entryEuro = entryGemsFor(ev, prices) * prices.euroPerGem;
    return { dist, gems, entryEuro, returnEuro, net: returnEuro - entryEuro };
  }

  // P(winning the top prize), following follow-up stages (e.g. ALC Qualifier Draft 2)
  function trophyProb(ev, p, dist = distributionFor(ev, p)) {
    return dist.reduce((sum, prob, k) => {
      const r = ev.rewards[k] || {};
      if (r.next) return sum + prob * trophyProb(r.next, p);
      return sum + (k === dist.length - 1 ? prob : 0);
    }, 0);
  }

  // events whose rewards are gems only can show their EV in gems
  const gemsOnly = (ev) => ev.rewards.every((r) => !r.boxes && !r.usd && !r.next);

  // --- Formatting ------------------------------------------------------------

  const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  const int = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  const pct = (x, d = 1) => (x * 100).toFixed(d).replace(".", ",") + " %";
  const signedEur = (x) => (x >= 0 ? "+" : "−") + eur.format(Math.abs(x));
  const signedGems = (x) => (Math.round(x) >= 0 ? "+" : "−") + int.format(Math.abs(x)) + " gems";

  // trophy = max wins; expected number of events per trophy is 1 / P (geometric distribution)
  function trophyLabel(p) {
    if (p <= 0) return "never";
    const n = 1 / p;
    const every = n < 10 ? n.toFixed(1).replace(".", ",") : int.format(n);
    return `1 in ${every} events`;
  }

  function rewardLabel(r, p, prices) {
    const parts = [];
    if (r.gems) parts.push(int.format(r.gems) + " gems");
    if (r.boxes) parts.push(r.boxes + (r.boxes === 1 ? " box" : " boxes"));
    if (r.usd) parts.push("$" + int.format(r.usd));
    if (r.invite) parts.push("ALC invite");
    if (r.next) parts.push(`${r.next.name} (≈ ${eur.format(evaluate(r.next, p, prices).returnEuro)})`);
    return parts.length ? parts.join(" + ") : "–";
  }

  // --- Settings --------------------------------------------------------------

  let winratePct = 55;
  const hidden = new Set(); // ids of events toggled off in the legend
  const payGold = new Set(); // ids of events (with a gem/gold toggle) entered with gold
  const cash = { taxPct: "30", usdRate: "0.9" }; // cash prize settings, edited on cards with US$ prizes

  function readSettings() {
    return {
      winrate: winratePct / 100,
      euroPerGem: (parseFloat($("gemprice").value) || 0) / 10000,
      boxEuro: parseFloat($("boxprice").value) || 0,
      euroPerUsd: (parseFloat(cash.usdRate) || 0) * (1 - (parseFloat(cash.taxPct) || 0) / 100),
      payGold,
    };
  }

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!s) return;
      if (s.winrate != null) setWinrate(parseFloat(s.winrate));
      if (s.gemprice != null) $("gemprice").value = s.gemprice;
      if (s.boxprice != null) $("boxprice").value = s.boxprice;
      if (s.cash) Object.assign(cash, s.cash);
      if (Array.isArray(s.hidden)) s.hidden.forEach((id) => hidden.add(id));
      if (Array.isArray(s.payGold)) s.payGold.forEach((id) => payGold.add(id));
    } catch (e) { /* storage unavailable */ }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        winrate: winratePct, gemprice: $("gemprice").value, boxprice: $("boxprice").value,
        cash, hidden: [...hidden], payGold: [...payGold],
      }));
    } catch (e) { /* storage unavailable */ }
  }

  // --- Rendering -------------------------------------------------------------

  function renderCards(s) {
    $("cards").innerHTML = window.EVENTS.map((ev, i) => {
      if (hidden.has(ev.id)) return "";
      const r = evaluate(ev, s.winrate, s);
      const rows = r.dist.map((prob, k) => `
        <tr><td>${k}</td><td>${pct(prob)}</td><td>${rewardLabel(ev.rewards[k] || {}, s.winrate, s)}</td></tr>`).join("");
      const probWhere = (pred) => r.dist.reduce((sum, prob, k) => sum + (pred(ev.rewards[k] || {}) ? prob : 0), 0);
      return `
        <article class="card" style="--accent:${COLORS[i % COLORS.length]}">
          <h2>${ev.name}</h2>
          <p class="note">${ev.note}</p>
          <div class="net ${r.net >= 0 ? "pos" : "neg"}">${signedEur(r.net)}</div>
          <dl>
            ${ev.entryLabel ? "" : ev.payToggle ? `
            <dt>Pay with</dt><dd><span class="seg" role="group" aria-label="Entry currency">${["gems", "gold"].map((c) =>
              `<button type="button" data-pay="${ev.id}" data-currency="${c}" aria-pressed="${payGold.has(ev.id) === (c === "gold")}">${c === "gems" ? "Gems" : "Gold"}</button>`).join("")}</span></dd>
            <dt>Entry</dt><dd>${payGold.has(ev.id)
              ? `${int.format(ev.entryGold)} gold · ≈ ${eur.format(r.entryEuro)}`
              : `${int.format(ev.entryGems)} gems · ${eur.format(r.entryEuro)}`}</dd>` : `
            <dt>Entry</dt><dd>${int.format(ev.entryGems)} gems · ${eur.format(r.entryEuro)}</dd>
            ${ev.entryGold ? "" : `<dt>Gold entry</dt><dd>gems only</dd>`}`}
            ${ev.rewards.some((x) => x.usd) ? `
            <dt><label for="tax-${ev.id}">Taxes</label></dt>
            <dd><input class="mini" type="number" id="tax-${ev.id}" data-cash="taxPct" min="0" max="100" step="1" value="${cash.taxPct}"> %</dd>
            <dt><label for="usd-${ev.id}">1 $ in €</label></dt>
            <dd><input class="mini" type="number" id="usd-${ev.id}" data-cash="usdRate" min="0" step="0.01" value="${cash.usdRate}"> €</dd>` : ""}
            ${gemsOnly(ev) ? `<dt>EV in gems</dt><dd>${signedGems(r.gems - ev.entryGems)}</dd>` : ""}
            ${ev.rewards.some((x) => x.next) ? `<dt>${ev.advanceLabel || "Advance chance"}</dt><dd>${trophyLabel(probWhere((x) => x.next))}</dd>` : ""}
            <dt>Trophy chance</dt><dd>${trophyLabel(trophyProb(ev, s.winrate, r.dist))}</dd>
            ${ev.rewards.some((x) => x.invite) ? `<dt>Invite chance</dt><dd>${trophyLabel(probWhere((x) => x.invite))}</dd>` : ""}
            ${ev.rewards.some((x) => x.boxes) ? `<dt>Box chance</dt><dd>${trophyLabel(probWhere((x) => x.boxes))}</dd>` : ""}
          </dl>
          <details>
            <summary>Win distribution</summary>
            <table><thead><tr><th>Wins</th><th>P</th><th>Reward</th></tr></thead><tbody>${rows}</tbody></table>
          </details>
          ${ev.payToggle && payGold.has(ev.id) ? `<p class="src">Gold valued at the Premier Draft rate (${GOLD_PER_GEM.toFixed(2).replace(".", ",")} gold per gem).</p>` : ""}
          <p class="src"><a href="${ev.source}" target="_blank" rel="noopener">Source</a> · ${ev.updated}</p>
        </article>`;
    }).join("");
  }

  // chart geometry; the slider below the chart is aligned to the plot area via CSS (pad.l/W, pad.r/W)
  const W = 640, H = 220, pad = { l: 64, r: 16, t: 12, b: 28 };
  const xMin = 0.45, xMax = 0.75;

  function renderChart(s) {
    const xs = [];
    for (let x = xMin; x <= xMax + 1e-9; x += 0.005) xs.push(x);

    // series[i] is null for hidden events so colours stay tied to the event index
    const series = window.EVENTS.map((ev) => hidden.has(ev.id) ? null :
      xs.map((x) => evaluate(ev, x, s).net));
    const all = series.filter(Boolean).flat();
    let yMin = Math.min(0, ...all), yMax = Math.max(0, ...all);
    if (yMax - yMin < 1) { yMin -= 1; yMax += 1; }
    const span = yMax - yMin;
    yMin -= span * 0.05; yMax += span * 0.05;

    const sx = (x) => pad.l + ((x - xMin) / (xMax - xMin)) * (W - pad.l - pad.r);
    const sy = (y) => pad.t + (1 - (y - yMin) / (yMax - yMin)) * (H - pad.t - pad.b);

    const step = niceStep((yMax - yMin) / 5);
    let grid = "";
    for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
      grid += `<line class="grid${Math.abs(y) < 1e-9 ? " zero" : ""}" x1="${pad.l}" x2="${W - pad.r}" y1="${sy(y)}" y2="${sy(y)}"/>
        <text class="tick" x="${pad.l - 6}" y="${sy(y) + 4}" text-anchor="end">${int.format(y)} €</text>`;
    }
    // x labels on whole multiples of 10 % only
    for (let p = Math.ceil(xMin * 10 - 1e-9) * 10; p <= xMax * 100 + 1e-9; p += 10) {
      grid += `<text class="tick" x="${sx(p / 100)}" y="${H - pad.b + 18}" text-anchor="middle">${p} %</text>`;
    }

    const lines = series.map((ys, i) => {
      if (!ys) return "";
      const d = ys.map((y, j) => `${j ? "L" : "M"}${sx(xs[j]).toFixed(1)},${sy(y).toFixed(1)}`).join("");
      return `<path d="${d}" fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="2.5"/>`;
    }).join("");

    // break-even: ring on the zero line plus a dashed drop line to the x-axis
    const breakEvens = window.EVENTS.map((ev) => breakEven(ev, s));
    const beMarks = breakEvens.map((be, i) => {
      if (!series[i] || be == null || be < xMin || be > xMax) return "";
      const c = COLORS[i % COLORS.length], bx = sx(be);
      return `<line class="be-line" x1="${bx}" x2="${bx}" y1="${sy(0)}" y2="${H - pad.b}" stroke="${c}"/>
        <circle class="be-ring" cx="${bx}" cy="${sy(0)}" r="5" stroke="${c}"/>`;
    }).join("");

    const cx = sx(s.winrate);
    const dots = window.EVENTS.map((ev, i) => {
      if (!series[i]) return "";
      const y = evaluate(ev, s.winrate, s).net;
      return `<circle cx="${cx}" cy="${sy(y)}" r="4.5" fill="${COLORS[i % COLORS.length]}" class="dot"/>`;
    }).join("");

    $("chart").innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Net EV in euro by game win rate">
        ${grid}
        <line class="marker" x1="${cx}" x2="${cx}" y1="${pad.t}" y2="${H - pad.b}"/>
        ${beMarks}${lines}${dots}
      </svg>`;

    $("legend").innerHTML = window.EVENTS.map((ev, i) => {
      const on = !hidden.has(ev.id);
      return `<button type="button" class="toggle${on ? "" : " off"}" data-id="${ev.id}" aria-pressed="${on}"
          title="${on ? "Hide" : "Show"} ${ev.name}"><i style="background:${COLORS[i % COLORS.length]}"></i>${ev.name}
        <em>break-even ${breakEvenLabel(breakEvens[i])}</em></button>`;
    }).join("");
  }

  // Game win rate at which net EV = 0, or null if the event is never profitable.
  // Net EV rises with win rate (rewards never shrink with more wins), so bisection works.
  function breakEven(ev, prices) {
    const net = (p) => evaluate(ev, p, prices).net;
    let lo = 0, hi = 1;
    if (net(hi) < 0) return null;
    if (net(lo) >= 0) return 0;
    for (let i = 0; i < 40; i++) {
      const mid = (lo + hi) / 2;
      if (net(mid) < 0) lo = mid; else hi = mid;
    }
    return hi;
  }

  const breakEvenLabel = (be) => (be == null ? "never" : be === 0 ? "always" : pct(be));

  function niceStep(raw) {
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }

  function render() {
    const s = readSettings();
    $("winrate-out").textContent = pct(s.winrate);
    $("chart").setAttribute("aria-valuenow", winratePct);
    $("bo3-out").textContent = "Bo3 match win rate: " + pct(bo3MatchRate(s.winrate));
    renderCards(s);
    renderChart(s);
    saveSettings();
  }

  // click or drag on the chart to set the win rate
  function setWinrateFromPointer(e) {
    const rect = $("chart").getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const x = xMin + ((px - pad.l) / (W - pad.l - pad.r)) * (xMax - xMin);
    setWinrate(x * 100);
    render();
  }

  // clamp to the chart range and round to 0.5 %
  function setWinrate(pct) {
    if (!isFinite(pct)) return;
    winratePct = Math.round(Math.min(xMax * 100, Math.max(xMin * 100, pct)) * 2) / 2;
  }

  const chartEl = $("chart");
  chartEl.addEventListener("pointerdown", (e) => {
    chartEl.setPointerCapture(e.pointerId);
    setWinrateFromPointer(e);
  });
  chartEl.addEventListener("pointermove", (e) => {
    if (chartEl.hasPointerCapture(e.pointerId)) setWinrateFromPointer(e);
  });
  chartEl.addEventListener("keydown", (e) => {
    const delta = { ArrowLeft: -0.5, ArrowDown: -0.5, ArrowRight: 0.5, ArrowUp: 0.5, PageDown: -5, PageUp: 5 }[e.key];
    if (delta == null) return;
    e.preventDefault();
    setWinrate(winratePct + delta);
    render();
  });

  // gems/gold switch on cards of events with payToggle
  $("cards").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-pay]");
    if (!btn) return;
    if (btn.dataset.currency === "gold") payGold.add(btn.dataset.pay); else payGold.delete(btn.dataset.pay);
    render();
  });

  // cash inputs live inside a card, which is rebuilt on render; "change" (Enter, blur, spinner)
  // avoids rebuilding the input while you are still typing in it
  $("cards").addEventListener("change", (e) => {
    const key = e.target.dataset && e.target.dataset.cash;
    if (!key) return;
    cash[key] = e.target.value;
    render();
  });

  // legend entries toggle events in the chart and the cards
  $("legend").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
    render();
  });

  loadSettings();
  ["gemprice", "boxprice"].forEach((id) => $(id).addEventListener("input", render));
  render();

  // exposed for console sanity checks
  window.mtgaEv = { winDistribution, fixedMatchDistribution, evaluate, breakEven };
})();
