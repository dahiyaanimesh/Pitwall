"""
Race-related API routes.
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


@router.get("")
def list_races(season: int = Query(..., description="Season year")):
    """List all races for a season."""
    conn = get_conn()
    rows = conn.execute(
        """SELECT r.race_id, r.season_year, r.round_number, r.race_name,
                  r.race_date, r.total_laps,
                  r.circuit_id, c.circuit_name, c.country, c.city
           FROM races r
           LEFT JOIN circuits c ON r.circuit_id = c.circuit_id
           WHERE r.season_year = ?
           ORDER BY r.round_number""",
        (season,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/{race_id}")
def get_race(race_id: int):
    """Single race details with circuit info."""
    conn = get_conn()
    row = conn.execute(
        """SELECT r.race_id, r.season_year, r.round_number, r.race_name,
                  r.race_date, r.total_laps,
                  c.circuit_id, c.circuit_name, c.country, c.city, c.circuit_type
           FROM races r
           LEFT JOIN circuits c ON r.circuit_id = c.circuit_id
           WHERE r.race_id = ?""",
        (race_id,),
    ).fetchone()
    conn.close()
    if row is None:
        raise HTTPException(status_code=404, detail="Race not found")
    return dict(row)


@router.get("/{race_id}/results")
def get_race_results(race_id: int):
    """Full race results with driver and team info."""
    conn = get_conn()
    rows = conn.execute(
        """SELECT rr.result_id, rr.grid_position, rr.finish_position,
                  rr.classified_position, rr.points, rr.laps_completed,
                  rr.status, rr.fastest_lap, rr.fastest_lap_time,
                  d.driver_id, d.full_name, d.abbreviation, d.nationality,
                  t.team_id, t.team_name
           FROM race_results rr
           JOIN drivers d ON rr.driver_id = d.driver_id
           LEFT JOIN teams t ON rr.team_id = t.team_id
           WHERE rr.race_id = ?
           ORDER BY rr.finish_position""",
        (race_id,),
    ).fetchall()
    conn.close()
    if not rows:
        raise HTTPException(status_code=404, detail="No results found for this race")
    return [dict(r) for r in rows]


@router.get("/{race_id}/laps")
def get_race_laps(race_id: int, driver: Optional[str] = Query(None, description="Driver abbreviation")):
    """Lap times for a race, optionally filtered by driver."""
    conn = get_conn()
    if driver:
        rows = conn.execute(
            """SELECT * FROM lap_times
               WHERE race_id = ? AND driver_id = ?
               ORDER BY driver_id, lap_number""",
            (race_id, driver.upper()),
        ).fetchall()
    else:
        rows = conn.execute(
            """SELECT * FROM lap_times
               WHERE race_id = ?
               ORDER BY driver_id, lap_number""",
            (race_id,),
        ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/{race_id}/pitstops")
def get_race_pitstops(race_id: int):
    """All pit stops for a race.
    Filters to real strategic stops only: compound must change and service
    duration must be under 60 s. This excludes red-flag waiting periods,
    ETL sprint-round artifacts, and same-compound SC drive-throughs.
    """
    conn = get_conn()
    rows = conn.execute(
        """SELECT ps.pit_id, ps.driver_id, d.full_name, ps.lap_number,
                  ps.pit_duration_seconds, ps.compound_in, ps.compound_out, ps.stop_number
           FROM pit_stops ps
           JOIN drivers d ON ps.driver_id = d.driver_id
           WHERE ps.race_id = ?
             AND ps.compound_in != ps.compound_out
             AND ps.pit_duration_seconds < 60
           ORDER BY ps.driver_id, ps.stop_number""",
        (race_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


@router.get("/{race_id}/timing")
def get_race_timing(race_id: int):
    """
    Per-driver best sector times and fastest lap for a race.
    Only counts green-flag laps after lap 1 where all three sectors
    are recorded.  Returns overall bests for purple-highlighting.
    """
    conn = get_conn()
    rows = conn.execute(
        """SELECT
               lt.driver_id,
               d.full_name,
               d.abbreviation,
               dss.team_id,
               tm.team_name,
               MIN(lt.sector1_seconds)  AS best_s1,
               MIN(lt.sector2_seconds)  AS best_s2,
               MIN(lt.sector3_seconds)  AS best_s3,
               MIN(lt.lap_time_seconds) AS best_lap,
               COUNT(lt.lap_id)         AS total_laps,
               rr.finish_position,
               rr.fastest_lap           AS has_fastest_lap
           FROM lap_times lt
           JOIN drivers d ON lt.driver_id = d.driver_id
           JOIN race_results rr
             ON lt.race_id = rr.race_id AND lt.driver_id = rr.driver_id
           JOIN races r ON r.race_id = lt.race_id
           JOIN driver_season_stats dss
             ON dss.driver_id = lt.driver_id AND dss.season_year = r.season_year
           LEFT JOIN teams tm ON tm.team_id = dss.team_id
           WHERE lt.race_id = ?
             AND lt.track_status = 'Green'
             AND lt.lap_number > 1
             AND lt.sector1_seconds  IS NOT NULL
             AND lt.sector2_seconds  IS NOT NULL
             AND lt.sector3_seconds  IS NOT NULL
             AND lt.lap_time_seconds IS NOT NULL
           GROUP BY lt.driver_id
           ORDER BY rr.finish_position ASC""",
        (race_id,),
    ).fetchall()
    conn.close()

    if not rows:
        return {"overall_best": None, "drivers": []}

    drivers = [dict(r) for r in rows]

    overall_best = {
        "s1":  min(d["best_s1"]  for d in drivers if d["best_s1"]  is not None),
        "s2":  min(d["best_s2"]  for d in drivers if d["best_s2"]  is not None),
        "s3":  min(d["best_s3"]  for d in drivers if d["best_s3"]  is not None),
        "lap": min(d["best_lap"] for d in drivers if d["best_lap"] is not None),
    }

    return {"overall_best": overall_best, "drivers": drivers}
