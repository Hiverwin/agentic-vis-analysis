# Official Vega Example Integration Usage

This note shows the current intended usage for attaching WidgetVA to an official
Vega-Lite examples page such as:

- `https://vega.github.io/vega-lite/examples/point_2d.html`
- `https://vega.github.io/vega-lite/examples/bar.html`
- `https://vega.github.io/vega-lite/examples/line.html`

## What Is Already Implemented

Library entry:

- `widgetva-kit/page-integrations`
- `apps/widgetva-system/extension`

Core helpers:

- `installVegaEmbedCapture(root)`
- `attachWidgetVAToCurrentVegaLiteExamplePage(...)`
- `bootstrapCurrentVegaLiteExamplePage(...)`

What they do:

1. Intercept the official page's own `vegaEmbed(...)` call.
2. Capture the real rendered `view`.
3. Extract and normalize the official Vega-Lite spec from the page.
4. Infer the WidgetVA widget family (`scatter`, `bar`, `line`, ...).
5. Mount a real `WidgetInstance` on top of that official `view`.
6. Expose the runtime page port on `window.__widgetVA`.

## Recommended Usage Modes

For publication-grade reuse, this should exist in two forms:

1. Browser extension / content script
2. Page-side script / npm package integration

Use the browser extension path for official pages and third-party pages such as:

- `https://vega.github.io/vega-lite/examples/...`
- future Observable D3 gallery pages

Use the page-side script path for people integrating WidgetVA into their own site.

## Browser Extension Flow For Official Vega-Lite Examples

Build the unpacked extension:

```bash
cd apps/widgetva-system
npm run build:extension
```

Load the built extension directory in Chrome:

- open `chrome://extensions`
- enable Developer mode
- click Load unpacked
- select `apps/widgetva-system/extension/dist`

Then open or refresh an official Vega-Lite examples page such as:

- `https://vega.github.io/vega-lite/examples/point_2d.html`

The extension will:

1. inject a page script at `document_start`
2. install Vega embed capture on the real page
3. wait for the official page's own `vegaEmbed(...)` render
4. attach WidgetVA to that real rendered view
5. expose `window.__widgetVA`
6. expose bootstrap state on `window.__widgetVAOfficialPageBootstrap`

Quick verification in DevTools console:

```js
window.__widgetVA
window.__widgetVAOfficialPageBootstrap
await window.__widgetVA.describePagePort()
await window.__widgetVA.describeWorkspace()
```

## Minimal Page-Side Bootstrap

```js
import {
  bootstrapCurrentVegaLiteExamplePage,
} from "widgetva-kit/page-integrations";

const controller = await bootstrapCurrentVegaLiteExamplePage({
  root: window,
  timeoutMs: 8000,
});

console.log(controller.kind);
console.log(controller.describeAgentContract());
console.log(window.__widgetVA);
```

After this runs:

- `controller` is the WidgetVA controller for the official example.
- `window.__widgetVA` exposes the stable page-port API.
- the official chart remains the page's own chart; WidgetVA is attached to it.

This page-side form is the right integration style for:

- npm package usage
- internal apps
- first-party systems that want explicit control instead of automatic extension injection

## Structured Action Examples

Scatter example:

```js
const result = await window.__widgetVA.executeVerifiedAction({
  callId: "acceptance_zoom_1",
  name: "scatter.zoomDomain",
  actor: "agent",
  queryScope: {
    widgetRef: controller.describeAgentContract().widget.ref,
  },
  params: {
    xDomain: [60, 160],
    yDomain: [10, 35],
  },
});

console.log(result);
```

Bar example:

```js
const result = await window.__widgetVA.executeVerifiedAction({
  callId: "acceptance_filter_1",
  name: "bar.selectCategory",
  actor: "agent",
  queryScope: {
    widgetRef: controller.describeAgentContract().widget.ref,
  },
  params: {
    field: "Origin",
    values: ["USA"],
  },
});
```

Line example:

```js
const result = await window.__widgetVA.executeVerifiedAction({
  callId: "acceptance_line_1",
  name: "line.zoomDomain",
  actor: "agent",
  queryScope: {
    widgetRef: controller.describeAgentContract().widget.ref,
  },
  params: {
    xDomain: ["2006-01-01", "2008-12-31"],
  },
});
```

## Observe / Verify

```js
const workspace = await window.__widgetVA.describeWorkspace();
const state = await window.__widgetVA.readView();
const port = await window.__widgetVA.describePagePort();

console.log({ workspace, state, port });
```

## Current Scope

This is currently implemented and tested for the official Vega-Lite examples path.

The next step is the official D3 gallery path:

- page identification
- runtime capture of the rendered chart object or host wrapper
- WidgetVA attachment over the official D3 page
