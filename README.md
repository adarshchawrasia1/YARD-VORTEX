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

- **Audit Usage tree:** `Home` → rooms (add/remove/rename) → appliances per room.
- **Catalog:** Two-step picker — **category** (e.g. Bulb, TV) then **model / wattage** variant. **Custom appliance** uses a free-form name and default wattage hints.
- **Usage & power (per add):** Daily **active hours**, **active power (W)**, optional **standby when inactive**; if standby applies, **standby hours/day** and **standby power (W)**. If standby is off, the audit shows **–** for standby fields.
- **Edit:** Pencil icons on rooms and appliances; trash deletes with a confirmation.
- **Usage & Power:** Pie chart of **daily kWh** by **catalog category**; tooltips include **₹/day** and **CO₂** (from your tariff and region). **Tariff (₹/kWh)** and **regional grid** (kg CO₂/kWh from `data/emission_regions.json`) with **Save settings**. **Totals** (energy, cost, CO₂ for day / month / year) and a **per-appliance** table for the current scope.

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
phantom/
├── app.py              # Flask server + routes
├── requirements.txt
├── data/
│   ├── catalog.json
│   ├── store.json
│   ├── settings.json       # Tariff + region_id
│   └── emission_regions.json
├── templates/
│   └── index.html
└── static/
    └── js/
        ├── audit.js
        └── usage-power.js   # pie chart (Chart.js CDN)
```
