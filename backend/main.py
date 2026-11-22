"""Vercel / Uvicorn Root Entrypoint for SurplusPulse API."""
import os
import uvicorn

if "SURPLUSPULSE_API_KEY" not in os.environ and os.environ.get("SURPLUSPULSE_ENV", "").lower() not in ("production", "prod"):
    os.environ["SURPLUSPULSE_API_KEY"] = "surpluspulse-demo-key-2026"

from app.main import app

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    uvicorn.run("app.main:app", host=host, port=port, log_level="info")

__all__ = ["app"]
