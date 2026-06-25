"""External-VA style demo: import custom scatter analyzer with external spec."""

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from packages.widget_sdk import create_custom_scatter_analyzer


def external_custom_spec():
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
    async with create_custom_scatter_analyzer(external_custom_spec()) as analyzer:
        result = await analyzer.run(
            "What is the correlation trend in this custom scatter plot?",
            model_name="llama_protocol",
            input_mode="text_and_image",
            max_iterations=6,
        )
        print("custom_query:", result.query)
        print("custom_answer:", result.answer)
        print("custom_tool_calls:", result.tool_calls)
        print("custom_observation_keys:", sorted(result.final_observation.keys()))


if __name__ == "__main__":
    asyncio.run(main())
