import os
from datetime import datetime
from flask import Flask, jsonify, request, send_from_directory
import requests

app = Flask(__name__)

# Never hard-code keys. Set these as Cloud Run environment variables.
LTA_ACCOUNT_KEY = os.environ.get("LTA_ACCOUNT_KEY", "").strip()
ONEMAP_TOKEN = os.environ.get("ONEMAP_TOKEN", "").strip()

LTA_BASE = "https://datamall2.mytransport.sg/ltaodataservice"

PROFILE = {
    "name": "Rachel",
    "origin": "Tampines",
    "destination": "Raffles Place",
    "leave_time": "07:40",
    "deadline": "08:45",
}

STATION_NAMES = {
    "EW2": "Tampines",
    "EW3": "Simei",
    "EW4": "Tanah Merah",
    "EW5": "Bedok",
    "EW6": "Kembangan",
    "EW7": "Eunos",
    "EW8": "Paya Lebar",
    "EW9": "Aljunied",
    "EW10": "Kallang",
    "EW11": "Lavender",
    "EW12": "Bugis",
    "EW13": "City Hall",
    "EW14": "Raffles Place",
}

CROWD_LABELS = {
    "l": "Low",
    "m": "Moderate",
    "h": "High",
    "na": "Unknown",
}

CROWD_SCORE = {
    "Low": 0,
    "Moderate": 1,
    "High": 2,
    "Unknown": 3,
}

def minutes(hhmm):
    hour, minute = map(int, hhmm.split(":"))
    return hour * 60 + minute

def add_deadline_info(route):
    delta = minutes(PROFILE["deadline"]) - minutes(route["eta"])
    route["deadline_delta_min"] = delta
    route["safe"] = delta >= 0
    route["deadline_text"] = f"{delta} min early" if delta >= 0 else f"{abs(delta)} min late"
    return route

def route_score(route):
    # Rachel's priority:
    # 1) arrive by 08:45,
    # 2) earlier arrival,
    # 3) lower crowding,
    # 4) fewer transfers.
    return (
        0 if route["safe"] else 1,
        minutes(route["eta"]),
        CROWD_SCORE.get(route["crowding"], 9),
        route["transfers"],
    )

def choose_best(routes):
    return min(routes, key=route_score)

def lta_get(endpoint, params=None):
    if not LTA_ACCOUNT_KEY:
        raise RuntimeError("LTA_ACCOUNT_KEY is not configured")

    response = requests.get(
        f"{LTA_BASE}/{endpoint}",
        headers={
            "AccountKey": LTA_ACCOUNT_KEY,
            "accept": "application/json",
        },
        params=params or {},
        timeout=8,
    )
    response.raise_for_status()
    return response.json()

def live_ewl_alert():
    """
    Returns a simplified EWL disruption object.
    If the live API is unavailable, returns None and the app can continue
    using the hackathon demo scenario.
    """
    if not LTA_ACCOUNT_KEY:
        return None

    try:
        data = lta_get("TrainServiceAlerts")
        records = data.get("value", data)

        if isinstance(records, dict):
            records = [records]
        if not isinstance(records, list):
            return None

        for item in records:
            line = str(item.get("Line", "")).upper()
            status = str(item.get("Status", "1"))

            if line == "EWL" and status == "2":
                raw = item.get("Stations", [])
                if isinstance(raw, str):
                    codes = [x.strip() for x in raw.replace(";", ",").split(",") if x.strip()]
                elif isinstance(raw, list):
                    codes = [str(x).strip() for x in raw]
                else:
                    codes = []

                names = [STATION_NAMES[c] for c in codes if c in STATION_NAMES]
                if names:
                    return {
                        "active": True,
                        "from": names[0],
                        "to": names[-1],
                        "source": "LTA DataMall",
                    }

                return {
                    "active": True,
                    "from": "EWL",
                    "to": "EWL",
                    "source": "LTA DataMall",
                }

        return {
            "active": False,
            "from": None,
            "to": None,
            "source": "LTA DataMall",
        }
    except Exception as exc:
        app.logger.warning("LTA alert lookup failed: %s", exc)
        return None

def live_ewl_crowding():
    """
    Returns crowding by EWL station code when an LTA key is configured.
    """
    if not LTA_ACCOUNT_KEY:
        return {}

    try:
        data = lta_get("PCDRealTime", {"TrainLine": "EWL"})
        records = data.get("value", data)

        if isinstance(records, dict):
            records = [records]
        if not isinstance(records, list):
            return {}

        result = {}
        for item in records:
            station = str(item.get("Station", "")).upper()
            crowd = str(item.get("CrowdLevel", "NA")).lower()
            if station:
                result[station] = CROWD_LABELS.get(crowd, "Unknown")
        return result
    except Exception as exc:
        app.logger.warning("LTA crowding lookup failed: %s", exc)
        return {}

def scenario_routes(disrupted=False, crowding=None):
    crowding = crowding or {}

    usual_crowd = crowding.get("EW2", "High" if disrupted else "Moderate")

    usual = add_deadline_info({
        "id": "usual",
        "label": "Rachel's usual route",
        "path_forward": "Home → 6 min walk → Tampines MRT → EWL → Raffles Place MRT → 5 min walk → Office",
        "path_reverse": "Office → 5 min walk → Raffles Place MRT → EWL → Tampines MRT → 6 min walk → Home",
        "eta": "08:54" if disrupted else "08:34",
        "delay_min": 20 if disrupted else 0,
        "crowding": usual_crowd,
        "transfers": 0,
    })

    if not disrupted:
        return [usual]

    recommended = add_deadline_info({
        "id": "recommended",
        "label": "Best alternative",
        "path_forward": "Home → 6 min walk → Tampines DTL → Bugis → EWL → Raffles Place MRT → 5 min walk → Office",
        "path_reverse": "Office → 5 min walk → Raffles Place MRT → EWL → Bugis → DTL → Tampines → 6 min walk → Home",
        "eta": "08:39",
        "delay_min": 5,
        "crowding": "Moderate",
        "transfers": 1,
    })

    backup = add_deadline_info({
        "id": "backup",
        "label": "Backup alternative",
        "path_forward": "Home → 6 min walk → Tampines DTL → Downtown → walk to Office",
        "path_reverse": "Office → walk to Downtown → DTL → Tampines → 6 min walk → Home",
        "eta": "08:43",
        "delay_min": 9,
        "crowding": "Low",
        "transfers": 0,
    })

    return [usual, recommended, backup]

def build_commute(scenario):
    crowding = {}

    if scenario == "live":
        alert = live_ewl_alert()
        crowding = live_ewl_crowding()

        if alert is None:
            # Live key/API unavailable: keep the app usable and be transparent.
            disruption = {
                "active": False,
                "from": None,
                "to": None,
                "source": "fallback",
            }
        else:
            disruption = alert
    elif scenario == "disruption":
        disruption = {
            "active": True,
            "from": "Tanah Merah",
            "to": "Aljunied",
            "source": "demo",
        }
    else:
        disruption = {
            "active": False,
            "from": None,
            "to": None,
            "source": "demo",
        }

    routes = scenario_routes(disrupted=disruption["active"], crowding=crowding)
    best = choose_best(routes)

    # Rachel is interrupted only if her usual route is expected to miss 08:45.
    notify = not routes[0]["safe"]

    if notify:
        action = (
            f"EWL disruption will make you late — take the alternative route. "
            f"ETA {best['eta']}."
        )
        headline = "Action needed"
    else:
        action = "No action needed — leave at 07:40 as usual."
        headline = "Your commute looks normal"

    return {
        "profile": PROFILE,
        "scenario": scenario,
        "headline": headline,
        "notify": notify,
        "one_line_action": action,
        "disruption": disruption,
        "routes": routes,
        "recommended": best,
        "backend": {
            "lta_key_configured": bool(LTA_ACCOUNT_KEY),
            "onemap_token_configured": bool(ONEMAP_TOKEN),
            "generated_at": datetime.utcnow().isoformat() + "Z",
        },
    }

@app.get("/")
def index():
    return send_from_directory(".", "index.html")

@app.get("/health")
def health():
    return jsonify({
        "status": "ok",
        "service": "rachel-commuter-backend",
    })

@app.get("/api/commute")
def commute():
    scenario = request.args.get("scenario", "normal").lower()
    if scenario not in {"normal", "disruption", "live"}:
        scenario = "normal"

    # Direction is accepted so the frontend/backend contract is ready for
    # future direction-specific routing. Current demo times are the same.
    direction = request.args.get("direction", "forward").lower()

    data = build_commute(scenario)
    data["direction"] = direction
    return jsonify(data)

@app.get("/api/backend-status")
def backend_status():
    return jsonify({
        "lta_account_key": "configured" if LTA_ACCOUNT_KEY else "not configured",
        "onemap_token": "configured" if ONEMAP_TOKEN else "not configured",
        "mode": "live-capable" if LTA_ACCOUNT_KEY else "demo",
    })

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    app.run(host="0.0.0.0", port=port, debug=False)
