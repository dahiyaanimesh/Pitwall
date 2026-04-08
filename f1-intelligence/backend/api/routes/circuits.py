"""
Circuit track map proxy — fetches from Multiviewer API server-side
to avoid browser CORS restrictions.
"""

import logging
from fastapi import APIRouter
import httpx

router = APIRouter()
log = logging.getLogger(__name__)

MULTIVIEWER_BASE = "https://api.multiviewer.app/api/v1/circuits"


@router.get("/track-map/{circuit_key}/{year}")
async def get_track_map(circuit_key: int, year: int):
    """
    Proxy for Multiviewer circuit track map data.
    Returns {x: [...], y: [...]} coordinate arrays or {error: str}.
    """
    async with httpx.AsyncClient(timeout=8.0) as client:
        for y in [year, year - 1, year + 1]:
            try:
                res = await client.get(f"{MULTIVIEWER_BASE}/{circuit_key}/{y}")
                if res.status_code == 200:
                    data = res.json()
                    if "x" in data and "y" in data:
                        return {"x": data["x"], "y": data["y"]}
            except Exception as e:
                log.debug(f"Track map fetch failed for key={circuit_key} year={y}: {e}")
    return {"error": "not found"}
