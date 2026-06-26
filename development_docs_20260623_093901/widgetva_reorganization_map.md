# WidgetVA Split Map

## Goal

Split the current mixed implementation into two explicit product lines:

1. `widgetva-kit`
   - the reusable front-end library
   - imported by other VA systems
   - owns widget abstraction, runtime state, action/perception/data-query, coordination links, trace, and page API

2. `widgetva-workspace`
   - the first-party multi-widget VA system built on top of `widgetva-kit`
   - owns the current app shell, session flow, presets, agent panel, and visual inspection surfaces

This split is meant to restore the original intent of
[widgetva_runtime_core_design.md](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva_runtime_core_design.md:1):
first build the reusable abstraction layer, then build a coordinated workspace with it.

## Boundary Rules

### Belongs To `widgetva-kit`

Keep a file in `widgetva-kit` if it answers one of these questions:

- What is a widget/view/workspace ref?
- What is the runtime description/state/action/perception/data-query contract?
- How are linked widgets coordinated?
- How does the front-end runtime execute actions and record trace?
- How does a host page expose the agent-facing page API?
- How does an external VA widget adapt into the runtime?

### Belongs To `widgetva-workspace`

Keep a file in `widgetva-workspace` if it answers one of these questions:

- How does the current demo/studio app load data and create sessions?
- How are runtime inspection cards rendered in the current UI?
- How do demo presets, app store state, and agent panel orchestration work?
- How does the first-party multi-widget workspace present the library?

## Current Entry Points

These entry points now establish the split in code:

- [frontend/src/widgetva-kit/index.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva-kit/index.js:1)
- [frontend/src/widgetva-workspace/index.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva-workspace/index.js:1)

The app shell now imports from those two boundaries in:

- [frontend/src/App.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/App.jsx:1)

## File Mapping

### `widgetva-kit`

These existing areas are the library candidate:

- `frontend/src/widgetva/protocol/**`
- `frontend/src/widgetva/runtime/**`
- `frontend/src/widgetva/adapters/**`
- `frontend/src/widgetva/data/**`
- `frontend/src/widgetva/rendering/**`
- `frontend/src/widgetva/transport/**`
- `frontend/src/widgetva/widgets/**`

Key library surfaces:

- [frontend/src/widgetva/index.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/index.js:1)
- [frontend/src/widgetva/protocol/refs.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/refs.js:1)
- [frontend/src/widgetva/protocol/description.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/description.js:1)
- [frontend/src/widgetva/protocol/state.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/state.js:1)
- [frontend/src/widgetva/protocol/actions.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/actions.js:1)
- [frontend/src/widgetva/protocol/perception.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/perception.js:1)
- [frontend/src/widgetva/protocol/dataHandles.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/dataHandles.js:1)
- [frontend/src/widgetva/protocol/widgetLinks.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/widgetLinks.js:1)
- [frontend/src/widgetva/protocol/interactionTrace.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/interactionTrace.js:1)
- [frontend/src/widgetva/runtime/RuntimeStore.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/RuntimeStore.js:1)
- [frontend/src/widgetva/runtime/ActionExecutor.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/ActionExecutor.js:1)
- [frontend/src/widgetva/runtime/PerceptionQueryRegistry.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/PerceptionQueryRegistry.js:1)
- [frontend/src/widgetva/runtime/DataQueryExecutor.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/DataQueryExecutor.js:1)
- [frontend/src/widgetva/runtime/LinkEngine.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/LinkEngine.js:1)
- [frontend/src/widgetva/runtime/StateManager.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/StateManager.js:1)
- [frontend/src/widgetva/runtime/InteractionTraceRecorder.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/InteractionTraceRecorder.js:1)
- [frontend/src/widgetva/runtime/installPagePort.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/installPagePort.js:1)

### `widgetva-workspace`

These existing areas are app-shell/workspace-specific:

- `frontend/src/App.jsx`
- `frontend/src/api/**`
- `frontend/src/state/**`
- `frontend/src/presets/**`
- `frontend/src/components/**`

Key workspace surfaces:

- [frontend/src/App.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/App.jsx:1)
- [frontend/src/components/DataPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/DataPanel.jsx:1)
- [frontend/src/components/AgentPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/AgentPanel.jsx:1)
- [frontend/src/components/WorkspaceCanvas.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/WorkspaceCanvas.jsx:1)
- [frontend/src/components/InteractionTrajectoryPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/InteractionTrajectoryPanel.jsx:1)
- [frontend/src/presets/demoCases.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/presets/demoCases.js:1)
- [frontend/src/api/client.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/api/client.js:1)
- [frontend/src/state/appStore.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/state/appStore.js:1)

## Immediate Next Moves

1. Keep all new library-facing imports going through `widgetva-kit`.
2. Keep all app-shell imports going through `widgetva-workspace`.
3. After the boundary is stable, physically move implementation files under those two trees.
4. Only then redesign the first-party multi-widget workspace itself.
