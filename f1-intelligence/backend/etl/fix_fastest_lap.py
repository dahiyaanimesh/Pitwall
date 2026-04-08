"""
Fix fastest_lap data in race_results:
  1. Populate fastest_lap = 1 for the driver with the minimum lap_time_seconds per race
     (green-flag laps, lap > 1, all three sectors recorded)
  2. Apply +1 bonus point ONLY for seasons >= 2019 where finish_position <= 10
     AND the bonus has not already been applied (points == base F1 points for that position)
  3. Recompute driver_season_stats for all affected seasons

Safety: the script is idempotent — running it twice gives the same result.
"""

import sqlite3
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from etl import compute_driver_season_stats

DB_PATH = Path(__file__).resolve().parent.parent / "database" / "f1.db"

# Base points by finish position (no fastest-lap bonus)
F1_POINTS: dict[int, float] = {
    1: 25, 2: 18, 3: 15, 4: 12, 5: 10, 6: 8, 7: 6, 8: 4, 9: 2, 10: 1,
}


def main() -> None:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")

    # ── Step 1: strip any bonus that was added incorrectly ───────────────────
    # Find FL holders in P1-10 for 2019+ whose points are base+2 (double-counted)
    # or base+1 (may be correct or may have been added by a prior run of this script).
    # Safest: subtract 1 from any FL holder in P1-10 for 2019+ whose points > base.
    # Then we re-add correctly in Step 3.
    print("Step 1: Reverting any previously applied bonus points …")
    rows_to_check = conn.execute(
        """
        SELECT rr.race_id, rr.driver_id, rr.finish_position, rr.points, rr.fastest_lap
        FROM race_results rr
        JOIN races r ON rr.race_id = r.race_id
        WHERE rr.fastest_lap = 1
          AND rr.finish_position <= 10
          AND r.season_year >= 2019
        """
    ).fetchall()
    reverted = 0
    for row in rows_to_check:
        base = F1_POINTS.get(row["finish_position"], 0)
        if row["points"] > base:
            # Subtract 1 to get back to what the points were WITHOUT the FL bonus
            conn.execute(
                "UPDATE race_results SET points = points - 1 WHERE race_id = ? AND driver_id = ?",
                (row["race_id"], row["driver_id"]),
            )
            reverted += 1
    print(f"  Reverted {reverted} row(s) to base points")

    # ── Step 2: reset fastest_lap flags ──────────────────────────────────────
    print("Step 2: Resetting all fastest_lap flags to 0 …")
    conn.execute("UPDATE race_results SET fastest_lap = 0")

    # ── Step 3: find true fastest-lap holder per race from lap_times ─────────
    print("Step 3: Computing fastest-lap holders from lap_times …")
    fastest = conn.execute(
        """
        SELECT lt.race_id, lt.driver_id
        FROM lap_times lt
        WHERE lt.lap_time_seconds IS NOT NULL
          AND lt.track_status = 'Green'
          AND lt.lap_number > 1
          AND lt.sector1_seconds IS NOT NULL
          AND lt.sector2_seconds IS NOT NULL
          AND lt.sector3_seconds IS NOT NULL
        GROUP BY lt.race_id
        HAVING lt.lap_time_seconds = MIN(lt.lap_time_seconds)
        ORDER BY lt.race_id, lt.driver_id
        """
    ).fetchall()

    # In the rare case of ties, keep only the first driver alphabetically per race
    seen: set[int] = set()
    unique_fastest: list[tuple[int, str]] = []
    for row in fastest:
        if row["race_id"] not in seen:
            seen.add(row["race_id"])
            unique_fastest.append((row["race_id"], row["driver_id"]))

    print(f"  Fastest-lap holders identified: {len(unique_fastest)}")
    conn.executemany(
        "UPDATE race_results SET fastest_lap = 1 WHERE race_id = ? AND driver_id = ?",
        unique_fastest,
    )
    updated = conn.execute(
        "SELECT COUNT(*) FROM race_results WHERE fastest_lap = 1"
    ).fetchone()[0]
    print(f"  Rows set to fastest_lap=1: {updated}")

    # ── Step 4: apply +1 bonus — only where base points are stored ───────────
    # If points == base F1 points → bonus was never applied → add it.
    # If points != base (e.g. official data already included the bonus, or
    # half-points race) → leave as-is to avoid double-counting.
    print("Step 4: Applying fastest-lap bonus point where missing …")

    fl_holders = conn.execute(
        """
        SELECT rr.race_id, rr.driver_id, rr.finish_position, rr.points
        FROM race_results rr
        JOIN races r ON rr.race_id = r.race_id
        WHERE rr.fastest_lap = 1
          AND rr.finish_position <= 10
          AND r.season_year >= 2019
        """
    ).fetchall()

    bonus_applied = 0
    bonus_skipped = 0
    for row in fl_holders:
        base = F1_POINTS.get(row["finish_position"], 0)
        if abs(row["points"] - base) < 0.01:
            # Base points only → bonus is missing → add it
            conn.execute(
                "UPDATE race_results SET points = points + 1 WHERE race_id = ? AND driver_id = ?",
                (row["race_id"], row["driver_id"]),
            )
            bonus_applied += 1
        else:
            # Points differ from base → official data already has bonus or
            # half-points race; leave as-is
            bonus_skipped += 1

    print(f"  Bonus applied: {bonus_applied}, skipped (already correct): {bonus_skipped}")

    # ── Step 5: recompute driver_season_stats ─────────────────────────────────
    print("Step 5: Recomputing driver_season_stats …")
    seasons = [
        r[0]
        for r in conn.execute(
            "SELECT DISTINCT season_year FROM races ORDER BY season_year"
        ).fetchall()
    ]
    for year in seasons:
        compute_driver_season_stats(conn, year)

    conn.commit()
    conn.close()
    print("\nDone.")


if __name__ == "__main__":
    main()
