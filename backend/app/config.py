import os
from pathlib import Path

from dotenv import load_dotenv

# 固定從 backend 目錄載入 .env，不受啟動時工作目錄影響
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

# 資料庫（必填：PostgreSQL 連線字串，例：Neon）
_DATABASE_URL = os.getenv("DATABASE_URL")
if not _DATABASE_URL:
    raise ValueError(
        "DATABASE_URL environment variable is required. "
        "Use a PostgreSQL connection string (e.g. from Neon: postgresql+asyncpg://user:password@host/dbname?sslmode=require)"
    )
DATABASE_URL = _DATABASE_URL
DEBUG_LOG_PATH = BASE_DIR / "debug.log"

# OpenWeather API
OPENWEATHER_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
OPENWEATHER_BASE = "https://api.openweathermap.org/data/2.5"

# OpenAI / LangChain
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")

# Google Maps Elevation API（後端環境診斷用，需在 Cloud Console 啟用 Elevation API）
GOOGLE_MAPS_API_KEY = os.getenv("GOOGLE_MAPS_API_KEY", "")

# CORS：逗號分隔的允許來源，例如 http://localhost:5173,https://app.example.com。留空則用 * 且不送 credentials
_CORS_ORIGINS_RAW = os.getenv("CORS_ORIGINS", "http://localhost:5173").strip()
CORS_ORIGINS: list[str] = [o.strip() for o in _CORS_ORIGINS_RAW.split(",") if o.strip()] if _CORS_ORIGINS_RAW else []

# 資料庫連線是否使用 SSL（Neon 等雲端必填 True；本地 Postgres 可設 False）
_DB_USE_SSL = os.getenv("DB_USE_SSL", "true").lower()
DB_USE_SSL = _DB_USE_SSL in ("1", "true", "yes")

# 模擬起點 (預設台北)；若 .env 格式錯誤則使用預設值並記錄
def _parse_float_env(name: str, default: str) -> float:
    raw = os.getenv(name, default)
    try:
        return float(raw)
    except (TypeError, ValueError):
        import logging
        logging.getLogger(__name__).warning(
            "Invalid %s=%r, using default %s. Use a numeric value in .env.", name, raw, default
        )
        try:
            return float(default)
        except (TypeError, ValueError):
            return 25.0330 if "LAT" in name else 121.5654


SIM_LAT = _parse_float_env("SIM_LAT", "25.0330")
SIM_LNG = _parse_float_env("SIM_LNG", "121.5654")
