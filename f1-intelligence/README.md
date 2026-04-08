# Pitwall
### F1 Race Analytics & Strategy Intelligence

End-to-end Formula 1 analytics and machine-learning platform built on the 2021 season — the closest championship in modern F1 history.

**Live demo:** _coming soon_  
**Stack:** FastAPI · SQLite · FastF1 · scikit-learn · React · TypeScript · Recharts

---

## What question does this answer?

> *Can data tell us what the winning strategy was — and when the race was decided?*

The 2021 Abu Dhabi Grand Prix ended the championship on the final lap after a Safety Car controversy. Pitwall reconstructs every decision point: tyre degradation, pit windows, overperformance gaps, and the model's recommendation at lap 54 when Max Verstappen pitted for fresh SOFT tyres and Lewis Hamilton stayed out on 41-lap-old HARDs.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  FastF1 (timing data)                                        │
│     └─ ETL pipeline ──► SQLite (f1.db, ~50 MB)              │
│           22 races · 440K+ laps · 2,200+ pit stops          │
└────────────────────────┬────────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │   FastAPI backend   │  port 8003
              │  /races  /drivers   │
              │  /predictions       │
              │  /strategy          │
              │  /dashboard         │
              └──────────┬──────────┘
                         │  HTTP / JSON
              ┌──────────▼──────────┐
              │  React + TypeScript │  port 5173
              │  Vite · Tailwind    │
              │  Recharts · SHAP    │
              └─────────────────────┘
```

**Data flow:**
1. `python backend/etl/etl.py --seasons 2021` pulls raw timing from FastF1 cache
2. Lap times → finish positions via `derive_finish_order()` (no Ergast API needed)
3. Qualifying laps → grid positions via `derive_grid_from_quali_laps()`
4. `python backend/ml/train.py --season 2021` trains the Random Forest models
5. React frontend fetches from FastAPI, renders with Recharts + custom SVG components

---

## Key findings — 2021 Season

| Finding | Value |
|---|---|
| Championship points gap | **11 pts** (395 vs 384) |
| Races held | 22 |
| Different race winners | 6 |
| Regressor MAE (test set R18–R22) | **3.3 positions** |
| Abu Dhabi lap 54 recommendation | **PIT_NOW** (SC, pit loss ~5s) |
| SOFT tyre degradation rate (Abu Dhabi) | +47ms/lap |
| HARD tyre degradation rate (Abu Dhabi) | +5.7ms/lap |
| VER overperformance score | +1.2 places/race vs grid |

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Data ingestion | [FastF1](https://docs.fastf1.dev/) | Only reliable source of F1 timing data post-Ergast shutdown |
| Storage | SQLite (WAL mode) | Zero infra, full SQL, ~50 MB for a full season |
| API | FastAPI + Uvicorn | Auto-generated OpenAPI docs, async-capable |
| ML | scikit-learn RandomForest | Interpretable, fast to train on 340 training rows |
| Explainability | SHAP TreeExplainer | Per-prediction feature attribution in the UI |
| Frontend | React 18 + TypeScript + Vite | Fast DX, full type safety |
| Styling | Tailwind CSS (dark theme) | Rapid iteration, consistent design system |
| Charts | Recharts + custom SVG | Recharts for standard charts, custom SVG for SHAP waterfall |

---

## How to run locally

**Prerequisites:** Python 3.10+, Node 18+

```bash
# Clone
git clone https://github.com/dahiyaanimesh/pitwall
cd pitwall

# Backend
pip install -r requirements.txt
python backend/etl/etl.py --seasons 2021        # ~5 min, downloads FastF1 cache
python backend/ml/train.py --season 2021         # trains RF + XGBoost models
python -m uvicorn backend.api.main:app --port 8003 --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev                                       # http://localhost:5173
```

The ETL caches FastF1 data at `backend/cache/` so subsequent runs are instant.

---

## How the ML model works

**Problem:** Predict each driver's finishing position for a race they haven't run yet.

**Features (9 total):**

| Feature | What it captures |
|---|---|
| `grid_position` | Starting advantage / disadvantage |
| `avg_finish_last3` | Recent form (3-race rolling window) |
| `avg_points_last3` | Points momentum |
| `dnf_rate_last3` | Reliability risk |
| `avg_consistency_last3` | Lap time variance (lower = more consistent) |
| `circuit_type` | Street circuit vs permanent track |
| `circuit_history_avg_finish` | Driver's historical performance at this venue |
| `team_avg_finish_last3` | Team car performance trend |
| `team_points_last3` | Team development trajectory |

**Training split:** Rounds 1–17 (train) → Rounds 18–22 (test). Temporal split prevents data leakage from future races.

**Two models:**
- **Regressor** (RandomForest): predicts exact finish position. Test MAE ~3.3 positions.
- **Classifier** (RandomForest): predicts podium probability (top 3). Test accuracy ~72%.

**SHAP explainability:** Each prediction in the UI shows a waterfall chart breaking down which features pushed the predicted finish up or down — grid position is typically the strongest signal.

---

## Strategy optimizer

The pit window engine models three decisions:

1. **Tyre degradation:** Linear regression of lap time vs tyre life per compound. SOFT tyres at Abu Dhabi degraded 8× faster than HARDs (+47ms/lap vs +5.7ms/lap).

2. **Pit window:** At any lap, compares the cost of pitting (22s normal, 12s VSC, 5s SC) against the pace loss from old tyres. Outputs `PIT_NOW / MARGINAL / STAY_OUT` with reasoning.

3. **Race replay:** Runs the pit window model across every lap of the race, highlights actual pit stops vs model recommendations, and flags SC/VSC periods.

**The Abu Dhabi moment (lap 54):**
```
Status: Safety Car deployed
HAM: HARD compound, 41 laps old
Effective pit loss: ~5s (SC discount)
Model output: PIT_NOW
Reasoning: "Safety Car eliminates almost all pit loss (~5s). 
On HARD tyres aged 41 laps, pitting now for free position 
is the dominant strategy."
```
Hamilton stayed out. Verstappen pitted. The rest is history.

---

## Project structure

```
f1-intelligence/
├── backend/
│   ├── api/
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   └── routes/
│   │       ├── dashboard.py     # Season summary endpoint
│   │       ├── drivers.py       # Performance analytics endpoints
│   │       ├── predictions.py   # ML prediction endpoints
│   │       ├── races.py         # Race results endpoints
│   │       └── strategy.py      # Tyre degradation & pit window
│   ├── database/
│   │   ├── schema.sql           # 10-table SQLite schema
│   │   └── f1.db                # ~50 MB, all 2021 race data
│   ├── etl/
│   │   └── etl.py               # FastF1 ingestion pipeline
│   └── ml/
│       ├── train.py             # Feature engineering + model training
│       └── shap_explainer.py    # SHAP wrapper, per-driver explanations
├── frontend/
│   └── src/
│       ├── components/          # Shared + feature-specific components
│       ├── hooks/               # Data fetching hooks (one per API)
│       ├── pages/               # Dashboard, Drivers, Predictions, Strategy
│       └── types/               # TypeScript interfaces matching API shapes
└── requirements.txt
```

---

## Known limitations

- **Points totals reflect race results only.** Sprint race points are excluded (FastF1 does not expose sprint results in the same session format). The points gap vs official standings is ~38pts for 2024 (6 sprint events).

---

## What's next

- [ ] Multi-season support (2022–2024 backfill via `--seasons 2022 2023 2024`)
- [ ] Live race mode: stream lap times during a race weekend
- [ ] XGBoost ensemble replacing single RandomForest
- [ ] Driver head-to-head comparison page
- [ ] Deployment: Render (backend) + Vercel (frontend)
