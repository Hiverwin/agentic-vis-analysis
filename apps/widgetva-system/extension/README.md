# WidgetVA Official Vega-Lite Extension

This Chrome extension loads WidgetVA on official Vega-Lite example pages after the user explicitly clicks **Load WidgetVA** from the extension popup.

The extension is intended for validating WidgetVA on official Vega-Lite examples, including multi-view examples such as Seattle weather. Seattle weather is a smoke-tested example, not the only supported page.

## Supported Pages

Current target:

```txt
https://vega.github.io/vega-lite/examples/*
```

This version targets official **Vega-Lite** example pages. It does not currently claim full support for pure Vega pages under `https://vega.github.io/vega/examples/*`.

## How It Works

1. Open an official Vega-Lite example page.
2. The extension performs only a lightweight Vega view capture in the background.
3. No WidgetVA UI is shown automatically.
4. Click the Chrome extension icon.
5. Click **Load WidgetVA**.
6. The WidgetVA Dock appears and binds to the current page.
7. After binding, the Dock can read observations, run semantic widget actions, and run the agent.

The extension does not run the agent automatically. The agent starts only after an objective is submitted in the WidgetVA Dock.

## Build

From the repository root:

```bash
cd apps/widgetva-system
npm install
npm run build:extension
```

The built extension will be available at:

```txt
apps/widgetva-system/extension/dist
```

## Install in Chrome

1. Open Chrome.
2. Go to:

```txt
chrome://extensions
```

3. Enable **Developer mode**.
4. Click **Load unpacked**.
5. Select:

```txt
apps/widgetva-system/extension/dist
```

## Run a Validation

1. Open a Vega-Lite example page, for example:

```txt
https://vega.github.io/vega-lite/examples/interactive_seattle_weather.html
```

2. Click the WidgetVA extension icon in Chrome.
3. Click **Load WidgetVA**.
4. The WidgetVA Dock should appear on the page.
5. If prompted, enter an OpenRouter API key.
6. Submit an objective, for example:

```txt
Select sunny days and explain how the linked views change.
```

or:

```txt
Inspect the visible pattern in this visualization.
```

## Expected Behavior

After **Load WidgetVA**:

- The Dock appears only after the user clicks the extension popup.
- The page is bound to a WidgetVA runtime.
- The Dock can inspect the current visualization state.
- The agent planner receives WidgetVA action/perception descriptors and widget-family playbooks from the kit.
- Semantic actions are executed through WidgetVA, then applied back to the active Vega-Lite page.

## Notes

- The OpenRouter API key is stored in Chrome extension storage.
- Do not commit local `.env` files or personal API keys.
- This branch is for validating the official Vega-Lite page extension path.
- Some chart-specific semantic actions may still need further coverage on unusual Vega-Lite examples.

## Reporting Issues

When reporting a bug, please include:

- The Vega-Lite example URL.
- The objective entered in the Dock.
- The visible error message, if any.
- Whether the issue happened before or after clicking **Load WidgetVA**.
