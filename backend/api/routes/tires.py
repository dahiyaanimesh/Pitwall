"""
Tyre Analysis API routes.
Stint analysis, compound usage, and strategy patterns from existing DB data.
"""

import sqlite3
from pathlib import Path
from collections import Counter, defaultdict
from fastapi import APIRouter, HTTPException, Query

DB_PATH = Path(__file__).resolve().parent.parent.parent / "database" / "f1.db"

router = APIRouter()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def _driver_stints(
    conn: sqlite3.Connection,
    race_id: int,
    driver_id: str,
    total_laps: int,
) -> list[dict]:
    """
    Build stints using pit_stops for boundaries and lap_times for compounds.
    Falls back gracefully if data is sparse.
    """
    stops = conn.execute(
        """SELECT lap_number, compound_out
           FROM pit_stops
           WHERE race_id = ? AND driver_id = ?
           ORDER BY lap_number""",
        (race_id, driver_id),
    ).fetchall()

    first_lap = conn.execute(
        """SELECT compound FROM lap_times
           WHERE race_id = ? AND driver_id = ?
           ORDER BY lap_number LIMIT 1""",
        (race_id, driver_id),
    ).fetchone()

    if not first_lap:
        return []

    last_row = conn.execute(
        "SELECT MAX(lap_number) FROM lap_times WHERE race_id = ? AND driver_id = ?",
        (race_id, driver_id),
    ).fetchone()
    actual_last = (last_row[0] or total_laps)

    def norm(c: str | None) -> str:
        return (c or "UNKNOWN").upper()

    if stops:
        starts    = [1]            + [s["lap_number"] + 1 for s in stops]
        ends      = [s["lap_number"] for s in stops] + [actual_last]
        compounds = [norm(first_lap["compound"])] + [norm(s["compound_out"]) for s in stops]
    else:
        starts, ends, compounds = [1], [actual_last], [norm(first_lap["compound"])]

    stints = []
    for i, (s, e, c) in enumerate(zip(starts, ends, compounds)):
        if s <= e:
            stints.append({
                "stint":     i + 1,
                "compound":  c,
                "start_lap": s,
                "end_lap":   e,
                "laps":      e - s + 1,
            })
    return stints


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("/stint-summary")
def stint_summary(race_id: int = Query(...)):
    """All drivers' stints for a race, sorted by finish position."""
    conn = get_conn()

    race = conn.execute(
        "SELECT race_id, race_name, round_number, total_laps FROM races WHERE race_id = ?",
        (race_id,),
    ).fetchone()
    if not race:
        conn.close()
        raise HTTPException(404, f"Race {race_id} not found")

    total_laps = race["total_laps"] or 58

    drivers = conn.execute(
        """SELECT rr.driver_id, rr.finish_position, d.abbreviation, d.full_name
           FROM race_results rr
           JOIN drivers d ON rr.driver_id = d.driver_id
           WHERE rr.race_id = ?
           ORDER BY rr.finish_position""",
        (race_id,),
    ).fetchall()

    result_drivers = []
    for drv in drivers:
        stints = _driver_stints(conn, race_id, drv["driver_id"], total_laps)
        if stints:
            result_drivers.append({
                "driver_id":       drv["driver_id"],
                "abbreviation":    drv["abbreviation"],
                "full_name":       drv["full_name"],
                "finish_position": drv["finish_position"],
                "stints":          stints,
            })

    # Fastest pitstop of the race
    fast_row = conn.execute(
        """SELECT ps.driver_id, d.abbreviation, ps.pit_duration_seconds, ps.lap_number
           FROM pit_stops ps
           JOIN drivers d ON ps.driver_id = d.driver_id
           WHERE ps.race_id = ? AND ps.pit_duration_seconds > 1
           ORDER BY ps.pit_duration_seconds ASC
           LIMIT 1""",
        (race_id,),
    ).fetchone()

    conn.close()

    return {
        "race_id":      race_id,
        "race_name":    race["race_name"],
        "round_number": race["round_number"],
        "total_laps":   total_laps,
        "drivers":      result_drivers,
        "fastest_pitstop": dict(fast_row) if fast_row else None,
    }


@router.get("/compound-usage")
def compound_usage(season: int = Query(2021)):
    """Laps per compound per race + season totals."""
    conn = get_conn()

    races = conn.execute(
        "SELECT race_id, round_number, race_name FROM races WHERE season_year = ? ORDER BY round_number",
        (season,),
    ).fetchall()

    rows = conn.execute(
        """SELECT lt.race_id, UPPER(lt.compound) AS compound, COUNT(*) AS cnt
           FROM lap_times lt
           JOIN races r ON lt.race_id = r.race_id
           WHERE r.season_year = ? AND lt.compound IS NOT NULL
           GROUP BY lt.race_id, UPPER(lt.compound)""",
        (season,),
    ).fetchall()
    conn.close()

    by_race: dict[int, dict[str, int]] = defaultdict(dict)
    total:   dict[str, int]            = defaultdict(int)
    for row in rows:
        by_race[row["race_id"]][row["compound"]] = row["cnt"]
        total[row["compound"]] += row["cnt"]

    return {
        "total":    dict(total),
        "per_race": [
            {
                "race_id":      r["race_id"],
                "round_number": r["round_number"],
                "race_name":    r["race_name"],
                "compounds":    by_race.get(r["race_id"], {}),
            }
            for r in races
        ],
    }


@router.get("/strategy-clusters")
def strategy_clusters(season: int = Query(2021)):
    """
    Group races by dominant pit stop strategy (1-stop / 2-stop / 3-stop+).
    Returns per-race stop counts and cluster memberships.
    """
    conn = get_conn()

    races = conn.execute(
        "SELECT race_id, round_number, race_name FROM races WHERE season_year = ? ORDER BY round_number",
        (season,),
    ).fetchall()

    pit_rows = conn.execute(
        """SELECT ps.race_id, ps.driver_id, MAX(ps.stop_number) AS stops
           FROM pit_stops ps
           JOIN races r ON ps.race_id = r.race_id
           WHERE r.season_year = ?
           GROUP BY ps.race_id, ps.driver_id""",
        (season,),
    ).fetchall()

    winner_rows = conn.execute(
        """SELECT rr.race_id, d.abbreviation
           FROM race_results rr
           JOIN drivers d ON rr.driver_id = d.driver_id
           WHERE rr.finish_position = 1
             AND rr.race_id IN (SELECT race_id FROM races WHERE season_year = ?)""",
        (season,),
    ).fetchall()
    conn.close()

    winners: dict[int, str] = {row["race_id"]: row["abbreviation"] for row in winner_rows}

    by_race: dict[int, list[int]] = defaultdict(list)
    for row in pit_rows:
        by_race[row["race_id"]].append(row["stops"])

    clusters: dict[str, list[dict]] = {"1-stop": [], "2-stop": [], "3-stop+": []}
    race_strategies = []

    for race in races:
        rid   = race["race_id"]
        stops = by_race.get(rid, [])
        avg   = round(sum(stops) / len(stops), 2) if stops else 0.0
        modal = Counter(stops).most_common(1)[0][0] if stops else 0
        label = f"{modal}-stop" if modal <= 2 else "3-stop+"

        entry = {
            "race_id":      rid,
            "round_number": race["round_number"],
            "race_name":    race["race_name"],
        }
        if label in clusters:
            clusters[label].append(entry)

        race_strategies.append({
            **entry,
            "avg_stops":         avg,
            "dominant_strategy": label,
            "winner":            winners.get(rid),
        })

    return {"clusters": clusters, "race_strategies": race_strategies}


@router.get("/compound-performance")
def compound_performance(season: int = Query(2021)):
    """
    Per-compound avg lap time and degradation slope (green flag laps only).
    """
    conn = get_conn()

    rows = conn.execute(
        """SELECT UPPER(lt.compound) AS compound,
                  AVG(lt.lap_time_seconds) AS avg_time,
                  COUNT(*) AS lap_count
           FROM lap_times lt
           JOIN races r ON lt.race_id = r.race_id
           WHERE r.season_year = ?
             AND lt.compound IS NOT NULL
             AND lt.lap_time_seconds > 60
             AND lt.lap_time_seconds < 200
             AND lt.track_status = 'Green'
           GROUP BY UPPER(lt.compound)
           ORDER BY avg_time""",
        (season,),
    ).fetchall()

    # Degradation slope: avg lap time per tyre_life bucket
    deg_rows = conn.execute(
        """SELECT UPPER(lt.compound) AS compound,
                  lt.tyre_life,
                  AVG(lt.lap_time_seconds) AS avg_time
           FROM lap_times lt
           JOIN races r ON lt.race_id = r.race_id
           WHERE r.season_year = ?
             AND lt.compound IS NOT NULL
             AND lt.lap_time_seconds > 60
             AND lt.lap_time_seconds < 200
             AND lt.track_status = 'Green'
             AND lt.tyre_life BETWEEN 1 AND 40
           GROUP BY UPPER(lt.compound), lt.tyre_life
           ORDER BY UPPER(lt.compound), lt.tyre_life""",
        (season,),
    ).fetchall()
    conn.close()

    by_compound: dict[str, list[tuple[int, float]]] = defaultdict(list)
    for r in deg_rows:
        by_compound[r["compound"]].append((r["tyre_life"], r["avg_time"]))

    def slope(pts: list[tuple[int, float]]) -> float:
        n = len(pts)
        if n < 2:
            return 0.0
        sx  = sum(p[0] for p in pts)
        sy  = sum(p[1] for p in pts)
        sxy = sum(p[0] * p[1] for p in pts)
        sxx = sum(p[0] ** 2 for p in pts)
        d   = n * sxx - sx * sx
        return (n * sxy - sx * sy) / d if d != 0 else 0.0

    return [
        {
            "compound":            r["compound"],
            "avg_lap_time":        round(float(r["avg_time"]), 3) if r["avg_time"] else None,
            "total_laps":          r["lap_count"],
            "degradation_per_lap": round(slope(by_compound.get(r["compound"], [])), 4),
        }
        for r in rows
    ]


@router.get("/driver-strategy")
def driver_strategy(
    season:    int = Query(2021),
    driver_id: str = Query(...),
):
    """Full season stint history for one driver, one row per race."""
    conn = get_conn()

    races = conn.execute(
        """SELECT r.race_id, r.round_number, r.race_name, r.total_laps,
                  rr.finish_position
           FROM races r
           LEFT JOIN race_results rr
             ON r.race_id = rr.race_id AND rr.driver_id = ?
           WHERE r.season_year = ?
           ORDER BY r.round_number""",
        (driver_id, season),
    ).fetchall()

    result = []
    for race in races:
        rid    = race["race_id"]
        stints = _driver_stints(conn, rid, driver_id, race["total_laps"] or 58)
        result.append({
            "race_id":         rid,
            "round_number":    race["round_number"],
            "race_name":       race["race_name"],
            "total_laps":      race["total_laps"] or 58,
            "finish_position": race["finish_position"],
            "stints":          stints,
        })

    conn.close()
    return result
