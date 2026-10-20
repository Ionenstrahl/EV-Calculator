(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "mtga-ev-settings";
  const COLORS = ["#2a78d6", "#d9822b", "#8a5cd1", "#1f9e74"];

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

  function evaluate(ev, p, euroPerGem, boxEuro) {
    const dist = distributionFor(ev, p);
    let gems = 0, boxes = 0;
    dist.forEach((prob, k) => {
      const r = ev.rewards[k] || {};
      gems += prob * (r.gems || 0);
      boxes += prob * (r.boxes || 0);
    });
    const entryEuro = ev.entryGems * euroPerGem;
    const returnEuro = gems * euroPerGem + boxes * boxEuro;
    return { dist, gems, boxes, entryEuro, returnEuro, net: returnEuro - entryEuro };
  }

  // --- Formatting ------------------------------------------------------------

  const eur = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });
  const int = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
  const pct = (x, d = 1) => (x * 100).toFixed(d).replace(".", ",") + " %";
  const signedEur = (x) => (x >= 0 ? "+" : "−") + eur.format(Math.abs(x));

  function rewardLabel(r) {
    const parts = [];
    if (r.gems) parts.push(int.format(r.gems) + " gems");
    if (r.boxes) parts.push(r.boxes + (r.boxes === 1 ? " box" : " boxes"));
    return parts.length ? parts.join(" + ") : "–";
  }

  // --- Settings --------------------------------------------------------------

  function readSettings() {
    return {
      winrate: parseFloat($("winrate").value) / 100,
      euroPerGem: (parseFloat($("gemprice").value) || 0) / 10000,
      boxEuro: parseFloat($("boxprice").value) || 0,
    };
  }

  function loadSettings() {
    try {
      const s = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!s) return;
      if (s.winrate != null) $("winrate").value = s.winrate;
      if (s.gemprice != null) $("gemprice").value = s.gemprice;
      if (s.boxprice != null) $("boxprice").value = s.boxprice;
    } catch (e) { /* storage unavailable */ }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        winrate: $("winrate").value, gemprice: $("gemprice").value, boxprice: $("boxprice").value,
      }));
    } catch (e) { /* storage unavailable */ }
  }

  // --- Rendering -------------------------------------------------------------

  function renderCards(s) {
    $("cards").innerHTML = window.EVENTS.map((ev, i) => {
      const r = evaluate(ev, s.winrate, s.euroPerGem, s.boxEuro);
      const roi = r.entryEuro > 0 ? r.net / r.entryEuro : 0;
      const rows = r.dist.map((prob, k) => `
        <tr><td>${k}</td><td>${pct(prob)}</td><td>${rewardLabel(ev.rewards[k] || {})}</td></tr>`).join("");
      return `
        <article class="card" style="--accent:${COLORS[i % COLORS.length]}">
          <h2>${ev.name}</h2>
          <p class="note">${ev.note}</p>
          <div class="net ${r.net >= 0 ? "pos" : "neg"}">${signedEur(r.net)}</div>
          <p class="roi">ROI ${roi >= 0 ? "+" : ""}${pct(roi)} per entry</p>
          <dl>
            <dt>Entry</dt><dd>${int.format(ev.entryGems)} gems · ${eur.format(r.entryEuro)}</dd>
            <dt>Expected gems</dt><dd>${int.format(r.gems)}</dd>
            ${ev.rewards.some((x) => x.boxes) ? `<dt>Expected boxes</dt><dd>${r.boxes.toFixed(3).replace(".", ",")}</dd>` : ""}
            <dt>Expected return</dt><dd>${eur.format(r.returnEuro)}</dd>
          </dl>
          <details>
            <summary>Win distribution</summary>
            <table><thead><tr><th>Wins</th><th>P</th><th>Reward</th></tr></thead><tbody>${rows}</tbody></table>
          </details>
          <p class="src"><a href="${ev.source}" target="_blank" rel="noopener">Source</a> · ${ev.updated}</p>
        </article>`;
    }).join("");
  }

  function renderChart(s) {
    const W = 640, H = 320, pad = { l: 64, r: 16, t: 16, b: 40 };
    const xMin = 0.3, xMax = 0.8;
    const xs = [];
    for (let x = xMin; x <= xMax + 1e-9; x += 0.005) xs.push(x);

    const series = window.EVENTS.map((ev) =>
      xs.map((x) => evaluate(ev, x, s.euroPerGem, s.boxEuro).net));
    const all = series.flat();
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
    for (let x = 0.3; x <= 0.8 + 1e-9; x += 0.1) {
      grid += `<text class="tick" x="${sx(x)}" y="${H - pad.b + 18}" text-anchor="middle">${Math.round(x * 100)} %</text>`;
    }

    const lines = series.map((ys, i) => {
      const d = ys.map((y, j) => `${j ? "L" : "M"}${sx(xs[j]).toFixed(1)},${sy(y).toFixed(1)}`).join("");
      return `<path d="${d}" fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="2.5"/>`;
    }).join("");

    const cx = sx(s.winrate);
    const dots = window.EVENTS.map((ev, i) => {
      const y = evaluate(ev, s.winrate, s.euroPerGem, s.boxEuro).net;
      return `<circle cx="${cx}" cy="${sy(y)}" r="4.5" fill="${COLORS[i % COLORS.length]}" class="dot"/>`;
    }).join("");

    $("chart").innerHTML = `
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Net EV in euro by game win rate">
        ${grid}
        <line class="marker" x1="${cx}" x2="${cx}" y1="${pad.t}" y2="${H - pad.b}"/>
        ${lines}${dots}
      </svg>`;

    $("legend").innerHTML = window.EVENTS.map((ev, i) =>
      `<span><i style="background:${COLORS[i % COLORS.length]}"></i>${ev.name}</span>`).join("");
  }

  function niceStep(raw) {
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const n = raw / mag;
    return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  }

  function render() {
    const s = readSettings();
    $("winrate-out").textContent = pct(s.winrate);
    $("bo3-out").textContent = "Bo3 match win rate: " + pct(bo3MatchRate(s.winrate));
    renderCards(s);
    renderChart(s);
    saveSettings();
  }

  loadSettings();
  ["winrate", "gemprice", "boxprice"].forEach((id) => $(id).addEventListener("input", render));
  render();

  // exposed for console sanity checks
  window.mtgaEv = { winDistribution, fixedMatchDistribution, evaluate };
})();
