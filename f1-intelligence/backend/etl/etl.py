"""
Pitwall — ETL Pipeline
Loads race data from FastF1 into SQLite.

Usage:
    python etl.py --seasons 2021 2022 2023 2024
    python etl.py --seasons 2021 --round 1
    python etl.py --latest
"""

import argparse
import logging
import os
import sqlite3
from pathlib import Path
from datetime import datetime

import pandas as pd
import fastf1
from tqdm import tqdm

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent
DB_PATH = BASE_DIR / "database" / "f1.db"
SCHEMA_PATH = BASE_DIR / "database" / "schema.sql"
CACHE_DIR = BASE_DIR / "database" / "fastf1_cache"
LOG_DIR = BASE_DIR / "logs"

LOG_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)

# Enable FastF1 cache
fastf1.Cache.enable_cache(str(CACHE_DIR))

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "etl.log"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# DB helpers
# ---------------------------------------------------------------------------

def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.row_factory = sqlite3.Row
    return conn


def init_database(conn: sqlite3.Connection) -> None:
    schema = SCHEMA_PATH.read_text()
    conn.executescript(schema)
    conn.commit()
    log.info("Database initialised from schema.sql")


# ---------------------------------------------------------------------------
# Data-type helpers
# ---------------------------------------------------------------------------

def safe_seconds(td) -> float | None:
    """Convert a timedelta (or float/NaT/None) to seconds."""
    if td is None:
        return None
    try:
        if pd.isna(td):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return td.total_seconds()
    except AttributeError:
        try:
            return float(td)
        except (TypeError, ValueError):
            return None


def get_track_status(code) -> str:
    """Map FastF1 track status codes to readable strings."""
    mapping = {
        "1": "Green",
        "2": "Yellow",
        "4": "SC",
        "5": "Red",
        "6": "VSC",
        "7": "VSC",
    }
    if code is None:
        return "Green"
    return mapping.get(str(code).strip(), "Green")


def safe_int(val) -> int | None:
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return int(val)
    except (TypeError, ValueError):
        return None


def safe_float(val) -> float | None:
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    try:
        return float(val)
    except (TypeError, ValueError):
        return None


def safe_str(val) -> str | None:
    try:
        if pd.isna(val):
            return None
    except (TypeError, ValueError):
        pass
    if val is None:
        return None
    return str(val).strip() or None


# F1 points system (2010-present)
F1_POINTS = {1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1}


def derive_finish_order(laps: pd.DataFrame) -> pd.DataFrame:
    """
    Derive finish positions from lap data when Ergast results are unavailable.
    Returns DataFrame with columns: driver_id, finish_position, laps_completed.
    """
    if laps.empty:
        return pd.DataFrame(columns=["driver_id", "finish_position", "laps_completed"])

    summary = []
    for driver, grp in laps.groupby("Driver"):
        grp = grp.sort_values("LapNumber")
        max_laps = safe_int(grp["LapNumber"].max()) or 0
        last_pos = safe_int(grp.iloc[-1].get("Position")) if not grp.empty else None
        summary.append({"driver_id": str(driver), "laps_completed": max_laps, "last_position": last_pos})

    df = pd.DataFrame(summary)
    # Sort: most laps first, then by last tracked position ascending
    df["last_position"] = pd.to_numeric(df["last_position"], errors="coerce")
    df = df.sort_values(
        ["laps_completed", "last_position"],
        ascending=[False, True],
        na_position="last",
    ).reset_index(drop=True)
    df["finish_position"] = range(1, len(df) + 1)
    return df[["driver_id", "finish_position", "laps_completed"]]


# ---------------------------------------------------------------------------
# Metadata loader
# ---------------------------------------------------------------------------

def load_race_metadata(conn: sqlite3.Connection, season_year: int) -> None:
    """Fetch event schedule and populate seasons, circuits, races tables."""
    log.info(f"Loading metadata for {season_year} season …")
    try:
        schedule = fastf1.get_event_schedule(season_year, include_testing=False)
    except Exception as e:
        log.error(f"Failed to fetch schedule for {season_year}: {e}")
        return

    # Insert season
    conn.execute(
        "INSERT OR IGNORE INTO seasons (season_year, total_rounds) VALUES (?, ?)",
        (season_year, len(schedule)),
    )

    for _, event in schedule.iterrows():
        circuit_id = safe_str(event.get("OfficialEventName") or event.get("EventName") or f"circuit_{event['RoundNumber']}")
        circuit_id = circuit_id.replace(" ", "_").lower()[:50] if circuit_id else f"circuit_{event['RoundNumber']}"

        country = safe_str(event.get("Country"))
        city = safe_str(event.get("Location"))
        circuit_name = safe_str(event.get("OfficialEventName") or event.get("EventName"))

        conn.execute(
            "INSERT OR IGNORE INTO circuits (circuit_id, circuit_name, country, city) VALUES (?, ?, ?, ?)",
            (circuit_id, circuit_name, country, city),
        )

        race_date = None
        if event.get("EventDate") is not None:
            try:
                race_date = pd.Timestamp(event["EventDate"]).strftime("%Y-%m-%d")
            except Exception:
                pass

        conn.execute(
            """INSERT OR IGNORE INTO races
               (season_year, round_number, circuit_id, race_name, race_date)
               VALUES (?, ?, ?, ?, ?)""",
            (season_year, int(event["RoundNumber"]), circuit_id, circuit_name, race_date),
        )

    conn.commit()
    log.info(f"Metadata loaded for {season_year}: {len(schedule)} rounds")


# ---------------------------------------------------------------------------
# Race session loader
# ---------------------------------------------------------------------------

def load_race_session(conn: sqlite3.Connection, season_year: int, round_number: int) -> None:
    """Load a race session (drivers, laps, pit stops, results)."""
    # Check if already loaded
    existing = conn.execute(
        "SELECT race_id FROM races WHERE season_year=? AND round_number=?",
        (season_year, round_number),
    ).fetchone()
    if existing is None:
        log.warning(f"Race {season_year} R{round_number} not in metadata — run load_race_metadata first")
        return
    race_id = existing["race_id"]

    already_loaded = conn.execute(
        "SELECT 1 FROM lap_times WHERE race_id=? LIMIT 1", (race_id,)
    ).fetchone()
    if already_loaded:
        log.info(f"Race {season_year} R{round_number} already loaded, skipping")
        return

    log.info(f"Loading race session {season_year} R{round_number} (race_id={race_id}) …")
    try:
        session = fastf1.get_session(season_year, round_number, "R")
        session.load(telemetry=False, weather=False, messages=False)
    except Exception as e:
        log.error(f"Failed to load race session {season_year} R{round_number}: {e}")
        return

    laps = session.laps
    if laps is None or laps.empty:
        log.warning(f"No lap data for {season_year} R{round_number}")
        return

    # Update total_laps
    total_laps = safe_int(laps["LapNumber"].max())
    conn.execute("UPDATE races SET total_laps=? WHERE race_id=?", (total_laps, race_id))

    # --- Drivers & Teams from session.results ---
    results_df = session.results if session.results is not None else pd.DataFrame()
    driver_meta: dict[str, dict] = {}

    for _, row in results_df.iterrows():
        driver_id = safe_str(row.get("Abbreviation"))
        if not driver_id:
            continue
        full_name = safe_str(row.get("FullName") or f"{row.get('FirstName', '')} {row.get('LastName', '')}".strip())
        team_id_raw = safe_str(row.get("TeamName"))
        team_id = team_id_raw.replace(" ", "_").lower()[:50] if team_id_raw else None
        nationality = safe_str(row.get("CountryCode"))

        conn.execute(
            "INSERT OR IGNORE INTO drivers (driver_id, full_name, abbreviation, nationality) VALUES (?, ?, ?, ?)",
            (driver_id, full_name, driver_id, nationality),
        )
        if team_id:
            conn.execute(
                "INSERT OR IGNORE INTO teams (team_id, team_name) VALUES (?, ?)",
                (team_id, team_id_raw),
            )
        driver_meta[driver_id] = {"team_id": team_id, "nationality": nationality}

    # --- Derive finish order from laps (Ergast shutdown workaround) ---
    finish_order = derive_finish_order(laps)

    # Check if session.results has real position/points data (pre-Ergast-shutdown)
    has_official_results = (
        not results_df.empty
        and "Points" in results_df.columns
        and results_df["Points"].notna().any()
    )

    for _, fo_row in finish_order.iterrows():
        driver_id = fo_row["driver_id"]
        finish_pos = fo_row["finish_position"]
        laps_completed_val = fo_row["laps_completed"]

        if has_official_results:
            rr = results_df[results_df["Abbreviation"] == driver_id]
            if not rr.empty:
                r = rr.iloc[0]
                grid_pos = safe_int(r.get("GridPosition"))
                finish_pos = safe_int(r.get("Position")) or finish_pos
                classified_pos = safe_str(r.get("ClassifiedPosition"))
                points = safe_float(r.get("Points"))
                laps_completed_val = safe_int(r.get("NumberOfLaps")) or laps_completed_val
                status = safe_str(r.get("Status"))
                fl_time = safe_seconds(r.get("FastestLapTime"))
                fl_rank = safe_int(r.get("FastestLapRank"))
                fastest_lap = 1 if fl_rank == 1 else 0
            else:
                grid_pos, classified_pos, points, status, fl_time, fastest_lap = None, None, None, None, None, 0
        else:
            # Derive points from finish position
            points = float(F1_POINTS.get(finish_pos, 0))
            grid_pos = None
            classified_pos = str(finish_pos)
            status = "Finished" if finish_pos <= 15 else "DNF"
            fl_time = None
            fastest_lap = 0

        meta = driver_meta.get(driver_id, {})
        team_id = meta.get("team_id")

        conn.execute(
            """INSERT OR IGNORE INTO race_results
               (race_id, driver_id, team_id, grid_position, finish_position,
                classified_position, points, laps_completed, status,
                fastest_lap, fastest_lap_time)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (race_id, driver_id, team_id, grid_pos, finish_pos,
             classified_pos, points, safe_int(laps_completed_val), status,
             fastest_lap, fl_time),
        )

    # --- Lap Times ---
    lap_rows = []
    for _, lap in laps.iterrows():
        driver_id = safe_str(lap.get("Driver"))
        if not driver_id:
            continue
        track_status = get_track_status(lap.get("TrackStatus"))
        lap_rows.append((
            race_id,
            driver_id,
            safe_int(lap.get("LapNumber")),
            safe_seconds(lap.get("LapTime")),
            safe_seconds(lap.get("Sector1Time")),
            safe_seconds(lap.get("Sector2Time")),
            safe_seconds(lap.get("Sector3Time")),
            1 if lap.get("IsPersonalBest") else 0,
            safe_str(lap.get("Compound")),
            safe_int(lap.get("TyreLife")),
            track_status,
            safe_int(lap.get("Position")),
        ))

    conn.executemany(
        """INSERT INTO lap_times
           (race_id, driver_id, lap_number, lap_time_seconds,
            sector1_seconds, sector2_seconds, sector3_seconds,
            is_personal_best, compound, tyre_life, track_status, position)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        lap_rows,
    )

    # --- Pit Stops ---
    pit_rows = []
    pit_laps = laps[laps["PitOutTime"].notna() | laps["PitInTime"].notna()].copy() if "PitInTime" in laps.columns else pd.DataFrame()

    # Build pit stops from lap data: a lap with PitInTime means a stop happened
    if not pit_laps.empty and "PitInTime" in laps.columns:
        pit_stops_laps = laps[laps["PitInTime"].notna()].copy()
        stop_counts: dict[str, int] = {}
        for _, lap in pit_stops_laps.iterrows():
            driver_id = safe_str(lap.get("Driver"))
            if not driver_id:
                continue
            stop_counts[driver_id] = stop_counts.get(driver_id, 0) + 1
            stop_number = stop_counts[driver_id]

            # pit duration = time between PitInTime and PitOutTime on next lap
            pit_duration = None
            if lap.get("PitInTime") is not None and not pd.isna(lap.get("PitInTime")):
                next_laps = laps[
                    (laps["Driver"] == lap["Driver"]) &
                    (laps["LapNumber"] == lap["LapNumber"] + 1)
                ]
                if not next_laps.empty and "PitOutTime" in next_laps.columns:
                    pit_out = next_laps.iloc[0].get("PitOutTime")
                    if pit_out is not None and not pd.isna(pit_out):
                        try:
                            pit_duration = safe_seconds(pit_out - lap["PitInTime"])
                        except Exception:
                            pass

            # compound before and after stop
            current_compound = safe_str(lap.get("Compound"))
            next_lap_rows = laps[
                (laps["Driver"] == lap["Driver"]) &
                (laps["LapNumber"] == lap["LapNumber"] + 1)
            ]
            next_compound = safe_str(next_lap_rows.iloc[0].get("Compound")) if not next_lap_rows.empty else None

            pit_rows.append((
                race_id,
                driver_id,
                safe_int(lap.get("LapNumber")),
                pit_duration,
                current_compound,
                next_compound,
                stop_number,
            ))

    if pit_rows:
        conn.executemany(
            """INSERT INTO pit_stops
               (race_id, driver_id, lap_number, pit_duration_seconds,
                compound_in, compound_out, stop_number)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            pit_rows,
        )

    conn.commit()
    log.info(f"Race {season_year} R{round_number}: {len(lap_rows)} laps, {len(pit_rows)} pit stops loaded")


# ---------------------------------------------------------------------------
# Qualifying session loader
# ---------------------------------------------------------------------------

def derive_grid_from_quali_laps(laps: pd.DataFrame) -> dict[str, int]:
    """
    Derive grid positions by ranking drivers by their best qualifying lap time.
    Works even when Ergast/official results are unavailable.
    Returns {driver_id: grid_position}.
    """
    if laps is None or laps.empty:
        return {}
    best_laps = (
        laps[laps["LapTime"].notna()]
        .groupby("Driver")["LapTime"]
        .min()
        .reset_index()
        .rename(columns={"LapTime": "BestLap"})
    )
    best_laps["seconds"] = best_laps["BestLap"].dt.total_seconds()
    best_laps = best_laps.sort_values("seconds").reset_index(drop=True)
    return {str(row["Driver"]): int(i + 1) for i, row in best_laps.iterrows()}


def load_qualifying_session(conn: sqlite3.Connection, season_year: int, round_number: int) -> None:
    """
    Load qualifying session. Derives Q1/Q2/Q3 times and grid positions from
    lap data (works without Ergast).
    """
    existing = conn.execute(
        "SELECT race_id FROM races WHERE season_year=? AND round_number=?",
        (season_year, round_number),
    ).fetchone()
    if existing is None:
        log.warning(f"Race {season_year} R{round_number} not found for qualifying")
        return
    race_id = existing["race_id"]

    already_loaded = conn.execute(
        "SELECT 1 FROM qualifying_results WHERE race_id=? AND grid_position IS NOT NULL LIMIT 1",
        (race_id,),
    ).fetchone()
    if already_loaded:
        log.info(f"Qualifying {season_year} R{round_number} already loaded, skipping")
        return

    # Delete stale null-grid rows from prior failed load
    conn.execute("DELETE FROM qualifying_results WHERE race_id=?", (race_id,))

    log.info(f"Loading qualifying session {season_year} R{round_number} …")
    try:
        session = fastf1.get_session(season_year, round_number, "Q")
        session.load(telemetry=False, weather=False, messages=False)
    except Exception as e:
        log.error(f"Failed to load qualifying session {season_year} R{round_number}: {e}")
        return

    laps = session.laps
    results_df = session.results if session.results is not None else pd.DataFrame()

    if laps is None or laps.empty:
        log.warning(f"No qualifying laps for {season_year} R{round_number}")
        return

    # Derive grid order from best lap times (Ergast-free)
    grid_map = derive_grid_from_quali_laps(laps)

    # Try to get Q1/Q2/Q3 segment times by using stint number as proxy for segment
    # FastF1 qualifying stints: 1=Q1, 2=Q2, 3=Q3
    def best_lap_in_stint(driver: str, stint: int) -> float | None:
        mask = (laps["Driver"] == driver) & (laps["Stint"] == stint) & laps["LapTime"].notna()
        dl = laps[mask]
        if dl.empty:
            return None
        return safe_seconds(dl["LapTime"].min())

    # Build per-driver records
    drivers_seen = set()
    if not results_df.empty:
        for _, row in results_df.iterrows():
            driver_id = safe_str(row.get("Abbreviation"))
            if not driver_id:
                continue
            drivers_seen.add(driver_id)
            team_id_raw = safe_str(row.get("TeamName"))
            team_id = team_id_raw.replace(" ", "_").lower()[:50] if team_id_raw else None
            grid_pos = grid_map.get(driver_id)

            # Try official Q1/Q2/Q3 first, fall back to stint-derived
            q1 = safe_seconds(row.get("Q1")) or best_lap_in_stint(driver_id, 1)
            q2 = safe_seconds(row.get("Q2")) or best_lap_in_stint(driver_id, 2)
            q3 = safe_seconds(row.get("Q3")) or best_lap_in_stint(driver_id, 3)

            conn.execute(
                """INSERT OR IGNORE INTO qualifying_results
                   (race_id, driver_id, team_id, q1_seconds, q2_seconds, q3_seconds, grid_position)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (race_id, driver_id, team_id, q1, q2, q3, grid_pos),
            )

    # Also add any drivers in laps but not in results_df
    for driver_id, grid_pos in grid_map.items():
        if driver_id in drivers_seen:
            continue
        q1 = best_lap_in_stint(driver_id, 1)
        q2 = best_lap_in_stint(driver_id, 2)
        q3 = best_lap_in_stint(driver_id, 3)
        conn.execute(
            """INSERT OR IGNORE INTO qualifying_results
               (race_id, driver_id, q1_seconds, q2_seconds, q3_seconds, grid_position)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (race_id, driver_id, q1, q2, q3, grid_pos),
        )

    # Backfill grid_position into race_results for this race
    for driver_id, grid_pos in grid_map.items():
        conn.execute(
            "UPDATE race_results SET grid_position=? WHERE race_id=? AND driver_id=?",
            (grid_pos, race_id, driver_id),
        )

    conn.commit()
    log.info(
        f"Qualifying {season_year} R{round_number}: "
        f"{len(grid_map)} drivers, grid positions derived from lap times"
    )


# ---------------------------------------------------------------------------
# Season stats aggregation
# ---------------------------------------------------------------------------

def compute_driver_season_stats(conn: sqlite3.Connection, season_year: int) -> None:
    """Aggregate wins, podiums, poles, DNFs, avg positions, lap consistency."""
    log.info(f"Computing driver season stats for {season_year} …")

    # Get all drivers who raced in this season
    drivers = conn.execute(
        """SELECT DISTINCT rr.driver_id, rr.team_id
           FROM race_results rr
           JOIN races r ON rr.race_id = r.race_id
           WHERE r.season_year = ?""",
        (season_year,),
    ).fetchall()

    for driver_row in drivers:
        driver_id = driver_row["driver_id"]
        team_id = driver_row["team_id"]

        results = pd.read_sql_query(
            """SELECT rr.grid_position, rr.finish_position, rr.classified_position,
                      rr.points, rr.status, rr.fastest_lap, rr.laps_completed
               FROM race_results rr
               JOIN races r ON rr.race_id = r.race_id
               WHERE r.season_year = ? AND rr.driver_id = ?""",
            conn,
            params=(season_year, driver_id),
        )

        if results.empty:
            continue

        total_points = results["points"].sum()
        wins = int((results["finish_position"] == 1).sum())
        podiums = int((results["finish_position"] <= 3).sum())
        dnfs = int(results["classified_position"].str.upper().isin(["R", "W", "D", "E", "N"]).sum()
                   if results["classified_position"].notna().any() else 0)

        avg_finish = results["finish_position"].dropna().mean()
        avg_grid = results["grid_position"].dropna().mean()

        # Poles from qualifying
        poles_row = conn.execute(
            """SELECT COUNT(*) as cnt FROM qualifying_results qr
               JOIN races r ON qr.race_id = r.race_id
               WHERE r.season_year = ? AND qr.driver_id = ? AND qr.grid_position = 1""",
            (season_year, driver_id),
        ).fetchone()
        poles = poles_row["cnt"] if poles_row else 0

        fastest_laps = int(results["fastest_lap"].sum())

        # Lap consistency — stddev of clean (green flag, non-pit) lap times
        clean_laps = pd.read_sql_query(
            """SELECT lt.lap_time_seconds FROM lap_times lt
               JOIN races r ON lt.race_id = r.race_id
               WHERE r.season_year = ? AND lt.driver_id = ?
                 AND lt.track_status = 'Green'
                 AND lt.lap_time_seconds IS NOT NULL
                 AND lt.lap_time_seconds > 0""",
            conn,
            params=(season_year, driver_id),
        )
        consistency = float(clean_laps["lap_time_seconds"].std()) if len(clean_laps) > 1 else None

        # Overperformance score: avg(grid_pos - finish_pos), positive = gained positions
        valid = results[results["grid_position"].notna() & results["finish_position"].notna()].copy()
        if not valid.empty:
            over_score = float((valid["grid_position"] - valid["finish_position"]).mean())
        else:
            over_score = None

        conn.execute(
            """INSERT OR REPLACE INTO driver_season_stats
               (season_year, driver_id, team_id, total_points, wins, podiums, poles,
                fastest_laps, dnfs, avg_finish_position, avg_grid_position,
                avg_lap_consistency, overperformance_score)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (season_year, driver_id, team_id, total_points, wins, podiums, poles,
             fastest_laps, dnfs,
             float(avg_finish) if pd.notna(avg_finish) else None,
             float(avg_grid) if pd.notna(avg_grid) else None,
             consistency, over_score),
        )

    conn.commit()
    log.info(f"Season stats computed for {season_year}: {len(drivers)} drivers")


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------

def reprocess_qualifying_grids(conn: sqlite3.Connection, season_year: int) -> None:
    """
    Re-derive grid positions for all already-loaded races in a season.
    Safe to run against an existing DB — updates race_results.grid_position
    and qualifying_results.grid_position from FastF1 qualifying lap times.
    """
    log.info(f"Re-processing qualifying grids for {season_year} …")
    rounds = [
        r["round_number"]
        for r in conn.execute(
            "SELECT round_number FROM races WHERE season_year=?", (season_year,)
        ).fetchall()
    ]
    for rnd in tqdm(rounds, desc=f"{season_year} grids", leave=False):
        load_qualifying_session(conn, season_year, rnd)
    compute_driver_season_stats(conn, season_year)
    conn.commit()
    log.info(f"Grid reprocess complete for {season_year}")


def run_backfill(seasons: list[int], round_filter: int | None = None) -> None:
    """Run the full ETL pipeline for the given seasons."""
    conn = get_connection()
    init_database(conn)

    for season_year in tqdm(seasons, desc="Seasons"):
        load_race_metadata(conn, season_year)

        rounds_query = "SELECT round_number FROM races WHERE season_year=?"
        params: tuple = (season_year,)
        if round_filter is not None:
            rounds_query += " AND round_number=?"
            params = (season_year, round_filter)

        rounds = [r["round_number"] for r in conn.execute(rounds_query, params).fetchall()]

        for rnd in tqdm(rounds, desc=f"{season_year} races", leave=False):
            load_race_session(conn, season_year, rnd)
            load_qualifying_session(conn, season_year, rnd)

        compute_driver_season_stats(conn, season_year)

    conn.close()
    log.info("ETL backfill complete")


def run_latest() -> None:
    """Load the most recent completed race for the current year."""
    current_year = datetime.now().year
    conn = get_connection()
    init_database(conn)

    load_race_metadata(conn, current_year)

    # Find the latest round with a past date
    rounds = conn.execute(
        """SELECT round_number, race_date FROM races
           WHERE season_year=? AND race_date <= date('now')
           ORDER BY round_number DESC LIMIT 1""",
        (current_year,),
    ).fetchone()

    if rounds is None:
        log.warning(f"No completed races found for {current_year}")
        conn.close()
        return

    rnd = rounds["round_number"]
    log.info(f"Loading latest race: {current_year} R{rnd}")
    load_race_session(conn, current_year, rnd)
    load_qualifying_session(conn, current_year, rnd)
    compute_driver_season_stats(conn, current_year)
    conn.close()
    log.info("Latest race loaded")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Pitwall ETL Pipeline")
    parser.add_argument(
        "--seasons", nargs="+", type=int,
        default=[2021, 2022, 2023, 2024],
        help="Season years to backfill",
    )
    parser.add_argument(
        "--round", type=int, default=None,
        dest="round_number",
        help="Load only a specific round number",
    )
    parser.add_argument(
        "--latest", action="store_true",
        help="Load the most recent completed race",
    )
    parser.add_argument(
        "--reprocess-grids", action="store_true",
        dest="reprocess_grids",
        help="Re-derive grid positions for all loaded races (fixes Ergast-shutdown data gap)",
    )
    args = parser.parse_args()

    if args.latest:
        run_latest()
    elif args.reprocess_grids:
        conn = get_connection()
        init_database(conn)
        for season_year in args.seasons:
            reprocess_qualifying_grids(conn, season_year)
        conn.close()
    else:
        run_backfill(args.seasons, args.round_number)
