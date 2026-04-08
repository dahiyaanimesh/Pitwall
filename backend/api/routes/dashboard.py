"""
Dashboard summary endpoint — aggregates all data needed for the homepage
in a single request to avoid N+1 frontend calls.
"""
import sqlite3
from pathlib import Path

import pandas as pd
from fastapi import APIRouter, Query

DB_PATH = Path(__file__).resolve().parent.parent.parent / "database" / "f1.db"

router = APIRouter()


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


@router.get("/summary")
def dashboard_summary(season: int = Query(2021)):
    conn = get_conn()

    # ── Championship standings (top 10) ───────────────────────────────────────
    standings_rows = conn.execute(
        """SELECT dss.driver_id, d.full_name, t.team_name, t.team_id,
                  dss.total_points, dss.wins, dss.podiums, dss.avg_finish_position,
                  dss.overperformance_score
           FROM driver_season_stats dss
           JOIN drivers d ON d.driver_id = dss.driver_id
           LEFT JOIN teams t ON t.team_id = dss.team_id
           WHERE dss.season_year = ?
           ORDER BY dss.total_points DESC
           LIMIT 10""",
        (season,),
    ).fetchall()
    standings = [dict(r) for r in standings_rows]

    # ── Constructor standings ─────────────────────────────────────────────────
    constructor_rows = conn.execute(
        """SELECT t.team_name, t.team_id, SUM(dss.total_points) as points,
                  SUM(dss.wins) as wins, COUNT(*) as drivers
           FROM driver_season_stats dss
           LEFT JOIN teams t ON t.team_id = dss.team_id
           WHERE dss.season_year = ?
           GROUP BY dss.team_id, t.team_name
           ORDER BY points DESC""",
        (season,),
    ).fetchall()
    constructors = [dict(r) for r in constructor_rows]

    # ── Points trajectory (top 5 drivers, per round) ─────────────────────────
    # Cumulative points per driver per round
    results_rows = conn.execute(
        """SELECT rr.driver_id, r.round_number, r.race_name, rr.points
           FROM race_results rr
           JOIN races r ON r.race_id = rr.race_id
           WHERE r.season_year = ?
           ORDER BY rr.driver_id, r.round_number""",
        (season,),
    ).fetchall()
    results_df = pd.DataFrame([dict(r) for r in results_rows])

    top5_ids = [s["driver_id"] for s in standings[:5]]
    trajectory = []
    if not results_df.empty:
        results_df["cumulative"] = results_df.groupby("driver_id")["points"].cumsum()
        # Get all rounds
        rounds = sorted(results_df["round_number"].unique())
        round_labels = {}
        for _, row in results_df.drop_duplicates("round_number").iterrows():
            rn = row["round_number"]
            name = str(row["race_name"])
            # Short label
            short = (name.replace("FORMULA 1 ", "")
                        .replace("FORMULA 1", "")
                        .replace("GRAND PRIX", "GP")
                        .strip()
                        .split(" "))[:3]
            round_labels[rn] = " ".join(short)

        for rn in rounds:
            pt: dict = {"round": int(rn), "label": round_labels.get(rn, f"R{rn}")}
            for did in top5_ids:
                drv_df = results_df[(results_df["driver_id"] == did) & (results_df["round_number"] == rn)]
                if not drv_df.empty:
                    pt[did] = round(float(drv_df.iloc[0]["cumulative"]), 1)
            trajectory.append(pt)

    # ── Season stats ──────────────────────────────────────────────────────────
    # Total races in season
    race_count = conn.execute(
        "SELECT COUNT(*) as n FROM races WHERE season_year = ?", (season,)
    ).fetchone()["n"]

    # Different race winners
    winner_count = conn.execute(
        """SELECT COUNT(DISTINCT rr.driver_id) as n
           FROM race_results rr
           JOIN races r ON r.race_id = rr.race_id
           WHERE r.season_year = ? AND rr.finish_position = 1""",
        (season,),
    ).fetchone()["n"]

    # Points gap between P1 and P2
    points_gap = None
    if len(standings) >= 2:
        points_gap = round(standings[0]["total_points"] - standings[1]["total_points"], 1)

    # ── Stat callouts ─────────────────────────────────────────────────────────
    # Most dominant overperformer — computed on-the-fly from qualifying grid vs
    # finish position, using only races where qualifying grid is not null.
    dom_row = conn.execute(
        """SELECT sub.driver_id, d.full_name, t.team_name,
                  sub.overperformance_score, sub.races
           FROM (
               SELECT rr.driver_id, dss.team_id,
                      ROUND(AVG(CAST(qr.grid_position AS REAL) - CAST(rr.finish_position AS REAL)), 2)
                          AS overperformance_score,
                      COUNT(*) AS races
               FROM race_results rr
               JOIN qualifying_results qr
                 ON qr.race_id = rr.race_id AND qr.driver_id = rr.driver_id
               JOIN races r ON r.race_id = rr.race_id
               JOIN driver_season_stats dss
                 ON dss.driver_id = rr.driver_id AND dss.season_year = r.season_year
               WHERE r.season_year = ?
                 AND rr.finish_position IS NOT NULL
                 AND qr.grid_position IS NOT NULL
               GROUP BY rr.driver_id
               HAVING races >= 5
           ) sub
           JOIN drivers d ON d.driver_id = sub.driver_id
           LEFT JOIN teams t ON t.team_id = sub.team_id
           ORDER BY sub.overperformance_score DESC
           LIMIT 1""",
        (season,),
    ).fetchone()
    most_dominant = dict(dom_row) if dom_row else None

    # Closest teammate battle — smallest average qualifying time gap (ms)
    # Uses COALESCE(q3, q2, q1) as best session time for each driver per race.
    battle_row = conn.execute(
        """SELECT sub.team_id, tm.team_name,
                  sub.d1_id, sub.d2_id, sub.avg_qual_delta_ms
           FROM (
               SELECT q1.team_id,
                      MIN(q1.driver_id, q2.driver_id) AS d1_id,
                      MAX(q1.driver_id, q2.driver_id) AS d2_id,
                      ROUND(AVG(ABS(
                          COALESCE(q1.q3_seconds, q1.q2_seconds, q1.q1_seconds) -
                          COALESCE(q2.q3_seconds, q2.q2_seconds, q2.q1_seconds)
                      )) * 1000, 0) AS avg_qual_delta_ms,
                      COUNT(*) AS rounds
               FROM qualifying_results q1
               JOIN qualifying_results q2
                 ON q1.race_id = q2.race_id
                AND q1.team_id = q2.team_id
                AND q1.driver_id < q2.driver_id
               JOIN races r ON r.race_id = q1.race_id
               WHERE r.season_year = ?
                 AND COALESCE(q1.q3_seconds, q1.q2_seconds, q1.q1_seconds) IS NOT NULL
                 AND COALESCE(q2.q3_seconds, q2.q2_seconds, q2.q1_seconds) IS NOT NULL
               GROUP BY q1.team_id, d1_id, d2_id
               HAVING rounds >= 5
           ) sub
           LEFT JOIN teams tm ON tm.team_id = sub.team_id
           ORDER BY sub.avg_qual_delta_ms ASC
           LIMIT 1""",
        (season,),
    ).fetchone()
    closest_battle = dict(battle_row) if battle_row else None

    # Most pit stops by a single driver in a single race.
    # Only count stops where a compound change actually happened (compound_in !=
    # compound_out) — this filters out red-flag queue entries, SC drive-throughs,
    # and ETL sprint-round artifacts that record same-compound "stops".
    # Also cap duration at 60 s to exclude red-flag waiting periods.
    pitstop_race = conn.execute(
        """SELECT r.race_name, r.season_year, r.round_number,
                  ps.driver_id, COUNT(*) AS total_stops,
                  c.city
           FROM pit_stops ps
           JOIN races r ON r.race_id = ps.race_id
           LEFT JOIN circuits c ON c.circuit_id = r.circuit_id
           WHERE r.season_year = ?
             AND ps.compound_in != ps.compound_out
             AND ps.pit_duration_seconds < 60
           GROUP BY ps.race_id, ps.driver_id
           ORDER BY total_stops DESC
           LIMIT 1""",
        (season,),
    ).fetchone()
    most_pitstops = dict(pitstop_race) if pitstop_race else None

    conn.close()

    # ── Auto-generated insight ────────────────────────────────────────────────
    insights = []
    if most_dominant:
        delta = round(most_dominant["overperformance_score"], 1) if most_dominant["overperformance_score"] else 0
        if delta > 0:
            insights.append(
                f"{most_dominant['full_name']} gained an avg of {delta:.1f} places vs grid position — "
                f"the season's best overperformer."
            )
    if standings and len(standings) >= 2:
        p1 = standings[0]
        insights.append(
            f"{p1['full_name']} won {p1['wins']} races and scored {p1['total_points']} pts, "
            f"edging the title by just {abs(points_gap) if points_gap is not None else '?'} points."
        )
    if most_pitstops:
        city = most_pitstops.get("city") or "Unknown"
        insights.append(
            f"{most_pitstops['driver_id']} made {most_pitstops['total_stops']} pit stops in {city} "
            f"— the most aggressive strategy of the season."
        )

    return {
        "season": season,
        "standings": standings,
        "constructors": constructors,
        "top5_ids": top5_ids,
        "trajectory": trajectory,
        "season_stats": {
            "race_count": race_count,
            "winner_count": winner_count,
            "points_gap": points_gap,
        },
        "callouts": {
            "most_dominant": most_dominant,
            "closest_battle": closest_battle,
            "most_pitstops": most_pitstops,
        },
        "insight": insights[0] if insights else None,
    }
