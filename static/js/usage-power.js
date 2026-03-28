(function () {
  const selectEl = document.getElementById("usage-scope-select");
  const canvas = document.getElementById("usage-pie-chart");
  const emptyEl = document.getElementById("usage-pie-empty");
  const subtitleEl = document.getElementById("usage-power-subtitle");
  const totalsKwhWrap = document.getElementById("totals-kwh-wrap");
  const totalsKwh = document.getElementById("totals-kwh");
  const breakdownWrap = document.getElementById("usage-breakdown-wrap");
  const breakdownCards = document.getElementById("usage-breakdown-cards");
  const usageRightEmpty = document.getElementById("usage-right-empty");
  const usageHeroStats = document.getElementById("usage-hero-stats");
  const heroCostYr = document.getElementById("hero-cost-yr");
  const heroCostSub = document.getElementById("hero-cost-sub");
  const heroCo2Yr = document.getElementById("hero-co2-yr");
  const heroCo2Sub = document.getElementById("hero-co2-sub");
  const rateInput = document.getElementById("settings-rate");
  const regionSelect = document.getElementById("settings-region");
  const settingsSaveBtn = document.getElementById("settings-save");

  const DAYS_MONTH = 365 / 12;
  const DAYS_YEAR = 365;

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
        rows.push({
          name: a.name || "Appliance",
          roomName: room.name,
          kwhDay: k,
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
    const rows = collectRows(lastState, scope);

    if (rows.length === 0) {
      if (totalsKwhWrap) totalsKwhWrap.classList.add("hidden");
      if (usageHeroStats) usageHeroStats.classList.add("hidden");
      breakdownWrap.classList.add("hidden");
      breakdownCards.innerHTML = "";
      if (usageRightEmpty) usageRightEmpty.classList.remove("hidden");
      return;
    }

    if (usageRightEmpty) usageRightEmpty.classList.add("hidden");
    breakdownWrap.classList.remove("hidden");
    if (usageHeroStats) usageHeroStats.classList.remove("hidden");
    if (totalsKwhWrap) totalsKwhWrap.classList.remove("hidden");

    let sumK = 0;
    let sumCostDay = 0;
    let sumCo2Day = 0;
    breakdownCards.innerHTML = "";

    for (const row of rows) {
      sumK += row.kwhDay;
      const costDay = row.kwhDay * rate;
      const co2Day = row.kwhDay * co2KgPerKwh;
      sumCostDay += costDay;
      sumCo2Day += co2Day;

      const costMo = row.kwhDay * DAYS_MONTH * rate;
      const costYr = row.kwhDay * DAYS_YEAR * rate;
      const co2Yr = row.kwhDay * DAYS_YEAR * co2KgPerKwh;

      const card = document.createElement("div");
      card.className =
        "rounded-lg border border-border/90 bg-surface/70 px-3 py-3 shadow-sm";
      const roomLine =
        scope === "home"
          ? `<p class="truncate text-[11px] text-slate-500">${escapeHtml(row.roomName)}</p>`
          : "";
      card.innerHTML = `
        <p class="truncate font-medium text-slate-100">${escapeHtml(row.name)}</p>
        ${roomLine}
        <dl class="mt-2.5 grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
          <dt class="text-slate-500">kWh/day</dt><dd class="text-right font-mono text-slate-300">${fmtNum(row.kwhDay, 3)}</dd>
          <dt class="text-slate-500">₹/day</dt><dd class="text-right font-mono text-sky-300/90">${fmtMoney(costDay)}</dd>
          <dt class="text-slate-500">CO₂ kg/d</dt><dd class="text-right font-mono text-emerald-300/80">${fmtNum(co2Day, 3)}</dd>
          <dt class="text-slate-500">₹/year</dt><dd class="text-right font-mono text-slate-300">${fmtMoney(costYr)}</dd>
        </dl>`;
      breakdownCards.appendChild(card);
    }

    const kMo = sumK * DAYS_MONTH;
    const kYr = sumK * DAYS_YEAR;
    if (totalsKwh) {
      totalsKwh.innerHTML = `${fmtNum(sumK, 3)} <span class="text-slate-500">kWh/day</span> · ${fmtNum(kMo, 2)} <span class="text-slate-500">kWh/mo</span> · ${fmtNum(kYr, 2)} <span class="text-slate-500">kWh/yr</span>`;
    }

    const cMo = sumCostDay * DAYS_MONTH;
    const cYr = sumCostDay * DAYS_YEAR;
    if (heroCostYr) heroCostYr.textContent = `${fmtMoney(cYr)} / year`;
    if (heroCostSub) {
      heroCostSub.innerHTML = `<span class="block">${fmtMoney(sumCostDay)} per day</span><span class="block">${fmtMoney(cMo)} per month (~30.4 d)</span>`;
    }

    const co2Mo = sumCo2Day * DAYS_MONTH;
    const co2Yr = sumCo2Day * DAYS_YEAR;
    if (heroCo2Yr) heroCo2Yr.textContent = `${fmtNum(co2Yr, 2)} kg / year`;
    if (heroCo2Sub) {
      heroCo2Sub.innerHTML = `<span class="block">${fmtNum(sumCo2Day, 3)} kg per day</span><span class="block">${fmtNum(co2Mo, 2)} kg per month</span>`;
    }

    const roomLabel =
      scope === "home"
        ? "Entire house"
        : (lastState.rooms || []).find((r) => r.id === scope)?.name || "Room";
    if (subtitleEl) {
      subtitleEl.textContent = `${roomLabel} · ${fmtMoney(rate)}/kWh · ${fmtNum(co2KgPerKwh, 2)} kg CO₂/kWh`;
    }
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
      if (subtitleEl && collectRows(lastState, scope).length === 0) {
        subtitleEl.textContent =
          "Energy, cost, and CO₂ use your tariff and regional emission factor. Month ≈ 30.44 days, year = 365 days.";
      }
      return;
    }

    canvas.classList.remove("hidden");
    emptyEl.classList.add("hidden");

    const labels = entries.map(([k]) => k);
    const data = entries.map(([, v]) => v);

    const ctx = canvas.getContext("2d");
    chartInstance = new Chart(ctx, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data,
            backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]),
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
            position: "bottom",
            labels: {
              color: "#cbd5e1",
              padding: 8,
              font: { size: 10 },
              boxWidth: 12,
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const kwh = ctx.raw;
                const sum = data.reduce((s, x) => s + x, 0);
                const pct = sum > 0 ? ((kwh / sum) * 100).toFixed(1) : "0";
                const cost = kwh * rate;
                const co2 = kwh * co2KgPerKwh;
                return [
                  `${ctx.label}: ${kwh.toFixed(3)} kWh/day (${pct}%)`,
                  `Cost: ${fmtMoney(cost)}/day (~${fmtMoney(kwh * DAYS_MONTH * rate)}/mo)`,
                  `CO₂: ${co2.toFixed(3)} kg/day (~${(co2 * DAYS_YEAR).toFixed(1)} kg/yr)`,
                ];
              },
            },
          },
        },
      },
    });
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
