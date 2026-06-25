"""Smoke-test external VA backend logic without starting web server."""

import asyncio
from pathlib import Path
import sys

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(REPO_ROOT))

from external_va_demo.backend import AnalyzeRequest, analyze  # noqa: E402


def _spec():
    return {
        "$schema": "https://vega.github.io/schema/vega-lite/v5.json",
        "mark": "point",
        "encoding": {
            "x": {"field": "x", "type": "quantitative"},
            "y": {"field": "y", "type": "quantitative"},
            "color": {"field": "group", "type": "nominal"},
        },
        "data": {
            "values": [
                {"x": 1, "y": 2, "group": "A"},
                {"x": 2, "y": 4, "group": "A"},
                {"x": 3, "y": 7, "group": "B"},
                {"x": 4, "y": 9, "group": "B"},
                {"x": 5, "y": 8, "group": "C"},
            ]
        },
    }


async def main():
    req = AnalyzeRequest(
        query="What is the correlation trend in this scatter plot?",
        vega_spec=_spec(),
        model_name="llama_protocol",
        input_mode="text_and_image",
        max_iterations=4,
    )
    result = await analyze(req)
    print("protocol_answer:", result.get("answer"))
    print("protocol_tool_calls_count:", len(result.get("tool_calls", [])))


if __name__ == "__main__":
    asyncio.run(main())
