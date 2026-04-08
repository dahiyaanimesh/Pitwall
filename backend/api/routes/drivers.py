"""
Driver-related API routes.
"""

import sqlite3
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

DB_PATH = Path(__file__).resolve().parent.parent.parent / "database" / "f1.db"

router = APIRouter()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


# ---------------------------------------------------------------------------
# Fixed-path routes must come BEFORE /{driver_id} path-param routes
# ---------------------------------------------------------------------------

@router.get("")
def list_drivers(season: int = Query(..., description="Season year")):
    """All drivers for a season, ordered by championship points."""
    conn = get_conn()
    rows = conn.execute(
        """SELECT DISTINCT d.driver_id, d.full_name, d.abbreviation, d.nationality,
                  t.team_name, t.team_id, dss.total_points
           FROM race_results rr
           JOIN drivers d ON rr.driver_id = d.driver_id
           JOIN races r ON rr.race_id = r.race_id
           LEFT JOIN teams t ON rr.team_id = t.team_id
           LEFT JOIN driver_season_stats dss
               ON dss.driver_id = d.driver_id AND dss.season_year = r.season_year
           WHERE r.season_year = ?
           ORDER BY dss.total_points DESC NULLS LAST""",
        (season,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/compare")
def compare_drivers(
    driver1: str = Query(..., description="Driver abbreviation e.g. VER"),
    driver2: str = Query(..., description="Driver abbreviation e.g. HAM"),
    season: int = Query(2021, description="Season year"),
):
    """Head-to-head stats comparison between two drivers."""
    conn = get_conn()
    d1 = driver1.upper()
    d2 = driver2.upper()

    def fetch_stats(driver_id: str) -> dict:
        stats = conn.execute(
            """SELECT dss.*, d.full_name, d.nationality, t.team_name, t.team_id
               FROM driver_season_stats dss
               JOIN drivers d ON dss.driver_id = d.driver_id
               LEFT JOIN teams t ON dss.team_id = t.team_id
               WHERE dss.season_year = ? AND dss.driver_id = ?""",
            (season, driver_id),
        ).fetchone()
        if stats is None:
            return {}
        result = dict(stats)
        avg_lap = conn.execute(
            """SELECT AVG(lt.lap_time_seconds) as avg_lap_time
               FROM lap_times lt
               JOIN races r ON lt.race_id = r.race_id
               WHERE r.season_year = ? AND lt.driver_id = ?
                 AND lt.track_status = 'Green'
                 AND lt.lap_number > 1
                 AND lt.lap_time_seconds IS NOT NULL""",
            (season, driver_id),
        ).fetchone()
        result["avg_lap_time"] = avg_lap["avg_lap_time"] if avg_lap else None
        return result

    stats1 = fetch_stats(d1)
    stats2 = fetch_stats(d2)
    conn.close()

    if not stats1 and not stats2:
        raise HTTPException(
            status_code=404,
            detail=f"No season stats found for {d1} or {d2} in {season}.",
        )

    return {
        "season": season,
        "driver1": stats1,
        "driver2": stats2,
        "head_to_head": {
            "points_gap": (stats1.get("total_points") or 0) - (stats2.get("total_points") or 0),
            "wins_gap": (stats1.get("wins") or 0) - (stats2.get("wins") or 0),
            "podiums_gap": (stats1.get("podiums") or 0) - (stats2.get("podiums") or 0),
        },
    }


@router.get("/teammate-battle")
def teammate_battle(season: int = Query(..., description="Season year")):
    """
    For every team that season, return both drivers with head-to-head stats:
    race count, avg finish delta, avg clean lap delta, points delta.
    """
    conn = get_conn()

    # All teams with 2+ drivers that season
    teams = conn.execute(
        """SELECT dss.team_id, t.team_name, COUNT(DISTINCT dss.driver_id) as driver_count
           FROM driver_season_stats dss
           LEFT JOIN teams t ON dss.team_id = t.team_id
           WHERE dss.season_year = ?
           GROUP BY dss.team_id
           HAVING driver_count >= 1
           ORDER BY SUM(dss.total_points) DESC""",
        (season,),
    ).fetchall()

    result = []
    for team_row in teams:
        team_id = team_row["team_id"]
        team_name = team_row["team_name"]

        drivers = conn.execute(
            """SELECT dss.driver_id, d.full_name, dss.total_points,
                      dss.wins, dss.podiums, dss.avg_finish_position,
                      dss.avg_lap_consistency, dss.overperformance_score
               FROM driver_season_stats dss
               JOIN drivers d ON dss.driver_id = d.driver_id
               WHERE dss.season_year = ? AND dss.team_id = ?
               ORDER BY dss.total_points DESC""",
            (season, team_id),
        ).fetchall()

        if len(drivers) < 2:
            # Still include single-driver teams with limited data
            if len(drivers) == 1:
                d = dict(drivers[0])
                # Get avg clean lap time
                avg_lap = conn.execute(
                    """SELECT AVG(lt.lap_time_seconds) as avg_lap
                       FROM lap_times lt
                       JOIN races r ON lt.race_id = r.race_id
                       WHERE r.season_year = ? AND lt.driver_id = ?
                         AND lt.track_status = 'Green'
                         AND lt.lap_number > 1
                         AND lt.lap_time_seconds IS NOT NULL""",
                    (season, d["driver_id"]),
                ).fetchone()
                d["avg_clean_lap"] = avg_lap["avg_lap"] if avg_lap else None
                result.append({
                    "team_id": team_id,
                    "team_name": team_name,
                    "driver1": d,
                    "driver2": None,
                    "head_to_head_wins": None,
                    "points_delta": None,
                    "avg_finish_delta": None,
                    "avg_lap_delta_ms": None,
                })
            continue

        d1 = dict(drivers[0])
        d2 = dict(drivers[1])

        # Avg clean lap time per driver
        for d in (d1, d2):
            avg_lap = conn.execute(
                """SELECT AVG(lt.lap_time_seconds) as avg_lap
                   FROM lap_times lt
                   JOIN races r ON lt.race_id = r.race_id
                   WHERE r.season_year = ? AND lt.driver_id = ?
                     AND lt.track_status = 'Green'
                     AND lt.lap_number > 1
                     AND lt.lap_time_seconds IS NOT NULL""",
                (season, d["driver_id"]),
            ).fetchone()
            d["avg_clean_lap"] = avg_lap["avg_lap"] if avg_lap else None

        # Head-to-head: count races where d1 finished ahead of d2
        h2h = conn.execute(
            """SELECT
                 SUM(CASE WHEN rr1.finish_position < rr2.finish_position THEN 1 ELSE 0 END) as d1_ahead,
                 SUM(CASE WHEN rr2.finish_position < rr1.finish_position THEN 1 ELSE 0 END) as d2_ahead,
                 COUNT(*) as total_races
               FROM race_results rr1
               JOIN race_results rr2
                 ON rr1.race_id = rr2.race_id
               JOIN races r ON rr1.race_id = r.race_id
               WHERE r.season_year = ?
                 AND rr1.driver_id = ?
                 AND rr2.driver_id = ?
                 AND rr1.finish_position IS NOT NULL
                 AND rr2.finish_position IS NOT NULL""",
            (season, d1["driver_id"], d2["driver_id"]),
        ).fetchone()

        lap_delta_ms = None
        if d1["avg_clean_lap"] is not None and d2["avg_clean_lap"] is not None:
            lap_delta_ms = round((d1["avg_clean_lap"] - d2["avg_clean_lap"]) * 1000, 1)

        finish_delta = None
        if d1["avg_finish_position"] is not None and d2["avg_finish_position"] is not None:
            finish_delta = round(d1["avg_finish_position"] - d2["avg_finish_position"], 2)

        result.append({
            "team_id": team_id,
            "team_name": team_name,
            "driver1": d1,
            "driver2": d2,
            "head_to_head_wins": {
                "driver1_ahead": h2h["d1_ahead"] if h2h else 0,
                "driver2_ahead": h2h["d2_ahead"] if h2h else 0,
                "total_races": h2h["total_races"] if h2h else 0,
            },
            "points_delta": round(
                (d1["total_points"] or 0) - (d2["total_points"] or 0), 1
            ),
            "avg_finish_delta": finish_delta,
            "avg_lap_delta_ms": lap_delta_ms,
        })

    conn.close()
    return result


@router.get("/overperformers")
def overperformers(season: int = Query(..., description="Season year")):
    """
    Rank all drivers by overperformance_score (avg grid_pos - finish_pos).
    Positive = gained positions = outperformed expectations.
    """
    conn = get_conn()
    rows = conn.execute(
        """SELECT dss.driver_id, d.full_name, t.team_name, t.team_id,
                  dss.total_points, dss.wins, dss.podiums,
                  dss.avg_finish_position, dss.avg_grid_position,
                  dss.overperformance_score,
                  (dss.avg_grid_position - dss.avg_finish_position) as position_delta
           FROM driver_season_stats dss
           JOIN drivers d ON dss.driver_id = d.driver_id
           LEFT JOIN teams t ON dss.team_id = t.team_id
           WHERE dss.season_year = ?
           ORDER BY dss.overperformance_score DESC NULLS LAST""",
        (season,),
    ).fetchall()
    conn.close()

    ranked = []
    for i, row in enumerate(rows, 1):
        r = dict(row)
        r["rank"] = i
        ranked.append(r)
    return ranked


# ---------------------------------------------------------------------------
# Path-param routes — must come AFTER fixed routes
# ---------------------------------------------------------------------------

@router.get("/{driver_id}/season-arc")
def driver_season_arc(
    driver_id: str,
    season: int = Query(..., description="Season year"),
):
    """
    Per-race cumulative points, finish position, and rolling avg lap
    consistency across the season. Used for the season arc trajectory chart.
    """
    conn = get_conn()
    did = driver_id.upper()

    races = conn.execute(
        """SELECT r.race_id, r.round_number, r.race_name, r.race_date,
                  rr.finish_position, rr.points
           FROM races r
           LEFT JOIN race_results rr
             ON r.race_id = rr.race_id AND rr.driver_id = ?
           WHERE r.season_year = ?
           ORDER BY r.round_number""",
        (did, season),
    ).fetchall()

    if not races:
        raise HTTPException(status_code=404, detail=f"No data for driver {did} in {season}")

    cumulative_points = 0.0
    arc = []
    for row in races:
        r = dict(row)
        pts = r["points"] or 0.0
        cumulative_points += pts

        # Lap consistency for this race (stddev of green flag clean laps)
        consistency = conn.execute(
            """SELECT AVG(lt.lap_time_seconds) as avg_lap,
                      MIN(lt.lap_time_seconds) as best_lap,
                      COUNT(*) as lap_count
               FROM lap_times lt
               WHERE lt.race_id = ? AND lt.driver_id = ?
                 AND lt.track_status = 'Green'
                 AND lt.lap_number > 1
                 AND lt.lap_time_seconds IS NOT NULL""",
            (r["race_id"], did),
        ).fetchone()

        # stddev computed in Python (SQLite has no STDDEV)
        lap_rows = conn.execute(
            """SELECT lt.lap_time_seconds
               FROM lap_times lt
               WHERE lt.race_id = ? AND lt.driver_id = ?
                 AND lt.track_status = 'Green'
                 AND lt.lap_number > 1
                 AND lt.lap_time_seconds IS NOT NULL""",
            (r["race_id"], did),
        ).fetchall()
        lap_times = [lr["lap_time_seconds"] for lr in lap_rows]

        stddev = None
        if len(lap_times) > 1:
            mean = sum(lap_times) / len(lap_times)
            variance = sum((x - mean) ** 2 for x in lap_times) / (len(lap_times) - 1)
            stddev = variance ** 0.5

        arc.append({
            "round_number": r["round_number"],
            "race_name": r["race_name"],
            "race_date": r["race_date"],
            "finish_position": r["finish_position"],
            "points_scored": pts,
            "cumulative_points": round(cumulative_points, 1),
            "avg_lap_time": round(consistency["avg_lap"], 3) if consistency and consistency["avg_lap"] else None,
            "best_lap_time": round(consistency["best_lap"], 3) if consistency and consistency["best_lap"] else None,
            "lap_count": consistency["lap_count"] if consistency else 0,
            "lap_consistency_stddev": round(stddev, 3) if stddev is not None else None,
        })

    conn.close()
    return {"driver_id": did, "season": season, "arc": arc}


@router.get("/{driver_id}/pace-profile")
def driver_pace_profile(
    driver_id: str,
    season: int = Query(..., description="Season year"),
):
    """
    For each race: avg/median/best clean lap time and consistency score.
    Excludes SC/VSC laps and lap 1. Green flag only.
    """
    conn = get_conn()
    did = driver_id.upper()

    races = conn.execute(
        """SELECT r.race_id, r.round_number, r.race_name, r.race_date
           FROM races r
           WHERE r.season_year = ?
           ORDER BY r.round_number""",
        (season,),
    ).fetchall()

    profile = []
    for race in races:
        lap_rows = conn.execute(
            """SELECT lt.lap_time_seconds
               FROM lap_times lt
               WHERE lt.race_id = ? AND lt.driver_id = ?
                 AND lt.track_status = 'Green'
                 AND lt.lap_number > 1
                 AND lt.lap_time_seconds IS NOT NULL
               ORDER BY lt.lap_time_seconds""",
            (race["race_id"], did),
        ).fetchall()

        times = [lr["lap_time_seconds"] for lr in lap_rows]
        if not times:
            profile.append({
                "round_number": race["round_number"],
                "race_name": race["race_name"],
                "race_date": race["race_date"],
                "avg_lap_time": None,
                "median_lap_time": None,
                "best_lap_time": None,
                "consistency_stddev": None,
                "lap_count": 0,
            })
            continue

        n = len(times)
        avg = sum(times) / n
        median = times[n // 2] if n % 2 == 1 else (times[n // 2 - 1] + times[n // 2]) / 2
        best = times[0]
        stddev = None
        if n > 1:
            variance = sum((x - avg) ** 2 for x in times) / (n - 1)
            stddev = variance ** 0.5

        profile.append({
            "round_number": race["round_number"],
            "race_name": race["race_name"],
            "race_date": race["race_date"],
            "avg_lap_time": round(avg, 3),
            "median_lap_time": round(median, 3),
            "best_lap_time": round(best, 3),
            "consistency_stddev": round(stddev, 3) if stddev is not None else None,
            "lap_count": n,
        })

    conn.close()
    return {"driver_id": did, "season": season, "profile": profile}


@router.get("/{driver_id}/stats")
def get_driver_stats(driver_id: str, season: int = Query(..., description="Season year")):
    """Season stats for a single driver."""
    conn = get_conn()
    row = conn.execute(
        """SELECT dss.*, d.full_name, d.nationality, t.team_name, t.team_id
           FROM driver_season_stats dss
           JOIN drivers d ON dss.driver_id = d.driver_id
           LEFT JOIN teams t ON dss.team_id = t.team_id
           WHERE dss.season_year = ? AND dss.driver_id = ?""",
        (season, driver_id.upper()),
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Driver stats not found")
    return dict(row)


@router.get("/{driver_id}/laps")
def get_driver_laps(
    driver_id: str,
    season: int = Query(..., description="Season year"),
    circuit: Optional[str] = Query(None, description="Circuit ID filter"),
):
    """Lap times for a driver, optionally filtered by circuit."""
    conn = get_conn()
    if circuit:
        rows = conn.execute(
            """SELECT lt.*, r.round_number, r.race_name
               FROM lap_times lt
               JOIN races r ON lt.race_id = r.race_id
               WHERE r.season_year = ? AND lt.driver_id = ? AND r.circuit_id = ?
               ORDER BY r.round_number, lt.lap_number""",
            (season, driver_id.upper(), circuit),
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT lt.*, r.round_number, r.race_name
               FROM lap_times lt
               JOIN races r ON lt.race_id = r.race_id
               WHERE r.season_year = ? AND lt.driver_id = ?
               ORDER BY r.round_number, lt.lap_number""",
            (season, driver_id.upper()),
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
