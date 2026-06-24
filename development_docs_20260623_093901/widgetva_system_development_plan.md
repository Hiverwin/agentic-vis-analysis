# WidgetVA System Development Plan

## Context

`widgetva-system` is the future-facing frontend application for this repository.

It is not a patch on top of the existing `frontend` shell.
It is a new application that will:

- host imported `widgetva-kit` widgets
- support real multi-widget visual analytics workflows
- demonstrate human-led, copilot, and autonomous agentic visual analysis
- serve as the long-term product-facing system shape for this project

The old `frontend/` remains useful as:

- a transitional runtime validation shell
- a source of reusable API and visual token ideas
- a debugging surface for runtime internals

But it is no longer the architectural base for the future system.

## App Location

The new application should live at:

```text
apps/widgetva-system/
```

Why this structure:

- `apps/` indicates application-level surfaces in the repo
- `widgetva-system/` gives this app a stable product identity
- it avoids mixing new system architecture with the legacy `frontend/`

## Product Intent

`widgetva-system` should behave like a VIS/VA system first and an agent demo second.

That means:

- multi-widget workspace is primary
- imported widgets are first-class
- evidence and trace are explicit
- agent ability is demonstrated as a control mode on the same workspace runtime

It should not be framed as:

- a chat app with charts attached
- a runtime debug console
- a generic dashboard product

## Architectural Principles

### 1. Separate app boundary

`apps/widgetva-system` must have its own:

- `src/`
- app shell
- state management
- layout system
- route or view entry

It should not reuse the old `frontend/src/App.jsx` structure.

### 2. Reuse runtime and library contracts, not old app shape

It should integrate with:

- `widgetva-kit`
- shared API utilities where useful
- current blue-white token direction

It should not inherit:

- legacy panel stacking logic
- legacy app-level state shape
- runtime-debug-first information architecture

### 3. One shell, multiple control modes

The app should use one stable shell and support:

- `Manual Analysis`
- `Copilot`
- `Autonomous`

These are control modes, not separate applications.

### 4. Workspace-centered design

The visual center of the app is always the multi-widget workspace.

Everything else is supporting structure:

- setup
- inspect
- evidence
- trace
- agent controls

## Relationship To Existing Repo Parts

### `widgetva-kit/`

Role:

- core library
- widget abstraction source
- runtime/workspace contract source
- transport and agent-facing integration surface

`widgetva-system` should import from this package directly.

### `frontend/`

Role:

- legacy validation shell
- source of current visual tokens
- reference for API wiring and existing chart canvas implementations

Do not treat it as the parent architecture of `widgetva-system`.

### Shared backend and API

If current API routes remain valid, `widgetva-system` can reuse them.

But the frontend-side state model should be new and app-specific.

## Proposed Directory Structure

```text
apps/
  widgetva-system/
    package.json
    vite.config.js
    index.html
    src/
      main.jsx
      App.jsx
      styles/
        tokens.css
        base.css
        layout.css
      app/
        appStore.js
        modes.js
        sessionModel.js
      layout/
        SystemShell.jsx
        TopModeBar.jsx
        SetupRail.jsx
        AnalysisRail.jsx
        TraceDrawer.jsx
      workspace/
        WorkspaceStage.jsx
        WorkspaceViewport.jsx
        WidgetSurface.jsx
        workspaceLayouts.js
      setup/
        WidgetLibraryPanel.jsx
        DatasetPanel.jsx
        CompositionPanel.jsx
      analysis/
        InspectPanel.jsx
        AgentPanel.jsx
        EvidencePanel.jsx
        ControlsPanel.jsx
      trace/
        TracePanel.jsx
        ReplayPanel.jsx
        BranchesPanel.jsx
        ExecutionLogPanel.jsx
      runtime/
        runtimeBridge.js
        workspaceHostBridge.js
        importedWidgetContracts.js
      api/
        client.js
      presets/
        workspaceCases.js
```

## Boundary Rules

### What may be reused from `frontend/`

- blue-white token direction
- useful API request helpers
- chart/table rendering approaches if they are extracted cleanly
- some existing data presets if still relevant

### What should not be reused as-is

- `frontend/src/App.jsx`
- old left-center-right debug shell
- old app store shape
- tightly coupled runtime debug card layout

### What should be extracted carefully if needed

- Vega embedding helpers
- widget rendering surface helpers
- host bridge patterns
- session fetch helpers

## Information Architecture

This app follows the shell defined in:

[widgetva_vis_va_frontend_architecture.md](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva_vis_va_frontend_architecture.md)

The stable structure is:

1. left `Setup Rail`
2. center `Workspace Stage`
3. right `Adaptive Analysis Rail`
4. bottom `Trace Drawer`

## Mode Model

The app should support these modes:

### `manual`

- human leads
- inspect tab active by default
- trace drawer collapsed by default

### `copilot`

- human leads with agent assistance
- agent tab active by default
- suggestions and evidence emphasized

### `autonomous`

- agent actively executes on shared runtime
- trace drawer open by default
- interrupt/takeover controls always visible

## Phase 1 Scope

Phase 1 should focus on proving the system shape, not polishing every feature.

### Required

- app scaffold under `apps/widgetva-system`
- blue-white academic token system
- stable shell layout
- imported widget library panel
- workspace stage with true multi-widget rendering via `workspaceSpec`
- right rail tabs:
  - `Inspect`
  - `Agent`
  - `Evidence`
  - `Controls`
- bottom trace drawer tabs:
  - `Trace`
  - `Replay`
  - `Branches`
  - `Execution Log`
- mode switch:
  - `Manual`
  - `Copilot`
  - `Autonomous`

### Optional but useful in Phase 1

- one or two curated preset multi-widget cases
- ability to pin evidence notes
- workspace topology summary

### Not required in Phase 1

- full persistence model
- collaboration
- notebook authoring
- production auth
- complete benchmark/evaluation UI

## Runtime Integration Requirements

`widgetva-system` must prove these library capabilities through real usage:

- widget import
- widget contract visibility
- workspace composition
- multi-widget link coordination
- action execution
- perception querying
- trace reading
- replay
- mode-aware agent integration

This is important: the frontend is not just showing widgets.
It is validating that `widgetva-kit` can operate as the substrate of a real VA system.

## State Model Guidance

Do not copy the old `frontend` store wholesale.

The new app store should separately model:

- app mode
- current session
- imported widget catalog state
- active workspace spec
- focused widget ref
- evidence entries
- trace drawer open state
- right rail active tab
- current agent execution state

This should be cleaner than the legacy mixed debug/demo store.

## Styling Guidance

The styling should derive from the current blue-white frontend palette, not the default colors of the imported design skills.

Use:

- white and pale blue surfaces
- blue accent for action and focus
- restrained borders
- minimal shadows
- academic, editorial hierarchy

Avoid:

- purple theming
- dark mode as the default identity
- dashboard-card overload

## Recommended Build Order

### Step 1

Create app scaffold:

- `apps/widgetva-system`
- Vite + React entry
- package wiring to local `widgetva-kit`

### Step 2

Implement design tokens and base shell:

- top mode bar
- setup rail
- workspace stage
- analysis rail
- trace drawer

### Step 3

Wire runtime and workspace:

- host bridge
- runtime creation
- workspace spec-driven rendering

### Step 4

Implement core panels:

- widget library
- inspect
- agent
- evidence
- trace

### Step 5

Add preset cases for:

- human-led multi-widget analysis
- copilot workflow
- autonomous workflow

## Success Criteria

The first meaningful milestone is reached when:

- the app runs independently from legacy `frontend`
- a multi-widget workspace is visible
- imported widgets can be surfaced as system primitives
- mode switching changes control emphasis without changing app identity
- trace and evidence are visible as first-class analysis artifacts
- the app already looks and behaves more like a VA system than a debug shell

## QA Checklist

- Is `apps/widgetva-system` architecturally independent from `frontend/`?
- Does the workspace remain the dominant visual surface?
- Can the app demonstrate multi-widget coordination rather than just multiple isolated charts?
- Can the user understand imported widgets as system building blocks?
- Are human, copilot, and autonomous modes clearly differentiated without becoming separate products?
- Is the visual language blue-white, academic, and restrained?
- Does the structure validate `widgetva-kit` as a real substrate for a future VA system?

