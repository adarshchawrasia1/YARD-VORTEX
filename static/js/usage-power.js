(function () {
  const selectEl = document.getElementById("usage-scope-select");
  const canvas = document.getElementById("usage-pie-chart");
  const emptyEl = document.getElementById("usage-pie-empty");
  const subtitleEl = document.getElementById("usage-power-subtitle");

  let chartInstance = null;
  let catalogCache = null;
  let lastState = null;

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

  function updateChart() {
    if (!canvas || !emptyEl || !catalogCache || !lastState) return;

    const scope = selectEl?.value || "home";
    const idToCat = buildCatalogIdToCategory(catalogCache);
    const totals = aggregateByCategory(lastState, scope, idToCat);
    const entries = Object.entries(totals).filter(([, v]) => v > 1e-9);
    entries.sort((a, b) => b[1] - a[1]);

    if (chartInstance) {
      chartInstance.destroy();
      chartInstance = null;
    }

    if (entries.length === 0) {
      canvas.classList.add("hidden");
      emptyEl.classList.remove("hidden");
      if (subtitleEl) {
        subtitleEl.textContent =
          "Estimated share of daily energy (kWh) by appliance category — no data yet.";
      }
      return;
    }

    canvas.classList.remove("hidden");
    emptyEl.classList.add("hidden");

    const labels = entries.map(([k]) => k);
    const data = entries.map(([, v]) => v);
    const roomLabel =
      scope === "home"
        ? "entire house"
        : (lastState.rooms || []).find((r) => r.id === scope)?.name || "room";

    if (subtitleEl) {
      subtitleEl.textContent = `Daily kWh by category for ${roomLabel} (sum of active + standby terms per appliance)`;
    }

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
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "#cbd5e1",
              padding: 12,
              font: { size: 12 },
            },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const v = ctx.raw;
                const sum = data.reduce((s, x) => s + x, 0);
                const pct = sum > 0 ? ((v / sum) * 100).toFixed(1) : "0";
                return `${ctx.label}: ${v.toFixed(3)} kWh/day (${pct}%)`;
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

  /** Called from audit.js after every successful loadState (avoids missing CustomEvent race). */
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
    fetch("/api/state")
      .then((r) => r.json())
      .then((state) => window.phantomOnStateUpdated(state))
      .catch(console.error);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
