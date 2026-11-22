"""SurplusPulse Configuration Settings.
Centralized environment and operational parameters via Pydantic BaseSettings.
"""
from __future__ import annotations

from pathlib import Path
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_title: str = "SurplusPulse API"
    app_version: str = "1.0.0"
    db_path: Path = Path(__file__).resolve().parent.parent / "surpluspulse.db"
    cors_origins: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]
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
