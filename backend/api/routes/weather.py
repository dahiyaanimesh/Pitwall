"""
Weather / Track Status API routes.
All data sourced from lap_times.track_status — no external API needed.
"""

import sqlite3
from pathlib import Path
from fastapi import APIRouter, HTTPException, Query

DB_PATH = Path(__file__).resolve().parent.parent.parent / "database" / "f1.db"

router = APIRouter()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _race_lap_statuses(conn: sqlite3.Connection, race_id: int) -> list[dict]:
    """
    Returns one row per lap for a race, using the most-common track_status
    across all drivers on that lap (majority vote to avoid noise).
    """
    rows = conn.execute(
        """
        SELECT lap_number, track_status, COUNT(*) as cnt
        FROM lap_times
        WHERE race_id = ? AND track_status IS NOT NULL
        GROUP BY lap_number, track_status
        ORDER BY lap_number, cnt DESC
        """,
        (race_id,),
    ).fetchall()

    # Keep only the most common status per lap
    seen: set[int] = set()
    result: list[dict] = []
    for row in rows:
        lap = row["lap_number"]
        if lap not in seen:
            seen.add(lap)
            result.append({"lap": lap, "status": row["track_status"]})

    result.sort(key=lambda r: r["lap"])
    return result


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/track-status")
def track_status(race_id: int = Query(..., description="Race ID")):
    """
    Lap-by-lap track status, deduplicated — only rows where status changes.
    """
    conn = get_conn()
    laps = _race_lap_statuses(conn, race_id)
    conn.close()

    if not laps:
        raise HTTPException(status_code=404, detail=f"No lap data for race_id {race_id}")

    # Deduplicate — only emit when status changes
    deduped: list[dict] = []
    prev_status = None
    for lap in laps:
        if lap["status"] != prev_status:
            deduped.append(lap)
            prev_status = lap["status"]

    return deduped


@router.get("/safety-cars")
def safety_cars(season: int = Query(2021)):
    """
    All SC/VSC deployments in the season, collapsed into intervals.
    Includes which drivers pitted under each deployment.
    """
    conn = get_conn()

    races = conn.execute(
        """SELECT race_id, round_number, race_name
           FROM races WHERE season_year = ?
           ORDER BY round_number""",
        (season,),
    ).fetchall()

    result = []
    for race in races:
        rid = race["race_id"]
        laps = _race_lap_statuses(conn, rid)

        # Collapse contiguous SC/VSC laps into intervals
        intervals: list[dict] = []
        i = 0
        while i < len(laps):
            status = laps[i]["status"]
            if status in ("SC", "VSC"):
                start = laps[i]["lap"]
                j = i + 1
                while j < len(laps) and laps[j]["status"] == status:
                    j += 1
                end = laps[j - 1]["lap"]
                lap_count = end - start + 1

                # Drivers who pitted during this SC window
                pitstop_rows = conn.execute(
                    """SELECT DISTINCT d.driver_id, d.abbreviation, d.full_name
                       FROM pit_stops ps
                       JOIN drivers d ON ps.driver_id = d.driver_id
                       WHERE ps.race_id = ?
                         AND ps.lap_number BETWEEN ? AND ?
                    """,
                    (rid, start, end),
                ).fetchall()

                intervals.append({
                    "race_id":         rid,
                    "race_name":       race["race_name"],
                    "round":           race["round_number"],
                    "lap_start":       start,
                    "lap_end":         end,
                    "type":            status,
                    "laps_neutralised": lap_count,
                    "drivers_pitted":  [
                        {"driver_id": r["driver_id"], "abbreviation": r["abbreviation"], "full_name": r["full_name"]}
                        for r in pitstop_rows
                    ],
                })
                i = j
            else:
                i += 1

        result.extend(intervals)

    conn.close()
    return result


@router.get("/status-summary")
def status_summary(race_id: int = Query(..., description="Race ID")):
    """
    Summary lap counts by track status for one race.
    """
    conn = get_conn()
    laps = _race_lap_statuses(conn, race_id)
    conn.close()

    if not laps:
        raise HTTPException(status_code=404, detail=f"No lap data for race_id {race_id}")

    counts: dict[str, int] = {}
    for lap in laps:
        s = lap["status"]
        counts[s] = counts.get(s, 0) + 1

    total = len(laps)
    green = counts.get("Green", 0)
    yellow = counts.get("Yellow", 0)
    sc = counts.get("SC", 0)
    vsc = counts.get("VSC", 0)
    red = counts.get("Red", 0)

    # Count distinct interventions (SC or VSC deployments)
    interventions = 0
    prev = None
    for lap in laps:
        s = lap["status"]
        if s in ("SC", "VSC") and s != prev:
            interventions += 1
        prev = s

    return {
        "race_id":       race_id,
        "green_laps":    green,
        "yellow_laps":   yellow,
        "sc_laps":       sc,
        "vsc_laps":      vsc,
        "red_flag_laps": red,
        "total_laps":    total,
        "green_pct":     round(green / total * 100, 1) if total else 0,
        "interventions": interventions,
    }


@router.get("/season-overview")
def season_overview(season: int = Query(2021)):
    """
    Status summary for every race in the season — used for the heatmap.
    Returns per-lap status arrays keyed by race_id for rendering the grid.
    """
    conn = get_conn()

    races = conn.execute(
        """SELECT race_id, round_number, race_name, total_laps
           FROM races WHERE season_year = ?
           ORDER BY round_number""",
        (season,),
    ).fetchall()

    result = []
    for race in races:
        rid = race["race_id"]
        laps = _race_lap_statuses(conn, rid)

        # Build a lap→status lookup (only laps with data)
        lap_map = {entry["lap"]: entry["status"] for entry in laps}
        max_lap = max(lap_map.keys()) if lap_map else 0

        # Count interventions
        interventions = 0
        prev = None
        for lap in laps:
            s = lap["status"]
            if s in ("SC", "VSC") and s != prev:
                interventions += 1
            prev = s

        counts: dict[str, int] = {}
        for lap in laps:
            s = lap["status"]
            counts[s] = counts.get(s, 0) + 1

        total = len(laps)
        result.append({
            "race_id":       rid,
            "round_number":  race["round_number"],
            "race_name":     race["race_name"],
            "total_laps":    max_lap,
            "lap_statuses":  lap_map,   # {"1": "Green", "14": "SC", ...}
            "green_pct":     round(counts.get("Green", 0) / total * 100, 1) if total else 0,
            "sc_laps":       counts.get("SC", 0),
            "vsc_laps":      counts.get("VSC", 0),
            "interventions": interventions,
        })

    conn.close()
    return result
