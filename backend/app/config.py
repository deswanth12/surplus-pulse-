"""SurplusPulse Configuration Settings.
Centralized environment and operational parameters via Pydantic BaseSettings.
"""
from __future__ import annotations

import os
import shutil
import tempfile
from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


def get_default_db_path() -> Path:
    default_path = Path(__file__).resolve().parent.parent / "surpluspulse.db"
    if os.getenv("VERCEL"):
        tmp_dir = Path(tempfile.gettempdir())
        tmp_dir.mkdir(parents=True, exist_ok=True)
        tmp_path = tmp_dir / "surpluspulse.db"
        if not tmp_path.exists() and default_path.exists():
            try:
                shutil.copy2(default_path, tmp_path)
            except Exception:
                pass
        return tmp_path
    return default_path


def get_default_cors_origins() -> list[str]:
    origins = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
    frontend_binding = os.getenv("FRONTEND_URL")
    if frontend_binding and frontend_binding not in origins:
        origins.append(frontend_binding)
    vercel_url = os.getenv("VERCEL_URL")
    if vercel_url:
        origins.append(f"https://{vercel_url}")
    return origins


class Settings(BaseSettings):
    app_title: str = "SurplusPulse API"
    app_version: str = "1.0.0"
    db_path: Path = get_default_db_path()
    cors_origins: list[str] = get_default_cors_origins()
    mirage_enabled: bool = True
    max_upload_size_bytes: int = 10 * 1024 * 1024  # 10 MB
    cache_max_size: int = 1000
    cache_impact_ttl_seconds: int = 60
    cache_directory_ttl_seconds: int = 300
    cache_mirage_ttl_seconds: int = 86400  # 24 hours
    api_key: Optional[str] = None
    admin_secret: Optional[str] = None

    model_config = SettingsConfigDict(
        env_prefix="SURPLUSPULSE_",
        case_sensitive=False,
    )


settings = Settings()
