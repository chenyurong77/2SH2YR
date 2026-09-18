from fastapi import FastAPI
from fastapi.responses import FileResponse

from commuter import (
    get_recommendation,
    get_journey_summary
)


# ============================================================
# ayAhead Smart Commuter Companion
# FastAPI Backend
# ============================================================

app = FastAPI(
    title="ayAhead Smart Commuter Companion",
    description="Smart commuter decision engine for Singapore",
    version="1.0"
)


# ============================================================
# Rachel's commute
# ============================================================

COMMUTER = {
    "name": "Rachel",

    "origin": "Tampines",

    "destination": "Raffles Place",

    "usual_departure": "07:40",

    "required_arrival": "08:45",

    "alert_threshold": 5
}


# ============================================================
# Demo routes
#
# Coordinates are approximate demo coordinates for visualisation.
# In the final hackathon version, these can be replaced with
# OneMap / OSM route geometry.
# ============================================================

ROUTES = [

    {
        "id": "usual",

        "name": "Usual route via EWL",

        "uses_lines": [
            "EWL"
        ],

        "base_time": 47,

        "transfers": 0,

        "description": (
            "Rachel's normal weekday journey "
            "from Tampines to Raffles Place."
        ),

        "coordinates": [
            [1.3548, 103.9437],
            [1.3521, 103.9442],
            [1.3421, 103.9518],
            [1.3318, 103.9558],
            [1.3195, 103.8840],
            [1.3026, 103.8500]
        ]
    },

    {
        "id": "dtl",

        "name": "Alternative via DTL",

        "uses_lines": [
            "DTL"
        ],

        "base_time": 55,

        "transfers": 1,

        "description": (
            "Alternative route avoiding the affected EWL."
        ),

        "coordinates": [
            [1.3548, 103.9437],
            [1.3395, 103.9497],
            [1.3343, 103.9624],
            [1.3260, 103.8890],
            [1.3008, 103.8477]
        ]
    },

    {
        "id": "bus",

        "name": "Bus alternative",

        "uses_lines": [
            "BUS"
        ],

        "base_time": 60,

        "transfers": 0,

        "description": (
            "Bus-based fallback when rail conditions deteriorate."
        ),

        "coordinates": [
            [1.3548, 103.9437],
            [1.3475, 103.9350],
            [1.3300, 103.9000],
            [1.3150, 103.8700],
            [1.3026, 103.8500]
        ]
    }
]


# ============================================================
# Demo scenarios
#
# Clearly labelled as simulated test scenarios.
# ============================================================

SCENARIOS = {

    "normal": {

        "label": "Normal service",

        "disruption": False,

        "affected_lines": [],

        "delay": 0,

        "crowding": "Low",

        "rain": False,

        "alert_threshold": 5
    },

    "disruption": {

        "label": "Simulated EWL disruption",

        "disruption": True,

        "affected_lines": [
            "EWL"
        ],

        "delay": 18,

        "crowding": "High",

        "rain": False,

        "alert_threshold": 5
    },

    "rain": {

        "label": "Rain scenario",

        "disruption": False,

        "affected_lines": [],

        "delay": 0,

        "crowding": "Medium",

        "rain": True,

        "alert_threshold": 5
    },

    "crowding": {

        "label": "High crowding",

        "disruption": False,

        "affected_lines": [],

        "delay": 0,

        "crowding": "High",

        "rain": False,

        "alert_threshold": 5
    }
}


# ============================================================
# Frontend
# ============================================================

@app.get("/")
def home():

    return FileResponse(
        "index.html"
    )


@app.get("/styles.css")
def styles():

    return FileResponse(
        "styles.css"
    )


@app.get("/app.js")
def javascript():

    return FileResponse(
        "app.js"
    )


# ============================================================
# Basic API
# ============================================================

@app.get("/api/commuter")
def get_commuter():

    return COMMUTER


@app.get("/api/journey")
def get_journey():

    return get_journey_summary()


@app.get("/api/routes")
def get_routes():

    return ROUTES


# ============================================================
# Current conditions
# ============================================================

@app.get("/api/conditions")
def get_conditions():

    return SCENARIOS["disruption"]


# ============================================================
# Main recommendation
# ============================================================

@app.get("/api/recommendation")
def recommendation():

    conditions = SCENARIOS["disruption"]

    return get_recommendation(
        ROUTES,
        conditions
    )


# ============================================================
# Scenario endpoint
# ============================================================

@app.get("/api/scenario/{scenario}")
def scenario(
    scenario: str
):

    if scenario not in SCENARIOS:

        return {
            "error": "Unknown scenario",

            "available_scenarios": list(
                SCENARIOS.keys()
            )
        }

    conditions = SCENARIOS[
        scenario
    ]

    recommendation = get_recommendation(
        ROUTES,
        conditions
    )

    return {
        "scenario": scenario,

        "scenario_label": conditions[
            "label"
        ],

        "recommendation": recommendation
    }


# ============================================================
# Health check
# ============================================================

@app.get("/api/health")
def health():

    return {
        "status": "ok",

        "service": "ayAhead",

        "version": "1.0"
    }