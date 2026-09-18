from datetime import datetime, timedelta


# ============================================================
# ayAhead Smart Commuter Companion
# Decision Engine
# ============================================================


def calculate_route(route, conditions):
    """
    Calculate the estimated travel time for one route.

    The calculation combines:
    - normal travel time
    - MRT disruption
    - crowding
    - rain
    - uncertainty
    """

    base_time = route["base_time"]
    extra_time = 0
    reasons = []

    # --------------------------------------------------------
    # MRT disruption
    # --------------------------------------------------------

    affected_lines = conditions.get("affected_lines", [])

    affected = any(
        line in affected_lines
        for line in route.get("uses_lines", [])
    )

    if affected:
        delay = conditions.get("delay", 0)
        extra_time += delay

        reasons.append(
            f"{', '.join(affected_lines)} disruption "
            f"adds approximately {delay} minutes."
        )

    # --------------------------------------------------------
    # Crowding
    # --------------------------------------------------------

    crowding = conditions.get("crowding", "Low")

    if crowding == "High":
        extra_time += 5
        reasons.append("High crowding may slow boarding and transfers.")

    elif crowding == "Medium":
        extra_time += 2
        reasons.append("Moderate crowding may slightly increase boarding time.")

    # --------------------------------------------------------
    # Rain
    # --------------------------------------------------------

    if conditions.get("rain"):

        walking_time = 5

        extra_time += walking_time

        reasons.append(
            "Rain may increase walking and transfer time."
        )

    # --------------------------------------------------------
    # Calculate ETA
    # --------------------------------------------------------

    estimated_time = base_time + extra_time

    # --------------------------------------------------------
    # Uncertainty
    # --------------------------------------------------------

    uncertainty = 3

    if affected:
        uncertainty += 5

    if crowding == "High":
        uncertainty += 2

    if conditions.get("rain"):
        uncertainty += 2

    return {
        "id": route["id"],
        "name": route["name"],
        "base_time": base_time,
        "estimated_time": estimated_time,
        "extra_time": extra_time,
        "uncertainty_minutes": uncertainty,
        "uses_lines": route.get("uses_lines", []),
        "transfers": route.get("transfers", 0),
        "reasons": reasons,
        "coordinates": route.get("coordinates", [])
    }


# ============================================================
# Calculate all available routes
# ============================================================

def calculate_routes(routes, conditions):

    results = []

    for route in routes:

        result = calculate_route(
            route,
            conditions
        )

        results.append(result)

    return results


# ============================================================
# Decision engine
# ============================================================

def get_recommendation(routes, conditions):

    calculated_routes = calculate_routes(
        routes,
        conditions
    )

    usual_route = next(
        route
        for route in calculated_routes
        if route["id"] == "usual"
    )

    fastest_route = min(
        calculated_routes,
        key=lambda route: route["estimated_time"]
    )

    # --------------------------------------------------------
    # Determine whether the difference actually matters
    # --------------------------------------------------------

    time_saved = (
        usual_route["estimated_time"]
        - fastest_route["estimated_time"]
    )

    threshold = conditions.get(
        "alert_threshold",
        5
    )

    # --------------------------------------------------------
    # Decision
    # --------------------------------------------------------

    if fastest_route["id"] != "usual" and time_saved >= threshold:

        action = "REROUTE"

        message = (
            f"Switch to {fastest_route['name']}. "
            f"It is currently estimated to save "
            f"{time_saved} minutes."
        )

    else:

        action = "STAY"

        message = (
            "Stay on your usual route. "
            "The alternative does not save enough time "
            "to justify changing your journey."
        )

    # --------------------------------------------------------
    # Explanation
    # --------------------------------------------------------

    reasons = []

    if conditions.get("disruption"):

        affected = ", ".join(
            conditions.get(
                "affected_lines",
                []
            )
        )

        reasons.append(
            f"{affected} currently has a service disruption."
        )

    if conditions.get("crowding") == "High":

        reasons.append(
            "Crowding is currently high."
        )

    if conditions.get("rain"):

        reasons.append(
            "Rain may increase walking time."
        )

    if not reasons:

        reasons.append(
            "No major disruption detected."
        )

    # --------------------------------------------------------
    # Confidence
    # --------------------------------------------------------

    if conditions.get("disruption"):

        confidence = "Medium"

    elif conditions.get("crowding") == "High":

        confidence = "Medium"

    else:

        confidence = "High"

    # --------------------------------------------------------
    # Overall uncertainty
    # --------------------------------------------------------

    uncertainty = fastest_route["uncertainty_minutes"]

    return {
        "action": action,
        "message": message,

        "recommended_route": fastest_route,

        "usual_route": usual_route,

        "routes": calculated_routes,

        "time_saved": max(
            0,
            time_saved
        ),

        "alert_threshold": threshold,

        "confidence": confidence,

        "uncertainty_minutes": uncertainty,

        "reasons": reasons,

        "conditions": conditions
    }


# ============================================================
# Journey summary
# ============================================================

def get_journey_summary():

    departure = datetime.strptime(
        "07:40",
        "%H:%M"
    )

    arrival_deadline = datetime.strptime(
        "08:45",
        "%H:%M"
    )

    available_time = (
        arrival_deadline - departure
    ).seconds // 60

    return {
        "commuter": "Rachel",
        "origin": "Tampines",
        "destination": "Raffles Place",
        "departure": "07:40",
        "arrival_deadline": "08:45",
        "available_travel_time": available_time
    }