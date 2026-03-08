"""Google Maps Elevation API：取得指定經緯度的地表海拔，供環境診斷判斷是否處於爬升／翻山階段。"""
import logging
from typing import Any

import httpx

from app.config import GOOGLE_MAPS_API_KEY

logger = logging.getLogger(__name__)
ELEVATION_BASE = "https://maps.googleapis.com/maps/api/elevation/json"


async def get_elevation(lat: float, lng: float) -> dict[str, Any]:
    """
    取得指定經緯度的地表海拔（公尺）與解析度。
    失敗時回傳安全預設值並記錄 log。
    """
    logger.info("get_elevation called: lat=%.4f lng=%.4f", lat, lng)
    if not GOOGLE_MAPS_API_KEY:
        logger.warning("GOOGLE_MAPS_API_KEY not set, elevation unavailable")
        return {"elevation_m": 0.0, "resolution_m": 0.0}

    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(
                ELEVATION_BASE,
                params={"locations": f"{lat},{lng}", "key": GOOGLE_MAPS_API_KEY},
                timeout=10.0,
            )
            r.raise_for_status()
            data = r.json()
        if data.get("status") != "OK" or not data.get("results"):
            logger.warning("Elevation API returned no results: %s", data.get("status"))
            return {"elevation_m": 0.0, "resolution_m": 0.0}
        first = data["results"][0]
        elev_m = float(first.get("elevation", 0))
        res_m = float(first.get("resolution", 0))
        logger.info("get_elevation success: elevation_m=%.1f resolution_m=%.1f", elev_m, res_m)
        return {"elevation_m": elev_m, "resolution_m": res_m}
    except Exception as e:
        logger.exception("Elevation API error: %s", e)
        return {"elevation_m": 0.0, "resolution_m": 0.0}
