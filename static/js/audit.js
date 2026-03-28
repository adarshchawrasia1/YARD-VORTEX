(function () {
  const treeEl = document.getElementById("room-tree");
  const backdrop = document.getElementById("catalog-backdrop");
  const panel = document.getElementById("catalog-panel");
  const catalogTitle = document.getElementById("catalog-title");
  const catalogCategory = document.getElementById("catalog-category");
  const catalogVariant = document.getElementById("catalog-variant");
  const catalogContinueBtn = document.getElementById("catalog-continue-btn");
  const catalogStepList = document.getElementById("catalog-step-list");
  const catalogClose = document.getElementById("catalog-close");
  const catalogHint = document.querySelector("#catalog-hint span");
  const detailForm = document.getElementById("catalog-detail-form");
  const customNameRow = document.getElementById("custom-name-row");
  const customNameInput = document.getElementById("custom-name");
  const selectedLabel = document.getElementById("catalog-selected-label");
  const fieldActiveHours = document.getElementById("field-active-hours");
  const fieldStandbyHours = document.getElementById("field-standby-hours");
  const fieldActiveW = document.getElementById("field-active-w");
  const fieldStandbyW = document.getElementById("field-standby-w");
  const standbyWhenInactive = document.getElementById("standby-when-inactive");
  const catalogFormBack = document.getElementById("catalog-form-back");
  const homeAddRoom = document.getElementById("home-add-room");
  const roomBackdrop = document.getElementById("room-backdrop");
  const roomPanel = document.getElementById("room-panel");
  const roomClose = document.getElementById("room-close");
  const roomForm = document.getElementById("room-form");
  const roomNameInput = document.getElementById("room-name-input");
  const roomEditId = document.getElementById("room-edit-id");
  const roomSubmitBtn = document.getElementById("room-submit-btn");
  const roomPanelTitle = document.getElementById("room-panel-title");

  const editBackdrop = document.getElementById("edit-appliance-backdrop");
  const editPanel = document.getElementById("edit-appliance-panel");
  const editClose = document.getElementById("edit-appliance-close");
  const editForm = document.getElementById("edit-appliance-form");
  const editRoomId = document.getElementById("edit-appliance-room-id");
  const editInstanceId = document.getElementById("edit-appliance-instance-id");
  const editName = document.getElementById("edit-appliance-name");
  const editActiveH = document.getElementById("edit-active-hours");
  const editActiveW = document.getElementById("edit-active-w");
  const editStandbyToggle = document.getElementById("edit-standby-toggle");
  const editStandbyH = document.getElementById("edit-standby-hours");
  const editStandbyW = document.getElementById("edit-standby-w");
  const editStandbyBlock = document.getElementById("edit-standby-block");

  const ICON_PEN =
    '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>';
  const ICON_TRASH =
    '<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';

  let catalog = { categories: [] };
  let targetRoomId = null;
  /** @type {null | { id: string, name: string, default_active_w: number, default_standby_w: number }} */
  let pendingItem = null;

  async function fetchJSON(url, options) {
    const r = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options && options.headers) },
    });
    const text = await r.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(text || r.statusText);
    }
    if (!r.ok) throw new Error(data.error || text || r.statusText);
    return data;
  }

  function standbyEnabled(a) {
    return a.standby_when_inactive !== false;
  }

  function showCatalogListStep() {
    pendingItem = null;
    if (catalogTitle) catalogTitle.textContent = "Appliance catalog";
    catalogStepList.classList.remove("hidden");
    detailForm.classList.add("hidden");
    resetCatalogPicker();
  }

  function resetVariantDropdown() {
    if (!catalogVariant) return;
    catalogVariant.innerHTML = "";
    const opt0 = document.createElement("option");
    opt0.value = "";
    opt0.textContent = "Select category first…";
    catalogVariant.appendChild(opt0);
    catalogVariant.disabled = true;
    syncCatalogContinueButton();
  }

  function resetCatalogPicker() {
    if (catalogCategory) catalogCategory.value = "";
    resetVariantDropdown();
  }

  function syncCatalogContinueButton() {
    if (!catalogContinueBtn || !catalogCategory || !catalogVariant) return;
    const ok = Boolean(catalogCategory.value && catalogVariant.value);
    catalogContinueBtn.disabled = !ok;
  }

  function onCatalogCategoryChange() {
    if (!catalogCategory || !catalogVariant) return;
    const cid = catalogCategory.value;
    catalogVariant.innerHTML = "";
    if (!cid) {
      resetVariantDropdown();
      return;
    }
    const cat = (catalog.categories || []).find((c) => c.id === cid);
    if (!cat || !cat.items?.length) {
      resetVariantDropdown();
      return;
    }
    catalogVariant.disabled = false;
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "Select model / wattage…";
    catalogVariant.appendChild(ph);
    for (const it of cat.items) {
      const o = document.createElement("option");
      o.value = it.id;
      o.textContent = `${it.name} (${it.default_active_w} W)`;
      catalogVariant.appendChild(o);
    }
    if (cat.items.length === 1) {
      catalogVariant.value = cat.items[0].id;
    }
    syncCatalogContinueButton();
  }

  function buildCategoryDropdown() {
    if (!catalogCategory) return;
    catalogCategory.innerHTML = "";
    const ph = document.createElement("option");
    ph.value = "";
    ph.textContent = "Select category…";
    catalogCategory.appendChild(ph);
    for (const c of catalog.categories || []) {
      const o = document.createElement("option");
      o.value = c.id;
      o.textContent = c.name;
      catalogCategory.appendChild(o);
    }
    resetCatalogPicker();
  }

  function continueToUsageStep() {
    const cid = catalogCategory?.value;
    const vid = catalogVariant?.value;
    if (!cid || !vid) return;
    const cat = (catalog.categories || []).find((c) => c.id === cid);
    const item = cat?.items?.find((i) => i.id === vid);
    if (!item) return;
    showDetailStep(item, cat.name);
  }

  function syncCatalogStandby() {
    const on = standbyWhenInactive.checked;
    const block = document.getElementById("catalog-standby-block");
    block.classList.toggle("opacity-40", !on);
    block.classList.toggle("pointer-events-none", !on);
    fieldStandbyHours.disabled = !on;
    fieldStandbyW.disabled = !on;
  }

  function syncEditStandby() {
    const on = editStandbyToggle.checked;
    editStandbyBlock.classList.toggle("opacity-40", !on);
    editStandbyBlock.classList.toggle("pointer-events-none", !on);
    editStandbyH.disabled = !on;
    editStandbyW.disabled = !on;
  }

  function showDetailStep(item, categoryName) {
    pendingItem = item;
    if (catalogTitle) catalogTitle.textContent = "Usage & power";
    catalogStepList.classList.add("hidden");
    detailForm.classList.remove("hidden");
    selectedLabel.textContent = categoryName ? `${categoryName} › ${item.name}` : item.name;
    const isCustom = item.id === "custom";
    customNameRow.classList.toggle("hidden", !isCustom);
    customNameInput.value = isCustom ? "" : item.name;
    customNameInput.required = isCustom;
    fieldActiveHours.value = "";
    fieldStandbyHours.value = "";
    fieldActiveW.value = String(item.default_active_w);
    fieldStandbyW.value = String(item.default_standby_w);
    standbyWhenInactive.checked = true;
    syncCatalogStandby();
    fieldActiveHours.focus();
  }

  function openCatalog(roomId, roomName) {
    targetRoomId = roomId;
    if (catalogHint) catalogHint.textContent = roomName;
    backdrop.classList.remove("hidden");
    panel.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    showCatalogListStep();
    catalogClose.focus();
  }

  function closeCatalog() {
    targetRoomId = null;
    pendingItem = null;
    showCatalogListStep();
    backdrop.classList.add("hidden");
    panel.classList.add("hidden");
    if (!roomPanel.classList.contains("hidden") || !editPanel.classList.contains("hidden")) return;
    document.body.style.overflow = "";
  }

  function openAddRoom() {
    roomEditId.value = "";
    roomPanelTitle.textContent = "Add room";
    roomSubmitBtn.textContent = "Add room";
    roomBackdrop.classList.remove("hidden");
    roomPanel.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    roomNameInput.value = "";
    roomNameInput.focus();
  }

  function openEditRoom(room) {
    roomEditId.value = room.id;
    roomPanelTitle.textContent = "Rename room";
    roomSubmitBtn.textContent = "Save";
    roomBackdrop.classList.remove("hidden");
    roomPanel.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    roomNameInput.value = room.name;
    roomNameInput.focus();
  }

  function closeAddRoom() {
    roomBackdrop.classList.add("hidden");
    roomPanel.classList.add("hidden");
    roomEditId.value = "";
    roomPanelTitle.textContent = "Add room";
    roomSubmitBtn.textContent = "Add room";
    if (panel.classList.contains("hidden") && editPanel.classList.contains("hidden")) {
      document.body.style.overflow = "";
    }
  }

  function openEditAppliance(roomId, a) {
    editRoomId.value = roomId;
    editInstanceId.value = a.instance_id;
    editName.value = a.name;
    editActiveH.value = String(a.active_hours_daily ?? 0);
    editActiveW.value = String(a.active_w ?? 0);
    const st = standbyEnabled(a);
    editStandbyToggle.checked = st;
    editStandbyH.value = st ? String(a.standby_hours_daily ?? 0) : "";
    editStandbyW.value = st ? String(a.standby_w ?? 0) : "";
    syncEditStandby();
    editBackdrop.classList.remove("hidden");
    editPanel.classList.remove("hidden");
    document.body.style.overflow = "hidden";
    editName.focus();
  }

  function closeEditAppliance() {
    editBackdrop.classList.add("hidden");
    editPanel.classList.add("hidden");
    if (panel.classList.contains("hidden") && roomPanel.classList.contains("hidden")) {
      document.body.style.overflow = "";
    }
  }

  function anyModalOpen() {
    return (
      !panel.classList.contains("hidden") ||
      !roomPanel.classList.contains("hidden") ||
      !editPanel.classList.contains("hidden")
    );
  }

  function parseNonNeg(name, el) {
    const v = parseFloat(el.value);
    if (Number.isNaN(v) || v < 0) {
      el.focus();
      throw new Error(`${name} must be a number ≥ 0`);
    }
    return v;
  }

  async function submitDetailForm(e) {
    e.preventDefault();
    if (!targetRoomId || !pendingItem) return;
    try {
      const activeH = parseNonNeg("Active hours", fieldActiveHours);
      const activeW = parseNonNeg("Active power", fieldActiveW);
      const standbyOn = standbyWhenInactive.checked;
      let standbyH = 0;
      let standbyW = 0;
      if (standbyOn) {
        standbyH = parseNonNeg("Standby hours", fieldStandbyHours);
        standbyW = parseNonNeg("Standby power", fieldStandbyW);
      }

      const payload = {
        catalog_id: pendingItem.id,
        active_hours_daily: activeH,
        active_w: activeW,
        standby_when_inactive: standbyOn,
      };
      if (standbyOn) {
        payload.standby_hours_daily = standbyH;
        payload.standby_w = standbyW;
      }
      if (pendingItem.id === "custom") {
        const n = customNameInput.value.trim();
        if (!n) {
          customNameInput.focus();
          alert("Enter a name for your custom appliance.");
          return;
        }
        payload.name = n;
      }

      await fetchJSON(`/api/rooms/${encodeURIComponent(targetRoomId)}/appliances`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      closeCatalog();
      await loadState();
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not add appliance.");
    }
  }

  async function submitEditAppliance(e) {
    e.preventDefault();
    const roomId = editRoomId.value;
    const instId = editInstanceId.value;
    if (!roomId || !instId) return;
    try {
      const name = editName.value.trim();
      if (!name) {
        editName.focus();
        return;
      }
      const activeH = parseNonNeg("Active hours", editActiveH);
      const activeW = parseNonNeg("Active power", editActiveW);
      const standbyOn = editStandbyToggle.checked;
      let standbyH = 0;
      let standbyW = 0;
      if (standbyOn) {
        standbyH = parseNonNeg("Standby hours", editStandbyH);
        standbyW = parseNonNeg("Standby power", editStandbyW);
      }
      const payload = {
        name,
        active_hours_daily: activeH,
        active_w: activeW,
        standby_when_inactive: standbyOn,
      };
      if (standbyOn) {
        payload.standby_hours_daily = standbyH;
        payload.standby_w = standbyW;
      }
      await fetchJSON(
        `/api/rooms/${encodeURIComponent(roomId)}/appliances/${encodeURIComponent(instId)}`,
        { method: "PUT", body: JSON.stringify(payload) }
      );
      closeEditAppliance();
      await loadState();
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not save appliance.");
    }
  }

  function escapeHtml(s) {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }

  function fmtNum(n) {
    if (n == null || Number.isNaN(Number(n))) return "-";
    const x = Number(n);
    if (Math.abs(x - Math.round(x)) < 1e-9) return String(Math.round(x));
    return String(Math.round(x * 100) / 100);
  }

  function fmtAudit(a, field) {
    if (!standbyEnabled(a) && (field === "sw" || field === "sh")) return "-";
    if (field === "sw") return fmtNum(a.standby_w);
    if (field === "sh") return fmtNum(a.standby_hours_daily);
    if (field === "aw") return fmtNum(a.active_w);
    if (field === "ah") return fmtNum(a.active_hours_daily);
    return "-";
  }

  function renderTree(state) {
    treeEl.innerHTML = "";
    for (const room of state.rooms) {
      const wrap = document.createElement("details");
      wrap.className = "group/room";
      wrap.open = true;

      const summary = document.createElement("summary");
      summary.className =
        "flex w-full cursor-pointer list-none items-center gap-2 text-slate-200 [&::-webkit-details-marker]:hidden";

      const chevron = document.createElement("span");
      chevron.className = "text-slate-500 transition group-open/room:rotate-90 shrink-0";
      chevron.textContent = "▸";

      const nameSpan = document.createElement("span");
      nameSpan.className = "font-medium min-w-0 flex-1 truncate";
      nameSpan.textContent = room.name;

      const actions = document.createElement("div");
      actions.className = "ml-auto flex shrink-0 items-center gap-0.5";

      const btnEditRoom = document.createElement("button");
      btnEditRoom.type = "button";
      btnEditRoom.className =
        "rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-sky-400";
      btnEditRoom.title = "Rename room";
      btnEditRoom.setAttribute("aria-label", "Rename room");
      btnEditRoom.innerHTML = ICON_PEN;
      btnEditRoom.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openEditRoom(room);
      });

      const btnDelRoom = document.createElement("button");
      btnDelRoom.type = "button";
      btnDelRoom.className =
        "rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-rose-400";
      btnDelRoom.title = "Delete room";
      btnDelRoom.setAttribute("aria-label", "Delete room");
      btnDelRoom.innerHTML = ICON_TRASH;
      btnDelRoom.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const n = room.appliances?.length || 0;
        const msg =
          n > 0
            ? `Delete room “${room.name}” and all ${n} appliance(s) inside it? This cannot be undone.`
            : `Delete room “${room.name}”? This cannot be undone.`;
        if (!confirm(msg)) return;
        deleteRoom(room.id);
      });

      const addBtn = document.createElement("button");
      addBtn.type = "button";
      addBtn.className =
        "rounded-md border border-border px-2 py-0.5 text-xs font-medium text-accent hover:bg-sky-500/10";
      addBtn.textContent = "+";
      addBtn.title = "Add appliance from catalog";
      addBtn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openCatalog(room.id, room.name);
      });

      actions.append(btnEditRoom, btnDelRoom, addBtn);
      summary.append(chevron, nameSpan, actions);

      const inner = document.createElement("div");
      inner.className = "mt-2 space-y-2 border-l border-border pl-3 ml-2";

      if (!room.appliances.length) {
        const empty = document.createElement("p");
        empty.className = "text-sm text-slate-500 py-1";
        empty.textContent = "No appliances yet — use + to pick from the catalog.";
        inner.appendChild(empty);
      } else {
        for (const a of room.appliances) {
          inner.appendChild(applianceCard(room.id, a));
        }
      }

      wrap.appendChild(summary);
      wrap.appendChild(inner);
      treeEl.appendChild(wrap);
    }
  }

  function applianceCard(roomId, a) {
    const wrap = document.createElement("div");
    wrap.className =
      "flex gap-2 rounded-lg border border-border bg-surface/80 px-3 py-2 text-sm text-slate-300";

    const main = document.createElement("div");
    main.className = "min-w-0 flex-1";
    main.innerHTML = `
      <div class="font-medium text-slate-100">${escapeHtml(a.name)}</div>
      <div class="mt-1 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-slate-500">
        <span>Active: <span class="text-slate-300">${fmtAudit(a, "aw")}</span> W</span>
        <span>Standby: <span class="text-slate-300">${fmtAudit(a, "sw")}</span> W</span>
        <span>Active h/day: <span class="text-slate-300">${fmtAudit(a, "ah")}</span></span>
        <span>Standby h/day: <span class="text-slate-300">${fmtAudit(a, "sh")}</span></span>
      </div>`;

    const actions = document.createElement("div");
    actions.className = "flex shrink-0 flex-col gap-1";

    const btnEdit = document.createElement("button");
    btnEdit.type = "button";
    btnEdit.className =
      "rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-sky-400";
    btnEdit.title = "Edit appliance";
    btnEdit.setAttribute("aria-label", "Edit appliance");
    btnEdit.innerHTML = ICON_PEN;
    btnEdit.addEventListener("click", () => openEditAppliance(roomId, a));

    const btnDel = document.createElement("button");
    btnDel.type = "button";
    btnDel.className =
      "rounded-md p-1.5 text-slate-500 hover:bg-white/10 hover:text-rose-400";
    btnDel.title = "Remove appliance";
    btnDel.setAttribute("aria-label", "Remove appliance");
    btnDel.innerHTML = ICON_TRASH;
    btnDel.addEventListener("click", () => {
      if (!confirm(`Remove “${a.name}” from this room?`)) return;
      deleteAppliance(roomId, a.instance_id);
    });

    actions.append(btnEdit, btnDel);
    wrap.append(main, actions);
    return wrap;
  }

  async function deleteRoom(roomId) {
    try {
      await fetchJSON(`/api/rooms/${encodeURIComponent(roomId)}`, { method: "DELETE" });
      await loadState();
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not delete room.");
    }
  }

  async function deleteAppliance(roomId, instanceId) {
    try {
      await fetchJSON(
        `/api/rooms/${encodeURIComponent(roomId)}/appliances/${encodeURIComponent(instanceId)}`,
        { method: "DELETE" }
      );
      await loadState();
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not remove appliance.");
    }
  }

  async function loadState() {
    const state = await fetchJSON("/api/state");
    renderTree(state);
    if (targetRoomId && catalogHint) {
      const r = state.rooms.find((x) => x.id === targetRoomId);
      if (r) catalogHint.textContent = r.name;
    }
    window.dispatchEvent(new CustomEvent("phantom-state-changed", { detail: { state } }));
    if (typeof window.phantomOnStateUpdated === "function") {
      window.phantomOnStateUpdated(state);
    }
  }

  async function submitRoomForm(e) {
    e.preventDefault();
    const name = roomNameInput.value.trim();
    if (!name) {
      roomNameInput.focus();
      return;
    }
    try {
      const editId = roomEditId.value.trim();
      if (editId) {
        await fetchJSON(`/api/rooms/${encodeURIComponent(editId)}`, {
          method: "PUT",
          body: JSON.stringify({ name }),
        });
      } else {
        await fetchJSON("/api/rooms", {
          method: "POST",
          body: JSON.stringify({ name }),
        });
      }
      closeAddRoom();
      await loadState();
    } catch (err) {
      console.error(err);
      alert(err.message || "Could not save room.");
    }
  }

  async function init() {
    catalog = await fetchJSON("/api/catalog");
    buildCategoryDropdown();
    await loadState();
  }

  if (homeAddRoom) {
    homeAddRoom.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      openAddRoom();
    });
  }

  if (catalogCategory) {
    catalogCategory.addEventListener("change", onCatalogCategoryChange);
  }
  if (catalogVariant) {
    catalogVariant.addEventListener("change", syncCatalogContinueButton);
  }
  if (catalogContinueBtn) {
    catalogContinueBtn.addEventListener("click", continueToUsageStep);
  }
  if (standbyWhenInactive) {
    standbyWhenInactive.addEventListener("change", syncCatalogStandby);
  }
  if (editStandbyToggle) {
    editStandbyToggle.addEventListener("change", syncEditStandby);
  }

  backdrop.addEventListener("click", closeCatalog);
  catalogClose.addEventListener("click", closeCatalog);
  roomBackdrop.addEventListener("click", closeAddRoom);
  roomClose.addEventListener("click", closeAddRoom);
  editBackdrop.addEventListener("click", closeEditAppliance);
  editClose.addEventListener("click", closeEditAppliance);
  roomForm.addEventListener("submit", submitRoomForm);
  editForm.addEventListener("submit", submitEditAppliance);
  catalogFormBack.addEventListener("click", () => {
    if (!targetRoomId) return;
    showCatalogListStep();
  });
  detailForm.addEventListener("submit", submitDetailForm);
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape" || !anyModalOpen()) return;
    if (!editPanel.classList.contains("hidden")) closeEditAppliance();
    else if (!roomPanel.classList.contains("hidden")) closeAddRoom();
    else closeCatalog();
  });

  init().catch(console.error);
})();
