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
- **Usage & Power:** Pie chart of **estimated daily kWh** by **catalog category** (Bulb, TV, etc.). Scope dropdown: **Home (entire house)** or a single room. Uses the same daily model as the audit: active W×h + standby W×h when standby applies.

Data persists in **`data/store.json`**. The catalog is edited in **`data/catalog.json`** (nested `categories` → `items` with `id`, `name`, `default_active_w`, `default_standby_w`).

---

## API (Flask)

| Method | Endpoint | Description |
|--------|----------|---------------|
| GET | `/` | Web UI |
| GET | `/api/catalog` | Hierarchical appliance catalog |
| GET | `/api/state` | All rooms and appliances |
| POST | `/api/rooms` | Create room `{ "name" }` |
| PUT | `/api/rooms/<room_id>` | Rename room `{ "name" }` |
| DELETE | `/api/rooms/<room_id>` | Delete room and its appliances |
| POST | `/api/rooms/<room_id>/appliances` | Add appliance from catalog `{ "catalog_id", "active_hours_daily", "active_w", "standby_when_inactive", … }` |
| PUT | `/api/rooms/<room_id>/appliances/<instance_id>` | Update appliance |
| DELETE | `/api/rooms/<room_id>/appliances/<instance_id>` | Remove appliance |

---

## Energy math (reference)

When you add **cost / CO₂ / waste score** features, a typical daily energy model is:

**Daily kWh** ≈ (active_w × active_hours_daily + standby_w × standby_hours_daily) / 1000  

(Only include the standby term when **standby when inactive** applies; otherwise standby draw is not counted.)

Optional extensions mentioned in earlier specs: **₹/kWh**, **CO₂** (e.g. India grid factor ~0.82 kg/kWh), **waste score**, **what-if simulator** — wire these to new routes and UI when you implement them.

---

## Project layout

```
phantom/
├── app.py              # Flask server + routes
├── requirements.txt
├── data/
│   ├── catalog.json    # Categories → appliance variants
│   └── store.json      # User rooms + appliance instances
├── templates/
│   └── index.html
└── static/
    └── js/
        ├── audit.js
        └── usage-power.js   # pie chart (Chart.js CDN)
```
