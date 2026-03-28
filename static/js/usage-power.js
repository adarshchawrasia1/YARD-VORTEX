(function () {
  const selectEl = document.getElementById("usage-scope-select");
  const periodSelect = document.getElementById("usage-period-select");
  const canvas = document.getElementById("usage-pie-chart");
  const pieLegendEl = document.getElementById("usage-pie-legend");
  const emptyEl = document.getElementById("usage-pie-empty");
  const subtitleEl = document.getElementById("usage-power-subtitle");
  const totalsKwhWrap = document.getElementById("totals-kwh-wrap");
  const totalsKwh = document.getElementById("totals-kwh");
  const breakdownWrap = document.getElementById("usage-breakdown-wrap");
  const breakdownCards = document.getElementById("usage-breakdown-cards");
  const usageRightEmpty = document.getElementById("usage-right-empty");
  const usageHeroStats = document.getElementById("usage-hero-stats");
  const heroCostPeriodTag = document.getElementById("hero-cost-period-tag");
  const heroCostYr = document.getElementById("hero-cost-yr");
  const heroCostSub = document.getElementById("hero-cost-sub");
  const heroCo2PeriodTag = document.getElementById("hero-co2-period-tag");
  const heroCo2Yr = document.getElementById("hero-co2-yr");
  const heroCo2Sub = document.getElementById("hero-co2-sub");
  const totalsKwhDaily = document.getElementById("totals-kwh-daily");
  const totalsKwhLabel = document.getElementById("totals-kwh-label");
  const usageWasteSummary = document.getElementById("usage-waste-summary");
  const rateInput = document.getElementById("settings-rate");
  const regionSelect = document.getElementById("settings-region");
  const settingsSaveBtn = document.getElementById("settings-save");

  const DAYS_MONTH = 365 / 12;
  const DAYS_QUARTER = 365 / 4;
  const DAYS_HALF = 365 / 2;
  const DAYS_YEAR = 365;

  /** @type {Record<string, { days: number, tag: string }>} */
  const PERIOD_META = {
    "1d": { days: 1, tag: "Per day" },
    "1m": { days: DAYS_MONTH, tag: "Per month (~30.44 d)" },
    "3m": { days: DAYS_QUARTER, tag: "Per 3 months (quarter)" },
    "6m": { days: DAYS_HALF, tag: "Per 6 months" },
    "1y": { days: DAYS_YEAR, tag: "Per year (365 d)" },
  };

  function getPeriodMeta() {
    const v = periodSelect?.value || "1y";
    return PERIOD_META[v] || PERIOD_META["1y"];
  }

  let chartInstance = null;
  let catalogCache = null;
  let lastState = null;
  /** @type {{ settings: object, regions: object[], co2KgPerKwh: number } | null} */
  let settingsBundle = null;

  const COLORS = [
    "#38bdf8",
    "#a78bfa",
    "#34d399",
    "#fbbf24",
    "#fb7185",
    "#2dd4bf",
    "#c084fc",
    "#94a3b8",
  ];

  function fmtMoney(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return "₹" + n.toFixed(2);
  }

  function fmtNum(n, d) {
    const x = Number(n);
    if (Number.isNaN(x)) return "—";
    return x.toFixed(d != null ? d : 3);
  }

  function buildCatalogIdToCategory(catalog) {
    const map = {};
    for (const cat of catalog.categories || []) {
      const label = cat.name || cat.id;
      for (const it of cat.items || []) {
        if (it.id) map[it.id] = label;
      }
    }
    for (const it of catalog.items || []) {
      if (it.id && !map[it.id]) map[it.id] = "Other";
    }
    return map;
  }

  function dailyKwh(a) {
    const aw = Number(a.active_w) || 0;
    const ah = Number(a.active_hours_daily) || 0;
    if (a.standby_when_inactive === false) {
      return (aw * ah) / 1000;
    }
    const sw = Number(a.standby_w) || 0;
    const sh = Number(a.standby_hours_daily) || 0;
    return (aw * ah + sw * sh) / 1000;
  }

  /** kWh/day from standby draw only (0 if standby not modeled). */
  function standbyKwhDay(a) {
    if (a.standby_when_inactive === false) return 0;
    const sw = Number(a.standby_w) || 0;
    const sh = Number(a.standby_hours_daily) || 0;
    return (sw * sh) / 1000;
  }

  /**
   * Composite waste score 0–1: blends energy impact (proxy for cost + CO₂) and standby share.
   * Cost and CO₂ are both linear in kWh with house-wide constants, so one normalized kWh term covers both.
   */
  const WASTE_WEIGHT_IMPACT = 2 / 3;
  const WASTE_WEIGHT_STANDBY = 1 / 3;

  function enrichRowsWithWasteScores(rows) {
    if (!rows.length) return [];
    const maxK = Math.max(...rows.map((r) => r.kwhDay), 0);
    const denom = maxK > 1e-12 ? maxK : 1;
    const scored = rows.map((r) => {
      const normImpact = r.kwhDay / denom;
      const normStandby = Math.min(1, Math.max(0, r.standbyShare));
      const wasteScore =
        WASTE_WEIGHT_IMPACT * normImpact + WASTE_WEIGHT_STANDBY * normStandby;
      return { ...r, wasteScore };
    });
    scored.sort((a, b) => {
      const d = b.wasteScore - a.wasteScore;
      if (Math.abs(d) > 1e-9) return d;
      return b.kwhDay - a.kwhDay;
    });
    return scored.map((r, i) => ({ ...r, wasteRank: i + 1 }));
  }

  function aggregateByCategory(state, scope, idToCat) {
    const totals = {};
    const rooms =
      scope === "home"
        ? state.rooms || []
        : (state.rooms || []).filter((r) => r.id === scope);

    for (const room of rooms) {
      for (const a of room.appliances || []) {
        const cid = a.catalog_id || "";
        const catName = idToCat[cid] || "Other";
        const kwh = dailyKwh(a);
        totals[catName] = (totals[catName] || 0) + kwh;
      }
    }
    return totals;
  }

  function collectRows(state, scope) {
    const rows = [];
    const rooms =
      scope === "home"
        ? state.rooms || []
        : (state.rooms || []).filter((r) => r.id === scope);
    for (const room of rooms) {
      for (const a of room.appliances || []) {
        const k = dailyKwh(a);
        const ks = standbyKwhDay(a);
        const standbyShare = k > 1e-12 ? Math.min(1, ks / k) : 0;
        rows.push({
          name: a.name || "Appliance",
          roomName: room.name,
          kwhDay: k,
          kwhStandbyDay: ks,
          standbyShare,
        });
      }
    }
    return rows;
  }

  function resolveCo2KgPerKwh(settings, regions) {
    const rid = settings?.region_id;
    const r = (regions || []).find((x) => x.id === rid);
    return r ? Number(r.co2_kg_per_kwh) || 0.82 : 0.82;
  }

  async function loadSettingsBundle() {
    const r = await fetch("/api/settings");
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || "settings");
    const co2 = resolveCo2KgPerKwh(data.settings, data.regions);
    settingsBundle = { settings: data.settings, regions: data.regions || [], co2KgPerKwh: co2 };
    if (rateInput) rateInput.value = String(data.settings.rate_inr_per_kwh ?? 8);
    if (regionSelect) {
      regionSelect.innerHTML = "";
      for (const reg of data.regions || []) {
        const o = document.createElement("option");
        o.value = reg.id;
        o.textContent = `${reg.name} (${reg.co2_kg_per_kwh} kg/kWh)`;
        regionSelect.appendChild(o);
      }
      regionSelect.value = data.settings.region_id || (data.regions[0] && data.regions[0].id) || "";
    }
    settingsBundle.co2KgPerKwh = resolveCo2KgPerKwh(
      { region_id: regionSelect?.value || data.settings.region_id },
      data.regions
    );
    return settingsBundle;
  }

  function currentRateAndCo2() {
    const rate = parseFloat(rateInput?.value);
    const r = Number.isFinite(rate) && rate >= 0 ? rate : 0;
    const rid = regionSelect?.value;
    const reg = settingsBundle?.regions?.find((x) => x.id === rid);
    const co2 = reg ? Number(reg.co2_kg_per_kwh) || 0 : settingsBundle?.co2KgPerKwh ?? 0.82;
    return { rate: r, co2KgPerKwh: co2 };
  }

  async function saveSettings() {
    const { rate, co2KgPerKwh } = currentRateAndCo2();
    const region_id = regionSelect?.value || "in_grid_avg";
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rate_inr_per_kwh: rate, region_id }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Save failed");
    settingsBundle = {
      settings: data.settings,
      regions: data.regions || [],
      co2KgPerKwh: resolveCo2KgPerKwh(data.settings, data.regions),
    };
    if (rateInput) rateInput.value = String(data.settings.rate_inr_per_kwh);
    if (regionSelect) regionSelect.value = data.settings.region_id;
    return settingsBundle;
  }

  function populateRoomSelect(state) {
    if (!selectEl) return;
    const prev = selectEl.value;
    selectEl.innerHTML = "";
    const homeOpt = document.createElement("option");
    homeOpt.value = "home";
    homeOpt.textContent = "Home (entire house)";
    selectEl.appendChild(homeOpt);
    for (const room of state.rooms || []) {
      const o = document.createElement("option");
      o.value = room.id;
      o.textContent = room.name;
      selectEl.appendChild(o);
    }
    if (prev && [...selectEl.options].some((o) => o.value === prev)) {
      selectEl.value = prev;
    } else {
      selectEl.value = "home";
    }
  }

  function updateTotalsAndTable(scope) {
    if (!lastState || !breakdownWrap || !breakdownCards) return;

    const { rate, co2KgPerKwh } = currentRateAndCo2();
    const rawRows = collectRows(lastState, scope);
    const rows = enrichRowsWithWasteScores(rawRows);

    if (rows.length === 0) {
      if (totalsKwhWrap) totalsKwhWrap.classList.add("hidden");
      if (usageHeroStats) usageHeroStats.classList.add("hidden");
      breakdownWrap.classList.add("hidden");
      breakdownCards.innerHTML = "";
      if (usageWasteSummary) usageWasteSummary.textContent = "";
      if (usageRightEmpty) usageRightEmpty.classList.remove("hidden");
      if (typeof window.phantomRenderInsights === "function") window.phantomRenderInsights();
      return;
    }

    if (usageRightEmpty) usageRightEmpty.classList.add("hidden");
    breakdownWrap.classList.remove("hidden");
    if (usageHeroStats) usageHeroStats.classList.remove("hidden");
    if (totalsKwhWrap) totalsKwhWrap.classList.remove("hidden");

    const { days: mult, tag: pTag } = getPeriodMeta();

    let sumK = 0;
    let sumCostDay = 0;
    let sumCo2Day = 0;
    breakdownCards.innerHTML = "";

    const topNames = rows
      .slice(0, 3)
      .map((r) => (scope === "home" ? `${r.name} (${r.roomName})` : r.name))
      .map((label) => escapeHtml(label));
    if (usageWasteSummary) {
      usageWasteSummary.innerHTML = `<span class="text-base font-bold text-amber-100">Waste score ranking</span> — sorted worst first. Score blends energy (cost &amp; CO₂ scale with kWh) and standby share of that energy.<br /><span class="mt-1.5 inline-block text-base font-semibold text-amber-200">Top offenders:</span> <span class="text-base font-mono font-semibold text-amber-50">${topNames.join(" · ")}</span>`;
    }

    for (const row of rows) {
      sumK += row.kwhDay;
      const costDay = row.kwhDay * rate;
      const co2Day = row.kwhDay * co2KgPerKwh;
      sumCostDay += costDay;
      sumCo2Day += co2Day;

      const kP = row.kwhDay * mult;
      const costP = costDay * mult;
      const co2P = co2Day * mult;

      const rank = row.wasteRank;
      const scorePct = Math.round(row.wasteScore * 100);
      const standbyPct = Math.round(row.standbyShare * 100);

      let cardFrame =
        "rounded-lg border px-3 py-3 shadow-sm transition-colors";
      if (rank === 1) {
        cardFrame +=
          " border-amber-500/55 bg-gradient-to-br from-amber-950/35 to-surface/80 ring-1 ring-amber-500/30";
      } else if (rank === 2) {
        cardFrame += " border-orange-600/45 bg-orange-950/20";
      } else if (rank === 3) {
        cardFrame += " border-amber-800/40 bg-amber-950/15";
      } else {
        cardFrame += " border-border/90 bg-surface/70";
      }

      const card = document.createElement("div");
      card.className = cardFrame;
      const roomLine =
        scope === "home"
          ? `<p class="truncate text-[11px] text-slate-500">${escapeHtml(row.roomName)}</p>`
          : "";
      card.innerHTML = `
        <p class="truncate font-medium text-slate-100">${escapeHtml(row.name)}</p>
        ${roomLine}
        <p class="mt-1 text-[10px] uppercase tracking-wide text-slate-500">${escapeHtml(pTag)}</p>
        <div class="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-slate-600/70 bg-slate-950/70 px-2 py-3 sm:px-3">
          <div class="text-center sm:text-left">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rank</p>
            <p class="mt-0.5 font-mono text-2xl font-bold tabular-nums text-amber-300 sm:text-3xl">#${rank}</p>
          </div>
          <div class="text-center">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Score</p>
            <p class="mt-0.5 font-mono text-2xl font-bold tabular-nums text-amber-200 sm:text-3xl">${scorePct}<span class="align-top text-base font-semibold text-slate-500">/100</span></p>
          </div>
          <div class="text-center sm:text-right">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Standby</p>
            <p class="mt-0.5 font-mono text-2xl font-bold tabular-nums text-slate-200 sm:text-3xl">${standbyPct}<span class="text-lg font-semibold text-slate-500">%</span></p>
          </div>
        </div>
        <dl class="mt-3 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
          <dt class="text-slate-500">Energy (kWh)</dt><dd class="text-right font-mono text-slate-300">${fmtNum(kP, 3)}</dd>
          <dt class="text-slate-500">Cost (₹)</dt><dd class="text-right font-mono text-sky-300/90">${fmtMoney(costP)}</dd>
          <dt class="text-slate-500">CO₂ (kg)</dt><dd class="text-right font-mono text-emerald-300/80">${fmtNum(co2P, 3)}</dd>
          <dt class="text-slate-500">Basis</dt><dd class="text-right font-mono text-slate-500">${fmtNum(row.kwhDay, 3)} kWh/d</dd>
        </dl>`;
      breakdownCards.appendChild(card);
    }

    if (totalsKwh) {
      totalsKwh.innerHTML = `${fmtNum(sumK * mult, 3)} <span class="text-slate-400">kWh</span> <span class="text-slate-500">· ${escapeHtml(pTag)}</span>`;
    }
    if (totalsKwhDaily) {
      totalsKwhDaily.textContent = `Average basis: ${fmtNum(sumK, 3)} kWh/day across ${rows.length} appliance(s)`;
    }
    if (totalsKwhLabel) totalsKwhLabel.textContent = `Energy (${pTag})`;

    const costP = sumCostDay * mult;
    const co2P = sumCo2Day * mult;
    if (heroCostPeriodTag) heroCostPeriodTag.textContent = pTag;
    if (heroCostYr) heroCostYr.textContent = fmtMoney(costP);
    if (heroCostSub) {
      heroCostSub.innerHTML = `<span class="block">≈ ${fmtMoney(sumCostDay)} per day at this usage</span><span class="block text-slate-500">Other periods: change “Show amounts for” above</span>`;
    }

    if (heroCo2PeriodTag) heroCo2PeriodTag.textContent = pTag;
    if (heroCo2Yr) heroCo2Yr.textContent = `${fmtNum(co2P, 2)} kg`;
    if (heroCo2Sub) {
      heroCo2Sub.innerHTML = `<span class="block">≈ ${fmtNum(sumCo2Day, 3)} kg CO₂ per day</span><span class="block text-slate-500">Using selected grid factor (kg/kWh)</span>`;
    }

    const roomLabel =
      scope === "home"
        ? "Entire house"
        : (lastState.rooms || []).find((r) => r.id === scope)?.name || "Room";
    if (subtitleEl) {
      subtitleEl.textContent = `${roomLabel} · ${fmtMoney(rate)}/kWh · ${fmtNum(co2KgPerKwh, 2)} kg CO₂/kWh`;
    }

    if (typeof window.phantomRenderInsights === "function") window.phantomRenderInsights();
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function updateChart() {
    if (!canvas || !emptyEl || !catalogCache || !lastState) return;

    const scope = selectEl?.value || "home";
    const { rate, co2KgPerKwh } = currentRateAndCo2();
    const idToCat = buildCatalogIdToCategory(catalogCache);
    const totals = aggregateByCategory(lastState, scope, idToCat);
    const entries = Object.entries(totals).filter(([, v]) => v > 1e-9);
    entries.sort((a, b) => b[1] - a[1]);

    updateTotalsAndTable(scope);

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    if (entries.length === 0) {
      canvas.classList.add("hidden");
      emptyEl.classList.remove("hidden");
      if (pieLegendEl) {
        pieLegendEl.innerHTML = "";
        pieLegendEl.classList.add("hidden");
      }
      if (subtitleEl && collectRows(lastState, scope).length === 0) {
        subtitleEl.textContent =
          "Add appliances in Audit to see energy split. Totals scale with “Show amounts for” (day / month / quarter / half-year / year).";
      }
      return;
    }

    canvas.classList.remove("hidden");
    emptyEl.classList.add("hidden");

    const labels = entries.map(([k]) => k);
    const data = entries.map(([, v]) => v);
    const labelColors = labels.map((_, i) => COLORS[i % COLORS.length]);
    const piePeriod = getPeriodMeta();
    const periodMult = piePeriod.days;
    const periodTag = piePeriod.tag;

    const ctx = canvas.getContext("2d");
    chartInstance = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: labelColors,
            borderColor: "#1a222d",
            borderWidth: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        layout: { padding: 6 },
        plugins: {
          legend: {
            display: false,
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const kwhDay = ctx.raw;
                const sum = data.reduce((s, x) => s + x, 0);
                const pct = sum > 0 ? ((kwhDay / sum) * 100).toFixed(1) : "0";
                const kwhP = kwhDay * periodMult;
                const costP = kwhDay * rate * periodMult;
                const co2P = kwhDay * co2KgPerKwh * periodMult;
                return [
                  `${ctx.label}: ${kwhDay.toFixed(3)} kWh/day basis (${pct}%)`,
                  `${periodTag}: ${kwhP.toFixed(3)} kWh · ${fmtMoney(costP)} · ${co2P.toFixed(3)} kg CO₂`,
                ];
              },
            },
          },
        },
      },
    });

    if (pieLegendEl) {
      const sum = data.reduce((s, x) => s + x, 0);
      pieLegendEl.innerHTML = labels
        .map((label, i) => {
          const pct = sum > 0 ? ((data[i] / sum) * 100).toFixed(1) : "0";
          return `<li class="flex items-start gap-2.5 py-0.5">
            <span class="mt-1.5 h-3 w-3 shrink-0 rounded-sm border border-slate-800" style="background-color:${labelColors[i]}"></span>
            <span class="min-w-0 flex-1 text-sm leading-snug text-slate-200"><span class="font-medium">${escapeHtml(label)}</span> <span class="text-slate-500">(${pct}%)</span></span>
          </li>`;
        })
        .join("");
      pieLegendEl.classList.remove("hidden");
    }
  }

  function ensureCatalog() {
    if (catalogCache) return Promise.resolve();
    return fetch("/api/catalog")
      .then((r) => r.json())
      .then((data) => {
        catalogCache = data;
      });
  }

  function applyState(state) {
    if (!state) return Promise.resolve();
    lastState = state;
    return ensureCatalog().then(() => {
      populateRoomSelect(lastState);
      updateChart();
    });
  }

  window.phantomOnStateUpdated = function (state) {
    applyState(state).catch(console.error);
  };

  function init() {
    if (!selectEl || typeof Chart === "undefined") return;
    selectEl.addEventListener("change", updateChart);
    if (periodSelect) periodSelect.addEventListener("change", updateChart);
    if (regionSelect) {
      regionSelect.addEventListener("change", () => {
        if (settingsBundle) {
          settingsBundle.co2KgPerKwh = currentRateAndCo2().co2KgPerKwh;
        }
        updateChart();
      });
    }
    let rateDebounce;
    if (rateInput) {
      rateInput.addEventListener("change", updateChart);
      rateInput.addEventListener("input", () => {
        clearTimeout(rateDebounce);
        rateDebounce = setTimeout(updateChart, 200);
      });
    }
    if (settingsSaveBtn) {
      settingsSaveBtn.addEventListener("click", () => {
        saveSettings()
          .then(() => updateChart())
          .catch((e) => alert(e.message || "Could not save settings"));
      });
    }

    loadSettingsBundle()
      .catch(console.error)
      .then(() =>
        fetch("/api/state")
          .then((r) => r.json())
          .then((state) => window.phantomOnStateUpdated(state))
      );
  }

  window.phantomGetUsageContext = function phantomGetUsageContext() {
    return {
      lastState,
      catalog: catalogCache,
      scope: selectEl?.value || "home",
      periodMeta: getPeriodMeta(),
      rate: currentRateAndCo2().rate,
      co2KgPerKwh: currentRateAndCo2().co2KgPerKwh,
    };
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
