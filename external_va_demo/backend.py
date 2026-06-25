"""Standalone external VA backend demo.

This file simulates a third-party VA system importing this repository's SDK.
"""

from pathlib import Path
import sys
from typing import Any, Dict, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Make repo imports work when launched from this subfolder.
REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(REPO_ROOT))

from packages.widget_sdk import create_custom_widget_analyzer  # noqa: E402


app = FastAPI(title="External VA Demo Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class AnalyzeRequest(BaseModel):
    query: str
    vega_spec: Dict[str, Any]
    model_name: Optional[str] = None
    input_mode: str = "text_and_image"
    max_iterations: int = 6


@app.get("/api/health")
async def health() -> Dict[str, Any]:
    return {"ok": True}


@app.post("/api/analyze")
async def analyze(req: AnalyzeRequest) -> Dict[str, Any]:
    async with create_custom_widget_analyzer(req.vega_spec) as analyzer:
        result = await analyzer.run(
            req.query,
            model_name=req.model_name,
            input_mode=req.input_mode,
            max_iterations=req.max_iterations,
        )
        return {
            "answer": result.answer,
            "tool_calls": result.tool_calls,
            "final_observation": result.final_observation,
            "mode": "protocol",
        }
