"""
Phantom Load — minimal Flask API + static UI (catalog + room tree).
"""
from __future__ import annotations

import json
import re
import uuid
from pathlib import Path

from flask import Flask, jsonify, render_template, request

ROOT = Path(__file__).resolve().parent
DATA = ROOT / "data"
CATALOG_PATH = DATA / "catalog.json"
STORE_PATH = DATA / "store.json"

app = Flask(__name__)


def _read_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def _load_catalog() -> dict:
    return _read_json(CATALOG_PATH)


def _find_catalog_item(catalog: dict, catalog_id: str) -> dict | None:
    for cat in catalog.get("categories") or []:
        for it in cat.get("items") or []:
            if it.get("id") == catalog_id:
                return it
    for it in catalog.get("items") or []:
        if it.get("id") == catalog_id:
            return it
    return None


def _load_store() -> dict:
    return _read_json(STORE_PATH)


def _save_store(store: dict) -> None:
    _write_json(STORE_PATH, store)


@app.route("/")
def index():
    return render_template("index.html")


@app.get("/api/catalog")
def api_catalog():
    return jsonify(_load_catalog())


@app.get("/api/state")
def api_state():
    return jsonify(_load_store())


def _room_id_from_name(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "_", name.strip().lower())
    s = s.strip("_") or "room"
    return s[:48]


@app.post("/api/rooms")
def api_add_room():
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    if len(name) > 120:
        return jsonify({"error": "name too long"}), 400

    store = _load_store()
    existing = {r["id"] for r in store["rooms"]}
    base = _room_id_from_name(name)
    room_id = base
    suffix = 1
    while room_id in existing:
        suffix += 1
        room_id = f"{base}_{suffix}"[:48]

    room = {"id": room_id, "name": name, "appliances": []}
    store["rooms"].append(room)
    _save_store(store)
    return jsonify({"room": room, "rooms": store["rooms"]})


@app.put("/api/rooms/<room_id>")
def api_rename_room(room_id: str):
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    if len(name) > 120:
        return jsonify({"error": "name too long"}), 400

    store = _load_store()
    room = next((r for r in store["rooms"] if r["id"] == room_id), None)
    if not room:
        return jsonify({"error": "unknown room"}), 404
    room["name"] = name
    _save_store(store)
    return jsonify({"room": room, "rooms": store["rooms"]})


@app.delete("/api/rooms/<room_id>")
def api_delete_room(room_id: str):
    store = _load_store()
    idx = next((i for i, r in enumerate(store["rooms"]) if r["id"] == room_id), None)
    if idx is None:
        return jsonify({"error": "unknown room"}), 404
    store["rooms"].pop(idx)
    _save_store(store)
    return jsonify({"rooms": store["rooms"]})


def _as_float(value, field: str):
    if value is None:
        return None, f"{field} required"
    try:
        n = float(value)
    except (TypeError, ValueError):
        return None, f"{field} must be a number"
    if n < 0:
        return None, f"{field} must be >= 0"
    return n, None


def _truthy_standby(body: dict) -> bool:
    v = body.get("standby_when_inactive")
    if v is None:
        return True
    if isinstance(v, bool):
        return v
    if isinstance(v, str):
        return v.lower() in ("1", "true", "yes", "on")
    return bool(v)


def _build_appliance_instance(
    item: dict,
    name: str,
    ah: float,
    aw: float,
    standby_on: bool,
    sh: float | None,
    sw: float | None,
) -> dict:
    inst = {
        "instance_id": str(uuid.uuid4()),
        "catalog_id": item["id"],
        "name": name,
        "active_w": aw,
        "active_hours_daily": ah,
        "standby_when_inactive": standby_on,
    }
    if standby_on:
        inst["standby_w"] = sw
        inst["standby_hours_daily"] = sh
    else:
        inst["standby_w"] = None
        inst["standby_hours_daily"] = None
    return inst


@app.post("/api/rooms/<room_id>/appliances")
def api_add_appliance(room_id: str):
    body = request.get_json(silent=True) or {}
    catalog_id = body.get("catalog_id")
    if not catalog_id:
        return jsonify({"error": "catalog_id required"}), 400

    catalog = _load_catalog()
    item = _find_catalog_item(catalog, catalog_id)
    if not item:
        return jsonify({"error": "unknown catalog_id"}), 404

    standby_on = _truthy_standby(body)

    ah, err = _as_float(body.get("active_hours_daily"), "active_hours_daily")
    if err:
        return jsonify({"error": err}), 400
    aw, err = _as_float(body.get("active_w"), "active_w")
    if err:
        return jsonify({"error": err}), 400

    sh = sw = None
    if standby_on:
        sh, err = _as_float(body.get("standby_hours_daily"), "standby_hours_daily")
        if err:
            return jsonify({"error": err}), 400
        sw, err = _as_float(body.get("standby_w"), "standby_w")
        if err:
            return jsonify({"error": err}), 400

    if item["id"] == "custom":
        name = (body.get("name") or "").strip()
        if not name:
            return jsonify({"error": "name required for custom appliance"}), 400
        if len(name) > 120:
            return jsonify({"error": "name too long"}), 400
    else:
        name = item["name"]

    store = _load_store()
    room = next((r for r in store["rooms"] if r["id"] == room_id), None)
    if not room:
        return jsonify({"error": "unknown room"}), 404

    instance = _build_appliance_instance(item, name, ah, aw, standby_on, sh, sw)
    room["appliances"].append(instance)
    _save_store(store)
    return jsonify({"room": room, "added": instance})


def _find_appliance(store: dict, room_id: str, instance_id: str):
    room = next((r for r in store["rooms"] if r["id"] == room_id), None)
    if not room:
        return None, None, None
    idx = next((i for i, a in enumerate(room["appliances"]) if a["instance_id"] == instance_id), None)
    if idx is None:
        return room, None, None
    return room, idx, room["appliances"][idx]


@app.put("/api/rooms/<room_id>/appliances/<instance_id>")
def api_update_appliance(room_id: str, instance_id: str):
    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()
    if not name:
        return jsonify({"error": "name required"}), 400
    if len(name) > 120:
        return jsonify({"error": "name too long"}), 400

    standby_on = _truthy_standby(body)
    ah, err = _as_float(body.get("active_hours_daily"), "active_hours_daily")
    if err:
        return jsonify({"error": err}), 400
    aw, err = _as_float(body.get("active_w"), "active_w")
    if err:
        return jsonify({"error": err}), 400

    sh = sw = None
    if standby_on:
        sh, err = _as_float(body.get("standby_hours_daily"), "standby_hours_daily")
        if err:
            return jsonify({"error": err}), 400
        sw, err = _as_float(body.get("standby_w"), "standby_w")
        if err:
            return jsonify({"error": err}), 400

    store = _load_store()
    room, _idx, app = _find_appliance(store, room_id, instance_id)
    if not room or app is None:
        return jsonify({"error": "unknown appliance"}), 404

    app["name"] = name
    app["active_hours_daily"] = ah
    app["active_w"] = aw
    app["standby_when_inactive"] = standby_on
    if standby_on:
        app["standby_hours_daily"] = sh
        app["standby_w"] = sw
    else:
        app["standby_hours_daily"] = None
        app["standby_w"] = None

    _save_store(store)
    return jsonify({"room": room, "appliance": app})


@app.delete("/api/rooms/<room_id>/appliances/<instance_id>")
def api_delete_appliance(room_id: str, instance_id: str):
    store = _load_store()
    room, idx, _app = _find_appliance(store, room_id, instance_id)
    if not room or idx is None:
        return jsonify({"error": "unknown appliance"}), 404
    room["appliances"].pop(idx)
    _save_store(store)
    return jsonify({"room": room})


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=True)
