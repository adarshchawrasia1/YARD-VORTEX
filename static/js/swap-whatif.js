(function () {
  const DAYS_YEAR = 365;

  const WASTE_WEIGHT_IMPACT = 2 / 3;
  const WASTE_WEIGHT_STANDBY = 1 / 3;

  /** @type {{ id: string, name: string, priceInr: number }[]} */
  const DREAM_ITEMS = [
    { id: "latte", name: "Starbucks latte", priceInr: 350 },
    { id: "iphone", name: "iPhone (~₹80k)", priceInr: 80000 },
    { id: "laptop", name: "Laptop (~₹60k)", priceInr: 60000 },
    { id: "car", name: "Car down payment (~₹2L)", priceInr: 200000 },
    { id: "house", name: "Home fund (~₹50L)", priceInr: 5000000 },
  ];

  const swapSaveSection = document.getElementById("swap-save-section");
  const swapSaveEmpty = document.getElementById("swap-save-empty");
  const swapSaveCards = document.getElementById("swap-save-cards");
  const swapSaveDream = document.getElementById("swap-save-dream");

  const whatifSection = document.getElementById("whatif-section");
  const whatifEmpty = document.getElementById("whatif-empty");
  const whatifForm = document.getElementById("whatif-form");
  const whatifTableBody = document.getElementById("whatif-table-body");
  const whatifTotalInr = document.getElementById("whatif-total-inr");
  const whatifTotalCo2 = document.getElementById("whatif-total-co2");
  const whatifDream = document.getElementById("whatif-dream");

  function fmtMoney(n) {
    if (n == null || Number.isNaN(n)) return "—";
    return "₹" + n.toFixed(0);
  }

  function fmtNum(n, d) {
    const x = Number(n);
    if (Number.isNaN(x)) return "—";
    return x.toFixed(d != null ? d : 2);
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s == null ? "" : String(s);
    return d.innerHTML;
  }

  function findCategoryForCatalogId(catalog, catalogId) {
    for (const cat of catalog.categories || []) {
      for (const it of cat.items || []) {
        if (it.id === catalogId) return { id: cat.id, name: cat.name, item: it };
      }
    }
    for (const it of catalog.items || []) {
      if (it.id === catalogId) return { id: "other", name: "Other", item: it };
    }
    return null;
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

  function standbyKwhDay(a) {
    if (a.standby_when_inactive === false) return 0;
    const sw = Number(a.standby_w) || 0;
    const sh = Number(a.standby_hours_daily) || 0;
    return (sw * sh) / 1000;
  }

  function collectDetailed(state, scope, catalog) {
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
        const meta = findCategoryForCatalogId(catalog, a.catalog_id || "");
        rows.push({
          name: a.name || "Appliance",
          roomName: room.name,
          roomId: room.id,
          instanceId: a.instance_id,
          catalogId: a.catalog_id,
          categoryId: meta?.id || "custom",
          categoryName: meta?.name || "Custom",
          kwhDay: k,
          kwhStandbyDay: ks,
          standbyShare,
          appliance: a,
        });
      }
    }
    return rows;
  }

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

  function getCategoryItems(catalog, categoryId) {
    for (const cat of catalog.categories || []) {
      if (cat.id === categoryId) return cat.items || [];
    }
    return [];
  }

  /** Model energy if the same usage pattern used another catalog item’s typical active/standby watts. */
  function dailyKwhWithCatalogWatts(userAppliance, catalogItem) {
    const merged = {
      ...userAppliance,
      active_w: Number(catalogItem.default_active_w) || 0,
      standby_w: Number(catalogItem.default_standby_w) || 0,
    };
    return dailyKwh(merged);
  }

  /**
   * Best catalog alternative in the same category (lower modeled kWh at your hours).
   * @returns {null | { headline: string, body: string, saveKwhDay: number, swapToName: string }}
   */
  function buildCatalogSwapRecommendation(row, catalog) {
    const catId = row.categoryId;
    if (!catId || catId === "custom") return null;

    const items = getCategoryItems(catalog, catId);
    if (items.length < 2) return null;

    const a = row.appliance;
    const currentId = a.catalog_id || "";
    const currentMeta = findCategoryForCatalogId(catalog, currentId);
    const currentLabel = currentMeta?.item?.name || a.name || "Current model";

    const currentKwh = dailyKwh(a);
    let best = null;

    for (const item of items) {
      if (item.id === currentId) continue;
      const altKwh = dailyKwhWithCatalogWatts(a, item);
      const saveDay = currentKwh - altKwh;
      if (saveDay <= 1e-9) continue;
      if (!best || saveDay > best.saveKwhDay + 1e-9) {
        best = { item, saveKwhDay: saveDay, altKwh, currentKwh };
      }
    }

    if (!best) return null;

    const b = best.item;
    const ah = Number(a.active_hours_daily) || 0;
    const catLabel = row.categoryName || "this category";

    const headline = `Switch to “${b.name}” (${catLabel})`;
    const curCatW = Math.round(Number(currentMeta?.item?.default_active_w) || 0);
    const yourW = Math.round(Number(a.active_w) || 0);
    const body = `Same category in the catalog: move from “${currentLabel}” (${curCatW || yourW}W listed; you entered ${yourW}W) to “${b.name}” (${Math.round(b.default_active_w)}W active, ${fmtNum(b.default_standby_w, 1)}W standby). At your ${fmtNum(ah, 1)}h/day usage pattern, modeled savings are ~${fmtNum(best.saveKwhDay * DAYS_YEAR, 0)} kWh/yr vs your current device entry.`;

    return {
      headline,
      body,
      saveKwhDay: best.saveKwhDay,
      swapToName: b.name,
    };
  }

  function timeToAffordLabel(priceInr, annualSavingsInr) {
    if (!annualSavingsInr || annualSavingsInr <= 0) return null;
    const years = priceInr / annualSavingsInr;
    if (years >= 100) return `${fmtNum(years, 0)} years`;
    if (years >= 1) return `${fmtNum(years, 1)} years`;
    const months = years * 12;
    if (months >= 1) return `${fmtNum(months, 1)} months`;
    const days = years * 365;
    if (days >= 1) return `${fmtNum(days, 0)} days`;
    return "under a day";
  }

  function dreamLinesHtml(annualSavingsInr, annualCo2Kg) {
    if (!annualSavingsInr || annualSavingsInr <= 0) {
      return `<p class="text-sm leading-relaxed text-slate-400 sm:text-base">Adjust sliders or swap ideas to see savings — then timelines for what you could buy (e.g. iPhone) appear here.</p>`;
    }
    const parts = DREAM_ITEMS.map((item) => {
      const t = timeToAffordLabel(item.priceInr, annualSavingsInr);
      if (!t) return "";
      return `<span class="inline-block rounded-xl border border-sky-500/25 bg-slate-900/55 px-3.5 py-2.5 text-sm text-slate-100 shadow-sm ring-1 ring-white/5 sm:px-4 sm:py-3 sm:text-base"><span class="font-semibold text-sky-300">${escapeHtml(item.name)}</span> <span class="text-slate-500">in</span> <span class="font-mono font-medium text-emerald-300/95">${escapeHtml(t)}</span></span>`;
    }).filter(Boolean);
    return `
      <p class="text-xs font-semibold uppercase tracking-[0.14em] text-sky-400/85 sm:text-sm">Savings banked</p>
      <h3 class="mt-2 text-xl font-bold tracking-tight text-slate-50 sm:text-2xl">You will be able to buy…</h3>
      <p class="mt-2 text-base text-slate-300 sm:text-lg">~${fmtMoney(annualSavingsInr)}<span class="text-slate-500">/yr</span> · ~${fmtNum(annualCo2Kg, 0)} <span class="text-emerald-300/90">kg CO₂/yr</span> avoided</p>
      <p class="mt-5 text-sm font-medium text-slate-300 sm:text-base">For example, if you set aside that total:</p>
      <div class="mt-3 flex flex-wrap gap-3">${parts.join("")}</div>`;
  }

  function renderSwapSave(ctx) {
    if (!swapSaveCards || !swapSaveEmpty || !swapSaveDream) return;
    const { lastState, catalog, scope, rate, co2KgPerKwh } = ctx;
    if (!lastState || !catalog) {
      swapSaveSection?.classList.add("hidden");
      return;
    }
    swapSaveSection?.classList.remove("hidden");

    const detailed = collectDetailed(lastState, scope, catalog);
    const scored = enrichRowsWithWasteScores(detailed);
    const recs = [];
    for (const row of scored) {
      if (recs.length >= 3) break;
      const r = buildCatalogSwapRecommendation(row, catalog);
      if (r) {
        recs.push({
          ...row,
          ...r,
          annualKwh: r.saveKwhDay * DAYS_YEAR,
          annualInr: r.saveKwhDay * DAYS_YEAR * rate,
          annualCo2: r.saveKwhDay * DAYS_YEAR * co2KgPerKwh,
        });
      }
    }

    if (recs.length === 0) {
      swapSaveEmpty.classList.remove("hidden");
      if (detailed.length > 0) {
        swapSaveEmpty.textContent =
          "No cheaper catalog alternative beats your current modeled load in its category — expand the catalog or adjust Audit entries.";
      } else {
        swapSaveEmpty.textContent =
          "Add appliances in Audit Usage and pick a room scope above — we’ll rank waste and show swap ideas here.";
      }
      swapSaveCards.innerHTML = "";
      swapSaveDream.innerHTML = "";
      return;
    }
    swapSaveEmpty.classList.add("hidden");

    let sumAnnualInr = 0;
    let sumAnnualCo2 = 0;
    swapSaveCards.innerHTML = recs
      .map((rec, i) => {
        sumAnnualInr += rec.annualInr;
        sumAnnualCo2 += rec.annualCo2;
        const border =
          i === 0
            ? "border-amber-500/40 bg-gradient-to-br from-amber-950/30 to-surface/80 ring-1 ring-amber-500/25"
            : "border-border/90 bg-surface/70";
        return `
      <div class="rounded-xl border px-3 py-3 shadow-sm ${border}">
        <p class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">#${rec.wasteRank} highest waste · ${escapeHtml(rec.roomName)}</p>
        <p class="mt-1 text-sm font-semibold text-slate-100">${escapeHtml(rec.headline)}</p>
        <p class="mt-1 text-xs leading-relaxed text-slate-400">${escapeHtml(rec.body)}</p>
        <dl class="mt-2 grid grid-cols-2 gap-1 text-[11px]">
          <dt class="text-slate-500">Swap to</dt><dd class="text-right font-medium text-sky-200/90">${escapeHtml(rec.swapToName)}</dd>
          <dt class="text-slate-500">Saves / year</dt><dd class="text-right font-mono text-sky-300">${fmtMoney(rec.annualInr)}</dd>
          <dt class="text-slate-500">CO₂ / year</dt><dd class="text-right font-mono text-emerald-300/90">${fmtNum(rec.annualCo2, 0)} kg</dd>
        </dl>
      </div>`;
      })
      .join("");

    swapSaveDream.innerHTML = dreamLinesHtml(sumAnnualInr, sumAnnualCo2);
  }

  function optionKey(roomId, instanceId) {
    return `${roomId}:${instanceId}`;
  }

  function parseApplianceKey(key) {
    const i = key.indexOf(":");
    if (i < 0) return null;
    return { roomId: key.slice(0, i), instanceId: key.slice(i + 1) };
  }

  function findAppliance(state, roomId, instanceId) {
    const room = (state.rooms || []).find((r) => r.id === roomId);
    if (!room) return null;
    return (room.appliances || []).find((x) => x.instance_id === instanceId) || null;
  }

  function dailyKwhModified(a, reduceH, zeroSb) {
    const a2 = { ...a };
    if (reduceH > 0) {
      a2.active_hours_daily = Math.max(0, (Number(a.active_hours_daily) || 0) - reduceH);
    }
    if (zeroSb && a.standby_when_inactive !== false) {
      a2.standby_w = 0;
      a2.standby_hours_daily = 0;
    }
    return dailyKwh(a2);
  }

  function buildWhatIfTable(ctx) {
    if (!whatifTableBody) return;
    const { lastState, scope, rate } = ctx;
    whatifTableBody.innerHTML = "";
    if (!lastState) return;

    const rooms =
      scope === "home"
        ? lastState.rooms || []
        : (lastState.rooms || []).filter((r) => r.id === scope);

    const rowsHtml = [];
    for (const room of rooms) {
      for (const a of room.appliances || []) {
        const key = optionKey(room.id, a.instance_id);
        const ah = Number(a.active_hours_daily) || 0;
        const annualCost = dailyKwh(a) * DAYS_YEAR * rate;
        const subtitle = `${fmtNum(ah, 1)}h/day · ${fmtMoney(annualCost)}/yr`;
        const titleName = escapeHtml(a.name || "Appliance");
        const ariaName = String(a.name || "Appliance").replace(/"/g, "'");
        const roomLine =
          scope === "home"
            ? `<div class="text-[10px] text-slate-600">${escapeHtml(room.name)}</div>`
            : "";

        const maxR = Math.max(0, Math.min(24, ah));
        let controlHtml;
        if (maxR > 0) {
          controlHtml = `
            <input type="range" class="whatif-slider h-2 w-full max-w-[280px] cursor-pointer accent-sky-500" min="0" max="${maxR}" step="0.25" value="0" data-key="${key}" aria-label="Reduce active hours per day for ${ariaName}" />
            <div class="whatif-slider-hint mt-1 text-[11px] text-slate-600">drag to reduce</div>`;
        } else {
          controlHtml =
            '<span class="text-xs text-slate-600">No active hours — edit in Audit</span>';
        }

        rowsHtml.push(`
      <tr data-whatif-key="${key}" class="transition-colors hover:bg-white/[0.03]">
        <td class="px-3 py-3 align-top sm:px-4">
          <div class="font-medium text-slate-100">${titleName}</div>
          ${roomLine}
          <div class="mt-0.5 text-[11px] text-slate-500">${subtitle}</div>
        </td>
        <td class="px-2 py-3 align-middle">${controlHtml}</td>
        <td class="whatif-row-save px-3 py-3 text-right align-middle sm:px-4"><span class="text-slate-600">—</span></td>
      </tr>`);
      }
    }
    whatifTableBody.innerHTML = rowsHtml.join("");
  }

  function refreshWhatIfTotals(ctx) {
    if (!whatifTableBody) return;
    const { lastState, rate, co2KgPerKwh } = ctx;
    if (!lastState) return;

    let sumInr = 0;
    let sumCo2 = 0;

    whatifTableBody.querySelectorAll("input.whatif-slider").forEach((slider) => {
      const key = slider.dataset.key;
      const reduceH = parseFloat(slider.value) || 0;
      const parsed = parseApplianceKey(key);
      if (!parsed) return;
      const a = findAppliance(lastState, parsed.roomId, parsed.instanceId);
      if (!a) return;

      const base = dailyKwh(a);
      const newKwh = dailyKwhModified(a, reduceH, false);
      const deltaDay = Math.max(0, base - newKwh);
      const annualInr = deltaDay * DAYS_YEAR * rate;
      const annualCo2 = deltaDay * DAYS_YEAR * co2KgPerKwh;
      sumInr += annualInr;
      sumCo2 += annualCo2;

      const tr = slider.closest("tr");
      const cell = tr && tr.querySelector(".whatif-row-save");
      const hint = tr && tr.querySelector(".whatif-slider-hint");
      if (hint) {
        if (reduceH > 0) {
          hint.textContent = `−${fmtNum(reduceH, 2)}h/day`;
          hint.className = "whatif-slider-hint mt-1 text-[11px] font-medium text-emerald-400/90";
        } else {
          hint.textContent = "drag to reduce";
          hint.className = "whatif-slider-hint mt-1 text-[11px] text-slate-600";
        }
      }
      if (cell) {
        if (deltaDay <= 1e-12) {
          cell.innerHTML = '<span class="text-slate-600">—</span>';
        } else {
          cell.innerHTML = `<div class="font-semibold tabular-nums text-sky-300">~${fmtMoney(annualInr)}</div><div class="mt-0.5 text-[11px] tabular-nums text-emerald-300/85">−${fmtNum(annualCo2, 0)} kg CO₂</div>`;
        }
      }
    });

    if (whatifTotalInr) {
      whatifTotalInr.textContent = sumInr > 0 ? `~${fmtMoney(sumInr)}` : "—";
    }
    if (whatifTotalCo2) {
      whatifTotalCo2.textContent = sumCo2 > 0 ? `−${fmtNum(sumCo2, 0)} kg CO₂ / yr` : "";
    }
    if (whatifDream) {
      whatifDream.innerHTML = dreamLinesHtml(sumInr, sumCo2);
    }
  }

  function renderWhatIf(ctx) {
    if (!whatifSection) return;
    const { lastState, scope } = ctx;
    if (!lastState || !(lastState.rooms || []).some((r) => (r.appliances || []).length)) {
      whatifSection.classList.add("hidden");
      return;
    }
    whatifSection.classList.remove("hidden");

    const hasApp = (lastState.rooms || []).some((r) => {
      if (scope !== "home" && r.id !== scope) return false;
      return (r.appliances || []).length > 0;
    });
    if (whatifEmpty) whatifEmpty.classList.toggle("hidden", hasApp);
    if (whatifForm) whatifForm.classList.toggle("hidden", !hasApp);
    if (!hasApp) return;

    buildWhatIfTable(ctx);
    refreshWhatIfTotals(ctx);
  }

  function renderInsights() {
    const ctx =
      typeof window.phantomGetUsageContext === "function"
        ? window.phantomGetUsageContext()
        : null;
    if (!ctx) return;
    renderSwapSave(ctx);
    renderWhatIf(ctx);
  }

  function wireWhatIf() {
    whatifForm?.addEventListener("input", (e) => {
      const t = e.target;
      if (t && t.classList && t.classList.contains("whatif-slider")) {
        const c = typeof window.phantomGetUsageContext === "function" ? window.phantomGetUsageContext() : null;
        if (c) refreshWhatIfTotals(c);
      }
    });
  }

  window.phantomRenderInsights = renderInsights;
  wireWhatIf();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => renderInsights());
  } else {
    renderInsights();
  }
})();
