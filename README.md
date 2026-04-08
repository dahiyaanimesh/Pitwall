# Pitwall
### F1 Race Analytics & Strategy Intelligence

End-to-end Formula 1 analytics platform covering four seasons of race data (2021–2024) with machine learning predictions and a strategy optimizer.

**Live demo:** [pitwall.dahiyaanimesh.co.in](https://pitwall.dahiyaanimesh.co.in)  
**Stack:** FastAPI · SQLite · FastF1 · scikit-learn · XGBoost · React · TypeScript · Recharts

---

## What this answers

> *Can data tell us what the winning strategy was — and when the race was decided?*

The 2021 Abu Dhabi Grand Prix ended the championship on the final lap after a Safety Car controversy. Pitwall reconstructs every decision point: tyre degradation, pit windows, overperformance gaps, and the model's recommendation at lap 54 when Max Verstappen pitted for fresh SOFT tyres and Lewis Hamilton stayed out on 41-lap-old HARDs.

---

## Architecture

```
┌────────────────────────────────────────────────────────────┐
│  FastF1 (telemetry & timing data)                          │
│     └─ ETL pipeline ──► SQLite (f1.db, ~10 MB)            │
│           90 races · 98K+ laps · 3,400+ pit stops         │
│           2021 · 2022 · 2023 · 2024                        │
└───────────────────────┬────────────────────────────────────┘
                        │
             ┌──────────▼──────────┐
             │   FastAPI backend   │  port 8010
             │  /races  /drivers   │
             │  /predictions       │
             │  /strategy          │
             │  /weather  /tires   │
             └──────────┬──────────┘
                        │  HTTP / JSON
             ┌──────────▼──────────┐
             │  React + TypeScript │  port 5173
             │  Vite · Tailwind    │
             │  Recharts · SHAP    │
             └─────────────────────┘
```

**Data flow:**
1. `python backend/etl/etl.py --seasons 2021 2022 2023 2024` pulls timing data from FastF1 cache
2. Lap times → finish positions via `derive_finish_order()`
3. Qualifying laps → grid positions via `derive_grid_from_quali_laps()`
4. `python backend/ml/train.py --season 2021` trains the models per season
5. React frontend fetches from FastAPI, renders with Recharts + custom SVG components

---

## Key findings — 2021 Season

| Metric | Value |
|---|---|
| Championship points gap | **11 pts** (395 vs 384) |
| Different race winners | 6 |
| Regressor MAE (test set R18–R22) | **3.3 positions** |
| Abu Dhabi lap 54 recommendation | **PIT_NOW** |
| SOFT tyre degradation (Abu Dhabi) | +47ms/lap |
| HARD tyre degradation (Abu Dhabi) | +5.7ms/lap |
| VER overperformance score | +1.2 places/race vs grid |

---

## Tech stack

| Layer | Technology | Why |
|---|---|---|
| Data ingestion | [FastF1](https://docs.fastf1.dev/) | Only reliable source of F1 timing data post-Ergast shutdown |
| Storage | SQLite (WAL mode) | Zero infra, full SQL, ~10 MB for four seasons |
| API | FastAPI + Uvicorn | Auto-generated OpenAPI docs, async-capable |
| ML | scikit-learn · XGBoost | Interpretable, fast to train on small datasets |
| Explainability | SHAP TreeExplainer | Per-prediction feature attribution in the UI |
| Frontend | React 18 + TypeScript + Vite | Fast DX, full type safety |
| Styling | Tailwind CSS (dark theme) | Rapid iteration, consistent design system |
| Charts | Recharts + custom SVG | Recharts for standard charts, custom SVG for SHAP waterfall |

---

## Running locally

**Prerequisites:** Python 3.10+, Node 18+

```bash
git clone https://github.com/dahiyaanimesh/pitwall
cd pitwall/f1-intelligence

# Backend
pip install -r requirements.txt
uvicorn backend.api.main:app --port 8010 --reload

# Frontend (new terminal)
cd pitwall/f1-intelligence/frontend
npm install
npm run dev    # http://localhost:5173
```

The DB (`backend/database/f1.db`) is committed to the repo — no ETL needed to run locally.

To rebuild from scratch:
```bash
python backend/etl/etl.py --seasons 2021 2022 2023 2024   # ~20 min, caches FastF1 data
python backend/ml/train.py --season 2021                   # repeat per season
```

---

## ML model

**Problem:** Predict each driver's finishing position before the race starts.

**Features (9 total):**

| Feature | What it captures |
|---|---|
| `grid_position` | Starting advantage / disadvantage |
| `avg_finish_last3` | Recent form (3-race rolling window) |
| `avg_points_last3` | Points momentum |
| `dnf_rate_last3` | Reliability risk |
| `avg_consistency_last3` | Lap time variance |
| `circuit_type` | Street circuit vs permanent track |
| `circuit_history_avg_finish` | Driver's historical performance at this venue |
| `team_avg_finish_last3` | Team car performance trend |
| `team_points_last3` | Team development trajectory |

**Training split:** Rounds 1–17 (train) → Rounds 18–22 (test). Temporal split prevents leakage from future races.

**Two models:**
- **Regressor** — predicts exact finish position. Test MAE ~3.3 positions.
- **Classifier** — predicts podium probability (top 3). Test accuracy ~72%.

Each prediction in the UI includes a SHAP waterfall chart showing which features drove the result.

---

## Strategy optimizer

The pit window engine models three decisions:

**1. Tyre degradation** — linear regression of lap time vs tyre age per compound. At Abu Dhabi 2021, SOFT tyres degraded 8× faster than HARDs.

**2. Pit window** — at any lap, compares the cost of pitting (22s normal / 12s VSC / 5s SC) against pace loss from aged tyres. Returns `PIT_NOW / MARGINAL / STAY_OUT` with reasoning.

**3. Race replay** — runs the model across every lap, overlays actual pit stops vs model recommendations, and flags SC/VSC periods.

**Abu Dhabi, lap 54:**
```
Status: Safety Car deployed
HAM: HARD compound, 41 laps old. Effective pit loss: ~5s
Model output: PIT_NOW
"Safety Car eliminates almost all pit loss. On HARD tyres
aged 41 laps, pitting now for free position is the
dominant strategy."
```
Hamilton stayed out. Verstappen pitted. The rest is history.

---

## Project structure

```
pitwall/
├── backend/
│   ├── api/
│   │   ├── main.py              # FastAPI app, CORS, router registration
│   │   └── routes/
│   │       ├── dashboard.py     # Season summary
│   │       ├── drivers.py       # Performance analytics
│   │       ├── predictions.py   # ML prediction endpoints
│   │       ├── races.py         # Race results & lap data
│   │       ├── strategy.py      # Tyre degradation & pit window
│   │       ├── tires.py         # Compound breakdown per race
│   │       ├── weather.py       # Track conditions per session
│   │       └── circuits.py      # Track map SVG data
│   ├── database/
│   │   ├── schema.sql           # 10-table SQLite schema
│   │   └── f1.db                # ~10 MB, 2021–2024 race data
│   ├── etl/
│   │   └── etl.py               # FastF1 ingestion pipeline
│   └── ml/
│       ├── train.py             # Feature engineering + model training
│       ├── shap_explainer.py    # SHAP wrapper, per-driver explanations
│       └── models/              # Trained .pkl files + metrics JSON
├── frontend/
│   └── src/
│       ├── components/          # Shared + feature-specific components
│       ├── hooks/               # Data fetching (one hook per API route)
│       ├── pages/               # Dashboard, Drivers, Predictions, Strategy, Tires, Weather
│       └── types/               # TypeScript interfaces matching API shapes
└── requirements.txt
```

---

## Known limitations

- Sprint race points are excluded — FastF1 does not expose sprint results in the same session format. Points totals for 2022–2024 will be lower than official standings for affected drivers.
- Qualifying data is derived from lap times, not official classification. Rare edge cases (penalties, impeded laps) may produce incorrect grid positions.

---

## What's next

- [ ] Live race mode: stream lap times during a race weekend
- [ ] Driver head-to-head comparison page
- [ ] 2025 season support
