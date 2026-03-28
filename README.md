# Phantom Load — Home Energy Waste Finder

**PS 2.1 | Astitva Hackathon**

---

## Tech stack

| Layer | Stack |
|--------|--------|
| Backend | Python 3, **Flask**, JSON files (`data/catalog.json`, `data/store.json`) |
| Frontend | HTML, **Tailwind CSS** (CDN), **Chart.js** (CDN), vanilla JS — no build step |
| Run | `python app.py` → `http://127.0.0.1:5000` |

---

## Setup

```bash
pip install -r requirements.txt
python app.py
```

Open **http://127.0.0.1:5000** (or http://localhost:5000).

---

## What the app does today

- **Header navigation:** The **hamburger (top right)** opens a panel listing main sections — **Audit Usage**, **Usage & Power**, **Swap & Save**, and **What If**. Choosing one **smooth-scrolls** to that block on the same page and **closes** the menu (also closes on backdrop tap, the close control, or **Esc**).
- **Audit Usage tree:** `Home` → rooms (add/remove/rename) → appliances per room.
- **Catalog:** Two-step picker — **category** (e.g. Bulb, TV) then **model / wattage** variant. **Custom appliance** uses a free-form name and default wattage hints.
- **Usage & power (per add):** Daily **active hours**, **active power (W)**, optional **standby when inactive**; if standby applies, **standby hours/day** and **standby power (W)**. If standby is off, the audit shows **–** for standby fields.
- **Edit:** Pencil icons on rooms and appliances; trash deletes with a confirmation.
- **Usage & Power:** Pie chart of **daily kWh** by **catalog category**; **category labels** are listed **under** the chart (color swatch + name + share %); Chart.js tooltips still show **₹** and **CO₂** for the selected period. **Tariff (₹/kWh)** and **regional grid** (kg CO₂/kWh from `data/emission_regions.json`) with **Save settings**. **Totals** (energy, cost, CO₂ for day / month / year) and a **per-appliance** breakdown for the current scope.
- **Swap & Save:** For high-waste devices, suggests **same-category** catalog alternatives with modeled **annual ₹ and CO₂** savings. Includes a **“you will be able to buy…”** block with example purchase timelines from combined swap savings.
- **What If:** Per-appliance sliders to model **reduction in active hours/day**; shows combined annual savings and the same style **dream purchase** callout from the scenario total.

Data persists in **`data/store.json`**. The catalog is edited in **`data/catalog.json`** (nested `categories` → `items` with `id`, `name`, `default_active_w`, `default_standby_w`).

---

## API (Flask)

| Method | Endpoint | Description |
|--------|----------|---------------|
| GET | `/` | Web UI |
| GET | `/api/catalog` | Hierarchical appliance catalog |
| GET | `/api/state` | All rooms and appliances |
| GET | `/api/settings` | Tariff + region + emission options |
| PUT | `/api/settings` | `{ "rate_inr_per_kwh", "region_id" }` |
| POST | `/api/rooms` | Create room `{ "name" }` |
| PUT | `/api/rooms/<room_id>` | Rename room `{ "name" }` |
| DELETE | `/api/rooms/<room_id>` | Delete room and its appliances |
| POST | `/api/rooms/<room_id>/appliances` | Add appliance from catalog `{ "catalog_id", "active_hours_daily", "active_w", "standby_when_inactive", … }` |
| PUT | `/api/rooms/<room_id>/appliances/<instance_id>` | Update appliance |
| DELETE | `/api/rooms/<room_id>/appliances/<instance_id>` | Remove appliance |

---

## Energy, cost, CO₂

**Daily kWh** per appliance ≈ (active W × active h/day + standby W × standby h/day) / 1000 when standby applies; otherwise active term only.

**Cost** = kWh × **₹/kWh** (saved in `data/settings.json`). **CO₂** = kWh × **kg CO₂/kWh** for the selected region (`data/emission_regions.json`). Month uses **365/12** days; year uses **365** days.

---

## Project layout

```
.
├── app.py              # Flask server + routes
├── requirements.txt
├── data/
│   ├── catalog.json
│   ├── store.json
│   ├── settings.json       # Tariff + region_id
│   └── emission_regions.json
├── templates/
│   └── index.html          # layout, section anchors, nav drawer, Chart.js
└── static/
    └── js/
        ├── audit.js
        ├── usage-power.js      # pie chart + HTML legend under chart
        └── swap-whatif.js      # Swap & Save + What If + dream purchase copy
```
