# Pitwall
### F1 Race Analytics & Strategy Intelligence

End-to-end Formula 1 analytics platform covering four seasons of race data (2021–2024) with machine learning race predictions and a lap-by-lap strategy optimizer.

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=flat&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.135-009688?style=flat&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat&logo=typescript&logoColor=white)

**Live demo:** [pitwall.dahiyaanimesh.co.in](https://pitwall.dahiyaanimesh.co.in)

---

## Overview

> *Can data tell us what the winning strategy was — and when the race was decided?*

The 2021 Abu Dhabi Grand Prix ended the championship on the final lap after a Safety Car controversy. Pitwall reconstructs every decision point across the entire season: tyre degradation curves, pit windows, driver overperformance scores, and model recommendations. At lap 54 — when Verstappen pitted for fresh SOFT tyres and Hamilton stayed out on 41-lap-old HARDs — the model output was unambiguous: **PIT_NOW**.

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
1. `python backend/etl/etl.py --seasons 2021 2022 2023 2024` pulls timing data from the FastF1 cache (~20 min)
2. Lap times → finish positions via `derive_finish_order()`
3. Qualifying laps → grid positions via `derive_grid_from_quali_laps()`
4. `python backend/ml/train.py --season <year>` trains models per season; repeat for each of 2021–2024
5. Pre-computed SHAP values are exported to `.parquet` files alongside the trained `.pkl` models
6. React frontend fetches from FastAPI and renders with Recharts, custom SVG components, and SHAP waterfall charts

---

## Tech stack

| Layer          | Technology                              | Why                                                                         |
| -------------- | --------------------------------------- | --------------------------------------------------------------------------- |
| Data ingestion | [FastF1](https://docs.fastf1.dev/)      | Only reliable source of F1 timing data post-Ergast shutdown                 |
| Storage        | SQLite (WAL mode)                       | Zero infra, full SQL, ~10 MB for four seasons                               |
| API            | FastAPI + Uvicorn                       | Auto-generated OpenAPI docs, async-capable                                  |
| ML             | scikit-learn · XGBoost                  | Interpretable, fast to train on small tabular datasets                      |
| Explainability | SHAP TreeExplainer                      | Per-prediction feature attribution surfaced in the UI                       |
| Frontend       | React 18 + TypeScript + Vite            | Fast dev experience, full type safety                                       |
| Styling        | Tailwind CSS                            | Rapid iteration, consistent dark design system                              |
| Animation      | Framer Motion · GSAP                    | Page transitions and count-up stat animations                               |
| Charts         | Recharts + custom SVG                   | Recharts for standard charts; custom SVG for Gantt timelines and SHAP plots |
| Icons          | Lucide React                            | Consistent icon set, tree-shakeable                                         |

---

## Key findings — 2021 season

| Metric                               | Value                       |
| ------------------------------------ | --------------------------- |
| Championship points gap              | **11 pts** (395 vs 384)     |
| Different race winners               | 6                           |
| Regressor MAE (test set R18–R22)     | **3.3 positions**           |
| Classifier accuracy (podium, top 3)  | **~72%**                    |
| Abu Dhabi lap 54 recommendation      | **PIT_NOW**                 |
| SOFT tyre degradation (Abu Dhabi)    | +47 ms/lap                  |
| HARD tyre degradation (Abu Dhabi)    | +5.7 ms/lap                 |
| VER overperformance score            | +1.2 places/race vs grid    |

---

## Running locally

**Prerequisites:** Python 3.10+, Node 18+

```bash
git clone https://github.com/dahiyaanimesh/Pitwall
cd Pitwall

# Backend
pip install -r requirements.txt
uvicorn backend.api.main:app --port 8010 --reload

# Frontend (new terminal)
cd frontend
npm install
npm run dev    # http://localhost:5173
```

The database (`backend/database/f1.db`) is committed to the repo — no ETL run is needed to start the app.

To rebuild from scratch:
```bash
python backend/etl/etl.py --seasons 2021 2022 2023 2024
python backend/ml/train.py --season 2021   # repeat for 2022, 2023, 2024
```

---

## ML model

**Problem:** Predict each driver's finishing position before race start using only information available at that point in the season.

**Features (9 total):**

| Feature                       | What it captures                                  |
| ----------------------------- | ------------------------------------------------- |
| `grid_position`               | Starting advantage / disadvantage                 |
| `avg_finish_last3`            | Recent form (3-race rolling window)               |
| `avg_points_last3`            | Points momentum                                   |
| `dnf_rate_last3`              | Reliability risk                                  |
| `avg_consistency_last3`       | Lap time variance                                 |
| `circuit_type`                | Street circuit vs permanent track                 |
| `circuit_history_avg_finish`  | Driver's historical performance at this venue     |
| `team_avg_finish_last3`       | Team car performance trend                        |
| `team_points_last3`           | Team development trajectory                       |

**Training split:** Rounds 1–17 (train) → Rounds 18–22 (test). Temporal split prevents data leakage from future races.

**Two models per season:**
- **Regressor** — predicts exact finish position. Test MAE ~3.3 positions.
- **Classifier** — predicts podium probability (top 3). Test accuracy ~72%.

Each prediction in the UI includes a SHAP waterfall chart showing which features drove the result for that driver and race.

---

## Strategy optimizer

The pit window engine models three decisions per lap:

**1. Tyre degradation** — linear regression of lap time delta vs tyre age per compound. At Abu Dhabi 2021, SOFT tyres degraded 8× faster than HARDs.

**2. Pit window** — at any lap, compares the cost of pitting (22s normal / 12s VSC / 5s SC) against the projected pace loss from continued tyre age. Returns `PIT_NOW / MARGINAL / STAY_OUT` with a plain-English explanation.

**3. Race replay** — runs the model across every lap of a chosen race, overlays actual pit stops against model recommendations, and flags Safety Car and Virtual Safety Car periods.

**Abu Dhabi 2021, lap 54:**
```
Status: Safety Car deployed
HAM: HARD compound, 41 laps old. Effective pit loss: ~5s
Model output: PIT_NOW
"Safety Car eliminates almost all pit loss. On HARD tyres aged 41 laps,
pitting now for a free position is the dominant strategy."
```
Hamilton stayed out. Verstappen pitted. The rest is history.

---

## Project structure

```
Pitwall/
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
│       └── models/              # Trained .pkl files, SHAP .parquet exports, metrics JSON
├── frontend/
│   └── src/
│       ├── components/          # Shared + feature-specific components
│       ├── context/             # SeasonContext (global season selector)
│       ├── data/                # Static editorial and chart data
│       ├── hooks/               # Data fetching (one hook per API route)
│       ├── pages/               # Dashboard, Drivers, Predictions, Strategy, Tires, Weather
│       ├── types/               # TypeScript interfaces matching API shapes
│       └── utils/               # Shared helpers (formatters, colour maps)
└── requirements.txt
```

---

## Known limitations

- **Sprint races excluded** — FastF1 does not expose sprint results in the same session format as main races. Points totals for 2022–2024 will be lower than official standings for affected drivers.
- **Qualifying derived from lap times** — grid positions are inferred from fastest qualifying lap, not official classification. Rare edge cases (grid penalties, impeded laps) may produce incorrect starting positions.
- **Static predictions** — ML models are trained offline per season. There is no live inference during a race weekend.

---

## Roadmap

- Live race mode: stream lap times during a race weekend
- Driver head-to-head comparison page
- 2025 season support
