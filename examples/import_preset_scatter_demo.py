"""External-VA style demo: import preset scatter analyzer and run a query."""

import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))

from packages.widget_sdk import create_preset_scatter_analyzer


async def main():
    async with create_preset_scatter_analyzer() as analyzer:
        result = await analyzer.run(
            "What is the correlation between horsepower and mpg?",
            model_name="llama_protocol",
            input_mode="text_and_image",
            max_iterations=6,
        )
        print("preset_query:", result.query)
        print("preset_answer:", result.answer)
        print("preset_tool_calls:", result.tool_calls)
        print("preset_observation_keys:", sorted(result.final_observation.keys()))


if __name__ == "__main__":
    asyncio.run(main())
