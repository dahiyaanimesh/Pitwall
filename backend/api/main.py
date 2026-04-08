"""
Pitwall — FastAPI Application
"""

from contextlib import asynccontextmanager
import os
import sqlite3
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routes import races, drivers, predictions, strategy, dashboard, weather, tires, circuits

# Allow DB path override via env var (for Render persistent disk)
DB_PATH = Path(os.environ.get("DB_PATH", str(Path(__file__).resolve().parent.parent / "database" / "f1.db")))


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify DB connection
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("SELECT 1")
        conn.close()
        print(f"[startup] DB connection verified: {DB_PATH}")
    except Exception as e:
        print(f"[startup] WARNING: DB connection failed: {e}")
    yield
    # Shutdown: nothing to clean up


app = FastAPI(
    title="Pitwall",
    description="Formula 1 data analytics and ML API",
    version="1.0.0",
    lifespan=lifespan,
)

_cors_origins = os.environ.get(
    "CORS_ORIGINS",
    "http://localhost:3000,http://localhost:5173",
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Routers ---
app.include_router(races.router, prefix="/races", tags=["races"])
app.include_router(drivers.router, prefix="/drivers", tags=["drivers"])
app.include_router(predictions.router, prefix="/predictions", tags=["predictions"])
app.include_router(strategy.router, prefix="/strategy", tags=["strategy"])
app.include_router(dashboard.router, prefix="/dashboard", tags=["dashboard"])
app.include_router(weather.router,    prefix="/weather",    tags=["weather"])
app.include_router(tires.router,      prefix="/tires",      tags=["tires"])
app.include_router(circuits.router,   prefix="/circuits",   tags=["circuits"])


@app.get("/health")
def health_check():
    try:
        conn = sqlite3.connect(DB_PATH)
        conn.execute("SELECT 1")
        conn.close()
        db_status = "connected"
    except Exception:
        db_status = "disconnected"
    return {"status": "ok", "db": db_status}
