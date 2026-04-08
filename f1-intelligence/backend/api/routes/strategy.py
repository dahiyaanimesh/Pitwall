"""
F1 Pit Stop Strategy Optimizer
Endpoints: tyre-degradation, pit-window, race-replay
"""

import sqlite3
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import APIRouter, HTTPException, Query

DB_PATH = Path(__file__).resolve().parent.parent.parent / "database" / "f1.db"

router = APIRouter()

# Module-level cache for pit-window results keyed by (race_id, driver_id, lap)
_pit_cache: dict = {}

# ─── Constants ────────────────────────────────────────────────────────────────
PIT_LOSS_SECONDS   = 22.0   # typical stationary + in/out lap loss
SC_PIT_LOSS        = 5.0    # under SC, cars are slow — pit loss almost free
VSC_PIT_LOSS       = 12.0   # VSC: slower, partial discount
UNDERCUT_LAPS      = 3      # laps model assumes to close a gap after undercut
MIN_LAPS_ON_TYRE   = 3      # ignore first 3 laps of stint (warming)


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


# ─── Tyre degradation model ───────────────────────────────────────────────────

def _degradation_data(race_id: int) -> pd.DataFrame:
    """
    Load clean representative laps for degradation regression.
    Excluded: warm-up laps (tyre_life <= 2), SC/VSC laps, and in-laps
    (the final lap on each driver-compound stint, where drivers lift).
    Also excludes laps more than 7% slower than the compound average —
    catches SC queue bunching, spins, and other anomalies.
    """
    conn = get_conn()
    df = pd.read_sql_query(
        """SELECT lt.driver_id, lt.lap_number, lt.lap_time_seconds,
                  lt.compound, lt.tyre_life, lt.track_status
           FROM lap_times lt
           WHERE lt.race_id = ?
             AND lt.track_status = 'Green'
             AND lt.lap_number > 1
             AND lt.lap_time_seconds IS NOT NULL
             AND lt.tyre_life > 2
             AND lt.tyre_life < (
                 SELECT MAX(lt2.tyre_life)
                 FROM lap_times lt2
                 WHERE lt2.race_id = lt.race_id
                   AND lt2.driver_id = lt.driver_id
                   AND lt2.compound  = lt.compound
             )
           ORDER BY lt.compound, lt.tyre_life""",
        conn,
        params=(race_id,),
    )
    conn.close()

    if df.empty:
        return df

    # Remove laps > 7% slower than per-compound green-flag average
    compound_avgs = df.groupby("compound")["lap_time_seconds"].mean()
    mask = df.apply(
        lambda row: row["lap_time_seconds"] <= compound_avgs[row["compound"]] * 1.07,
        axis=1,
    )
    return df[mask].reset_index(drop=True)


MIN_DEGRAD_POINTS = 20   # minimum clean laps required for a valid regression


def _fit_degradation(df: pd.DataFrame, compound: str) -> dict:
    """
    Fit a linear regression of lap_time vs tyre_life for one compound.
    Returns slope (degrad rate s/lap) and intercept (base lap time).
    slope=None when fewer than MIN_DEGRAD_POINTS clean laps are available.
    """
    cdf = df[df["compound"] == compound].copy()
    if len(cdf) < MIN_DEGRAD_POINTS:
        return {"compound": compound, "slope": None, "intercept": None, "n": len(cdf)}
    X = cdf["tyre_life"].values
    y = cdf["lap_time_seconds"].values
    coeffs = np.polyfit(X, y, 1)
    slope, intercept = float(coeffs[0]), float(coeffs[1])
    return {
        "compound": compound,
        "slope": round(slope, 5),
        "intercept": round(intercept, 3),
        "n": len(cdf),
    }


def _compute_gap_series(race_id: int) -> pd.DataFrame:
    """
    Compute estimated inter-car gaps (seconds) at each lap for each driver.
    Method: cumulative lap time from lap 2 onwards.
    Gap to P-ahead = difference in cumulative time between consecutive positions.
    """
    conn = get_conn()
    laps = pd.read_sql_query(
        """SELECT driver_id, lap_number, lap_time_seconds, position, compound, tyre_life, track_status
           FROM lap_times WHERE race_id = ?
           ORDER BY lap_number, position""",
        conn,
        params=(race_id,),
    )
    conn.close()

    if laps.empty:
        return pd.DataFrame()

    # Cumulative time per driver (starting from lap 2, lap 1 is formation)
    laps["lap_time_seconds"] = pd.to_numeric(laps["lap_time_seconds"], errors="coerce")
    # Fill NaN lap times with median for that driver (SC/VSC laps)
    laps["lap_time_filled"] = laps.groupby("driver_id")["lap_time_seconds"].transform(
        lambda x: x.fillna(x.median())
    )
    laps["cumulative_time"] = laps.groupby("driver_id")["lap_time_filled"].cumsum()

    # For each lap, compute gap to P-1 ahead and P+1 behind
    gaps = []
    for lap_num, lap_df in laps.groupby("lap_number"):
        lap_df = lap_df.sort_values("position").reset_index(drop=True)
        for i, row in lap_df.iterrows():
            pos = row["position"]
            if pd.isna(pos):
                continue
            pos = int(pos)

            # Gap to car directly ahead (P-1)
            ahead = lap_df[lap_df["position"] == pos - 1]
            behind = lap_df[lap_df["position"] == pos + 1]

            gap_ahead = None
            gap_behind = None

            if not ahead.empty and not pd.isna(row["cumulative_time"]) and not pd.isna(ahead.iloc[0]["cumulative_time"]):
                gap_ahead = round(float(row["cumulative_time"] - ahead.iloc[0]["cumulative_time"]), 2)

            if not behind.empty and not pd.isna(row["cumulative_time"]) and not pd.isna(behind.iloc[0]["cumulative_time"]):
                gap_behind = round(float(behind.iloc[0]["cumulative_time"] - row["cumulative_time"]), 2)

            gaps.append({
                "lap_number":    lap_num,
                "driver_id":     row["driver_id"],
                "position":      pos,
                "compound":      row["compound"],
                "tyre_life":     row["tyre_life"],
                "track_status":  row["track_status"],
                "lap_time":      row["lap_time_seconds"],
                "gap_to_ahead":  gap_ahead,
                "gap_to_behind": gap_behind,
            })

    return pd.DataFrame(gaps)


def _pit_recommendation(
    tyre_life: int,
    compound: str,
    gap_ahead: Optional[float],
    gap_behind: Optional[float],
    track_status: str,
    degrad_models: dict,
    lap_time: Optional[float],
    laps_remaining: int,
) -> dict:
    """
    Core pit window logic.
    Returns recommendation dict with action, reasoning, and viability flags.
    """
    # Determine effective pit loss based on track status
    if track_status in ("SC",):
        effective_pit_loss = SC_PIT_LOSS
        sc_note = " Safety Car is deployed — pit loss is minimal (~5s). "
    elif track_status in ("VSC",):
        effective_pit_loss = VSC_PIT_LOSS
        sc_note = " Virtual Safety Car — pit loss reduced (~12s). "
    else:
        effective_pit_loss = PIT_LOSS_SECONDS
        sc_note = ""

    # Estimate current tyre degradation loss vs fresh tyres
    # pace_delta = (current lap time - expected fresh tyre lap time)
    model = degrad_models.get(compound, {})
    pace_delta = 0.0
    if model.get("slope") and model.get("intercept") and lap_time:
        # Expected fresh lap time (tyre_life=MIN_LAPS_ON_TYRE)
        fresh_time = model["intercept"] + model["slope"] * MIN_LAPS_ON_TYRE
        pace_delta = max(0.0, lap_time - fresh_time)

    # Tyre fatigue signal: strongly degrade if life > 30
    tyre_old = tyre_life >= 30
    tyre_very_old = tyre_life >= 40

    # Undercut: can we gain on car ahead by pitting now?
    undercut_viable = False
    undercut_gain = 0.0
    if gap_ahead is not None and gap_ahead > 0:
        # After pit: fresh tyres gain pace_delta/lap vs opponent on older rubber
        # Over UNDERCUT_LAPS laps, we gain: pace_delta * UNDERCUT_LAPS - pit_loss
        undercut_gain = pace_delta * UNDERCUT_LAPS - effective_pit_loss
        undercut_viable = undercut_gain > 0 and gap_ahead < (pace_delta * UNDERCUT_LAPS)

    # Overcut: can we maintain position on tyres if car behind pits?
    overcut_viable = False
    if gap_behind is not None and gap_behind > 0:
        # If car behind pits (takes effective_pit_loss), gap becomes:
        # gap_behind + effective_pit_loss - (pace_delta * laps_on_new_rubber)
        # Overcut viable if that gap stays positive for a reasonable number of laps
        laps_to_close = effective_pit_loss / max(pace_delta, 0.1)
        overcut_viable = gap_behind > 0 and laps_to_close > 5

    # Generate recommendation
    if track_status == "SC" and tyre_life >= 5:
        action = "PIT_NOW"
        reasoning = (
            f"{sc_note}Safety Car eliminates almost all pit loss (~{effective_pit_loss}s). "
            f"On {compound} tyres aged {tyre_life} laps, pitting now for free position is the "
            f"dominant strategy. After SC ends, fresher tyres will be significantly faster."
        )
    elif track_status == "VSC" and tyre_very_old:
        action = "PIT_NOW"
        reasoning = (
            f"{sc_note}VSC cuts pit loss to ~{effective_pit_loss}s. "
            f"With {tyre_life}-lap-old {compound} tyres (very old), this is a strong pitting window."
        )
    elif tyre_very_old and laps_remaining > 5:
        action = "PIT_NOW"
        reasoning = (
            f"Tyres are {tyre_life} laps old — well past typical life. "
            f"Pace delta vs fresh rubber estimated at {pace_delta:.2f}s/lap. "
            f"With {laps_remaining} laps remaining, staying out risks further performance loss."
        )
    elif tyre_old and undercut_viable:
        action = "PIT_NOW"
        reasoning = (
            f"Undercut window viable: {UNDERCUT_LAPS}-lap gain estimated at "
            f"+{undercut_gain:.1f}s vs gap to car ahead of {gap_ahead:.1f}s. "
            f"Tyres aged {tyre_life} laps ({compound}) are past peak."
        )
    elif tyre_old and not undercut_viable and gap_ahead is not None and gap_ahead > 5:
        action = "STAY_OUT"
        reasoning = (
            f"Gap to car ahead is {gap_ahead:.1f}s — pitting now costs ~{effective_pit_loss}s "
            f"and likely surrenders position. Tyre degradation manageable for now."
        )
    elif pace_delta > 1.5 and laps_remaining > 8:
        action = "MARGINAL"
        reasoning = (
            f"Tyre degradation showing: ~{pace_delta:.2f}s/lap slower than fresh. "
            f"Strategic call depends on position security ({gap_behind or '?'}s behind). "
            f"Consider boxing in next 2-3 laps."
        )
    elif laps_remaining <= 5:
        action = "STAY_OUT"
        reasoning = (
            f"Only {laps_remaining} laps remaining — pit stop not worthwhile "
            f"unless there's a safety car. Stay out and manage pace."
        )
    else:
        action = "STAY_OUT"
        reasoning = (
            f"Tyres aged {tyre_life} laps ({compound}) within expected operating window. "
            f"Pace delta vs fresh rubber: {pace_delta:.2f}s/lap. No urgent strategic need to pit."
        )

    return {
        "action": action,
        "undercut_viable": undercut_viable,
        "overcut_viable": overcut_viable,
        "undercut_gain_estimate": round(undercut_gain, 2),
        "effective_pit_loss": effective_pit_loss,
        "pace_delta_vs_fresh": round(pace_delta, 3),
        "reasoning": reasoning,
    }


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.get("")
def strategy_index():
    return {"message": "Strategy optimizer ready", "endpoints": [
        "/strategy/tyre-degradation?race_id={id}",
        "/strategy/pit-window?race_id={id}&driver_id={id}&lap={n}",
        "/strategy/race-replay?race_id={id}&driver_id={id}",
    ]}


@router.get("/tyre-degradation")
def tyre_degradation(race_id: int = Query(...)):
    """
    Per-compound tyre degradation curve: avg lap time vs tyre age.
    Includes linear regression fit (slope = degradation rate).
    """
    conn = get_conn()
    race = conn.execute(
        "SELECT race_name, season_year, round_number, circuit_id FROM races WHERE race_id=?",
        (race_id,),
    ).fetchone()
    conn.close()
    if not race:
        raise HTTPException(404, "Race not found")

    df = _degradation_data(race_id)
    if df.empty:
        raise HTTPException(404, "No lap data for this race")

    compounds = [c for c in ["SOFT", "MEDIUM", "HARD", "INTER", "WET"] if c in df["compound"].unique()]
    result = []

    for compound in compounds:
        cdf = df[df["compound"] == compound].copy()
        # Remove outliers
        mean, std = cdf["lap_time_seconds"].mean(), cdf["lap_time_seconds"].std()
        cdf = cdf[abs(cdf["lap_time_seconds"] - mean) < 3 * std]

        # Bin by tyre_life
        by_life = (
            cdf.groupby("tyre_life")["lap_time_seconds"]
            .agg(avg_lap="mean", std_lap="std", n="count")
            .reset_index()
        )
        model = _fit_degradation(df, compound)
        has_fit = model["slope"] is not None and model["intercept"] is not None

        result.append({
            "compound": compound,
            "degradation_rate_per_lap": model["slope"],   # None = insufficient clean data
            "base_lap_time": model["intercept"],
            "data_points": model["n"],
            "curve": [
                {
                    "tyre_life": int(row["tyre_life"]),
                    "avg_lap_time": round(float(row["avg_lap"]), 3),
                    "std": round(float(row["std_lap"]), 3) if not pd.isna(row["std_lap"]) else None,
                    "n": int(row["n"]),
                    "fitted_lap_time": round(
                        model["intercept"] + model["slope"] * int(row["tyre_life"]), 3
                    ) if has_fit else None,
                }
                for _, row in by_life.iterrows()
            ],
        })

    return {
        "race_id":   race_id,
        "race_name": race["race_name"],
        "compounds": result,
    }


@router.get("/pit-window")
def pit_window(
    race_id:   int = Query(...),
    driver_id: str = Query(...),
    lap:       int = Query(..., description="Lap number to analyse"),
):
    """
    At a given lap, return current race state and pit window recommendation.
    """
    cache_key = (race_id, driver_id.upper(), lap)
    if cache_key in _pit_cache:
        return _pit_cache[cache_key]

    conn = get_conn()
    race = conn.execute(
        "SELECT race_name, total_laps, season_year FROM races WHERE race_id=?", (race_id,)
    ).fetchone()
    conn.close()
    if not race:
        raise HTTPException(404, "Race not found")

    did = driver_id.upper()
    total_laps = race["total_laps"] or 58

    # Get current lap state for the driver
    conn = get_conn()
    lap_row = conn.execute(
        """SELECT lap_number, lap_time_seconds, compound, tyre_life, position, track_status
           FROM lap_times WHERE race_id=? AND driver_id=? AND lap_number=?""",
        (race_id, did, lap),
    ).fetchone()

    # Grid position from race_results
    grid_row = conn.execute(
        "SELECT grid_position FROM race_results WHERE race_id=? AND driver_id=?",
        (race_id, did),
    ).fetchone()

    # Previous lap time (lap - 1) for lap delta display
    prev_lap_row = conn.execute(
        """SELECT lap_time_seconds FROM lap_times
           WHERE race_id=? AND driver_id=? AND lap_number=?""",
        (race_id, did, lap - 1),
    ).fetchone()
    conn.close()

    if not lap_row:
        raise HTTPException(404, f"No lap data for {did} at lap {lap}")

    grid_position = int(grid_row["grid_position"]) if grid_row and grid_row["grid_position"] else None
    prev_lap_time = float(prev_lap_row["lap_time_seconds"]) if prev_lap_row and prev_lap_row["lap_time_seconds"] else None

    # Compute gap series for this race
    gap_df = _compute_gap_series(race_id)
    gap_row = gap_df[(gap_df["driver_id"] == did) & (gap_df["lap_number"] == lap)]

    gap_ahead  = float(gap_row["gap_to_ahead"].iloc[0])  if not gap_row.empty and pd.notna(gap_row["gap_to_ahead"].iloc[0])  else None
    gap_behind = float(gap_row["gap_to_behind"].iloc[0]) if not gap_row.empty and pd.notna(gap_row["gap_to_behind"].iloc[0]) else None

    # Build degradation models for all compounds in this race
    degrad_df = _degradation_data(race_id)
    degrad_models = {
        c: _fit_degradation(degrad_df, c)
        for c in degrad_df["compound"].unique()
    }

    compound     = lap_row["compound"] or "UNKNOWN"
    tyre_life    = int(lap_row["tyre_life"] or 1)
    track_status = lap_row["track_status"] or "Green"
    lap_time     = float(lap_row["lap_time_seconds"]) if lap_row["lap_time_seconds"] else None
    laps_remaining = max(0, total_laps - lap)

    rec = _pit_recommendation(
        tyre_life=tyre_life,
        compound=compound,
        gap_ahead=gap_ahead,
        gap_behind=gap_behind,
        track_status=track_status,
        degrad_models=degrad_models,
        lap_time=lap_time,
        laps_remaining=laps_remaining,
    )

    result = {
        "race_id":        race_id,
        "race_name":      race["race_name"],
        "driver_id":      did,
        "lap":            lap,
        "total_laps":     total_laps,
        "laps_remaining": laps_remaining,
        "current_state": {
            "position":      int(lap_row["position"]) if lap_row["position"] else None,
            "compound":      compound,
            "tyre_life":     tyre_life,
            "lap_time":      lap_time,
            "track_status":  track_status,
            "gap_to_ahead":    gap_ahead,
            "gap_to_behind":   gap_behind,
            "grid_position":   grid_position,
            "prev_lap_time":   prev_lap_time,
        },
        "recommendation": rec,
    }
    _pit_cache[cache_key] = result
    return result


@router.get("/race-replay")
def race_replay(
    race_id:   int = Query(...),
    driver_id: str = Query(...),
):
    """
    Lap-by-lap strategy state for a whole race: position, tyre, gaps,
    pit recommendations, and actual pit stop laps.
    Used to replay strategy decision points in the UI.
    """
    conn = get_conn()
    race = conn.execute(
        "SELECT race_name, total_laps, season_year FROM races WHERE race_id=?", (race_id,)
    ).fetchone()
    if not race:
        conn.close()
        raise HTTPException(404, "Race not found")

    did = driver_id.upper()
    total_laps = race["total_laps"] or 58

    # Actual pit stops for this driver
    pit_laps = {
        row["lap_number"]: row
        for row in conn.execute(
            "SELECT lap_number, compound_in, compound_out, pit_duration_seconds FROM pit_stops WHERE race_id=? AND driver_id=?",
            (race_id, did),
        ).fetchall()
    }

    # Get all driver/competitor info
    conn.close()

    gap_df     = _compute_gap_series(race_id)
    degrad_df  = _degradation_data(race_id)
    degrad_models = {
        c: _fit_degradation(degrad_df, c)
        for c in degrad_df["compound"].unique()
    }

    driver_gaps = gap_df[gap_df["driver_id"] == did].sort_values("lap_number")
    if driver_gaps.empty:
        raise HTTPException(404, f"No lap data for driver {did} in race {race_id}")

    replay = []
    for _, row in driver_gaps.iterrows():
        lap_num      = int(row["lap_number"])
        compound     = row["compound"] or "UNKNOWN"
        tyre_life    = int(row["tyre_life"]) if not pd.isna(row["tyre_life"]) else 1
        track_status = row["track_status"] or "Green"
        lap_time     = float(row["lap_time"]) if not pd.isna(row["lap_time"]) else None
        gap_ahead    = float(row["gap_to_ahead"])  if not pd.isna(row["gap_to_ahead"])  else None
        gap_behind   = float(row["gap_to_behind"]) if not pd.isna(row["gap_to_behind"]) else None
        laps_remaining = max(0, total_laps - lap_num)

        rec = _pit_recommendation(
            tyre_life=tyre_life, compound=compound,
            gap_ahead=gap_ahead, gap_behind=gap_behind,
            track_status=track_status, degrad_models=degrad_models,
            lap_time=lap_time, laps_remaining=laps_remaining,
        )

        # Actual pit this lap?
        pit = pit_laps.get(lap_num)
        actual_pit = {
            "compound_in":  pit["compound_in"],
            "compound_out": pit["compound_out"],
            "duration_sec": round(float(pit["pit_duration_seconds"]), 2) if pit["pit_duration_seconds"] else None,
        } if pit else None

        replay.append({
            "lap":             lap_num,
            "position":        int(row["position"]) if not pd.isna(row["position"]) else None,
            "compound":        compound,
            "tyre_life":       tyre_life,
            "lap_time":        round(lap_time, 3) if lap_time else None,
            "track_status":    track_status,
            "gap_to_ahead":    gap_ahead,
            "gap_to_behind":   gap_behind,
            "laps_remaining":  laps_remaining,
            "recommendation":  rec["action"],
            "undercut_viable": rec["undercut_viable"],
            "pace_delta":      rec["pace_delta_vs_fresh"],
            "actual_pit":      actual_pit,
        })

    return {
        "race_id":   race_id,
        "race_name": race["race_name"],
        "driver_id": did,
        "total_laps": total_laps,
        "laps": replay,
    }
