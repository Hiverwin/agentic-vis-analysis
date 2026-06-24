# WidgetVA First-Party VA Integration Plan

## Overview

This document defines how to turn the current:

- `apps/widgetva-system/` app shell

into a real first-party VA system built on top of:

- `widgetva-kit`

The goal is not to redesign the product shell from scratch.
The goal is to replace the current host-only prototype state path with real:

- widget import
- workspace composition
- workspace-shared coordination state
- action / perception execution
- trace / replay reads
- agent-operable runtime access

The resulting app should become the concrete environment that:

- validates `widgetva-kit` through real use
- hosts multi-widget visual analytics workflows
- provides the operating environment for downstream agent work

Current scope excludes:

- evaluation UI
- benchmark UI
- production auth
- collaboration

## Current Baseline

### What already exists in `apps/widgetva-system`

The app already has a strong first-party shell:

- top-level system shell
- setup rail
- workspace stage
- analysis rail
- trace drawer
- manual / copilot / autonomous modes
- curated multi-widget preset cases

It already behaves like a multi-widget VA interface, not a generic dashboard.

### What it is missing

It is still running on a local prototype host state path:

- local `zustand` store
- local widget derivation and filtering logic
- host-only agent panel
- no direct `widgetva-kit` widget/workspace runtime integration

That means it is currently:

- a first-party VA app shell

but not yet:

- a first-party VA system fully powered by `widgetva-kit`

### What already exists in `widgetva-kit`

The library is already strong enough to serve as the system substrate:

- widget-first public surface
- `WidgetInstance`
- `WidgetWorkspace`
- canonical `workspaceShared` model
  - `selections.registry`
  - `selections.views.primary`
  - `selections.views.byWidget`
  - `links.definitions`
  - `links.topology`
- action / perception / trace / replay support
- widget/workspace-first transport surface

This means the integration phase should start now.
The library does not need to be “perfect” before the first-party app is attached.

## Product Boundary

The target architecture is:

```txt
apps/widgetva-system
  -> imports widgetva-kit public surfaces
  -> composes widget instances into a WidgetWorkspace
  -> owns app-mode / panel / evidence UX
  -> delegates widget/workspace semantics to widgetva-kit
```

The system boundary should be:

- app shell and UX remain in `apps/widgetva-system`
- widget semantics and coordination runtime remain in `widgetva-kit`

The app should not re-implement:

- widget action logic
- workspace-shared coordination semantics
- trace/replay semantics

## Locked Design Decisions

- `apps/widgetva-system` is the first-party validation host for `widgetva-kit`.
- `widgetva-kit` remains the semantic and runtime substrate.
- The app owns shell UX, session flow, and panel composition.
- `WidgetWorkspace` is the primary multi-widget coordination container.
- `workspaceShared` is the authoritative coordination model.
- Selection and link semantics must come from `widgetva-kit`, not from a parallel app-local state model.
- The app may keep lightweight app-local UI state, but not a parallel analytical runtime.
- Agent integration should attach to the same workspace runtime seen by humans.

## Integration Target

The target milestone is reached when `apps/widgetva-system` can:

- import widget constructors from `widgetva-kit`
- create a real `WidgetWorkspace`
- register canonical link definitions through the workspace
- read and write focus / selections / filters through workspace APIs
- execute widget/workspace actions through real runtime paths
- query perception through real runtime paths
- read trace / replay from the same runtime
- expose that environment to a future agent layer without needing a second runtime model

## State Ownership Rules

### App-local state

The app should continue to own:

- mode
- active analysis tab
- active trace tab
- drawer open/closed state
- selected preset case id
- evidence panel display preferences
- shell-level UI toggles

### Workspace runtime state

The app should no longer own a parallel analytical model for:

- focused widget
- selection registry and views
- global filters
- comparison targets
- annotations
- link definitions
- link topology
- trace/replay/runtime state

Those must be owned by `WidgetWorkspace` and related `widgetva-kit` runtime layers.

### Transitional rule

During migration, dual state is acceptable only as a short-lived bridge.
Each phase below should remove one category of analytical app-local duplication.

## Architectural Shape

## Phase 0: Foundation Alignment

### Task 0.1: Create an explicit app-to-kit runtime bridge layer

**Description:**
Add a dedicated integration layer inside `apps/widgetva-system` that is responsible for:

- creating widget instances
- creating the workspace
- hydrating preset cases into runtime objects
- exposing a clean host-facing API to the shell

This should prevent `App.jsx` or presentation panels from importing low-level kit modules directly.

**Acceptance criteria:**
- [ ] `apps/widgetva-system/src/runtime/` becomes the only place that creates `WidgetInstance` and `WidgetWorkspace`
- [ ] UI panels consume a higher-level app runtime surface
- [ ] there is no direct runtime construction inside presentation components

**Files likely touched:**
- `apps/widgetva-system/src/runtime/*`
- `apps/widgetva-system/src/app/appStore.js`
- `apps/widgetva-system/src/App.jsx`

**Estimated scope:** M

### Task 0.2: Define preset-to-workspace composition mapping

**Description:**
Current preset cases already describe widgets and topology.
Formalize how a preset case becomes:

- widget constructor calls
- widget descriptions/spec/data payloads
- workspace registration
- link definition registration

This should be explicit and deterministic.

**Acceptance criteria:**
- [ ] preset case schema maps directly to widget instance creation
- [ ] preset case schema maps directly to workspace link definition registration
- [ ] no presentation component does ad hoc preset interpretation

**Files likely touched:**
- `apps/widgetva-system/src/presets/workspaceCases.js`
- `apps/widgetva-system/src/runtime/*`

**Estimated scope:** M

### Checkpoint: Foundation Alignment

- [ ] runtime construction is isolated to a runtime bridge layer
- [ ] presets have a stable path into widget/workspace composition

## Phase 1: Real Widget and Workspace Mounting

### Task 1.1: Replace local widget derivation shell with imported widget instances

**Description:**
Stop treating the six views as a local host-side derivation table.
Instead, instantiate real first-party widgets from `widgetva-kit`.

The app should still render the same six-view workspace, but the rendered surfaces should now be backed by widget instances.

**Acceptance criteria:**
- [ ] workspace stage renders imported widget instances rather than host-local pseudo widgets
- [ ] widget selection/focus in the stage resolves to real widget refs
- [ ] the visual shell remains intact

**Verification:**
- [ ] app runs and renders the six-view workspace
- [ ] selected widget changes map to real widget refs

**Files likely touched:**
- `apps/widgetva-system/src/workspace/WorkspaceStage.jsx`
- `apps/widgetva-system/src/workspace/WidgetSurface.jsx`
- `apps/widgetva-system/src/runtime/*`

**Estimated scope:** L

### Task 1.2: Create and own a real `WidgetWorkspace`

**Description:**
Create a real `WidgetWorkspace` instance for the active preset case and make it the authoritative coordination container.

**Acceptance criteria:**
- [ ] active app workspace is a real `WidgetWorkspace`
- [ ] widget registration happens through workspace/runtime setup
- [ ] workspace reads are available to the shell

**Verification:**
- [ ] workspace contract reads return meaningful values in the app
- [ ] switching cases rebuilds or refreshes the real workspace cleanly

**Files likely touched:**
- `apps/widgetva-system/src/runtime/*`
- `apps/widgetva-system/src/app/appStore.js`

**Estimated scope:** M

### Checkpoint: Real Runtime Mount

- [ ] the app is no longer a host-only widget mock shell
- [ ] a real `WidgetWorkspace` exists underneath the UI

## Phase 2: Move Coordination State Ownership Into `WidgetWorkspace`

### Task 2.1: Migrate focus and selection ownership

**Description:**
Remove app-local ownership of:

- selected/focused analytical widget state
- primary selection
- selection registry/views

The app should read and write these through workspace APIs.

**Acceptance criteria:**
- [ ] focus is written through `WidgetWorkspace`
- [ ] selection writes use the new public workspace APIs
- [ ] app-local analytical selection duplication is removed

**Verification:**
- [ ] changing widget focus updates workspace-shared state
- [ ] selection-driven UI summaries come from workspace reads

**Files likely touched:**
- `apps/widgetva-system/src/app/appStore.js`
- `apps/widgetva-system/src/workspace/*`
- `apps/widgetva-system/src/analysis/*`

**Estimated scope:** M

### Task 2.2: Migrate filters and comparison ownership

**Description:**
Move analytical global filters and comparison targets into workspace ownership.

This includes current host-local fields such as:

- origin/year/cylinder filters
- linked filter summary state

App-local UI controls may remain, but their source of truth should be workspace-shared state.

**Acceptance criteria:**
- [ ] analytical filters no longer live as canonical app-local runtime state
- [ ] comparison targets resolve through workspace reads/writes
- [ ] filter strip and inspect summaries are workspace-derived

**Verification:**
- [ ] filter UI changes update workspace state
- [ ] workspace-derived summaries remain correct

**Files likely touched:**
- `apps/widgetva-system/src/app/appStore.js`
- `apps/widgetva-system/src/analysis/ControlsPanel.jsx`
- `apps/widgetva-system/src/analysis/InspectPanel.jsx`
- `apps/widgetva-system/src/runtime/*`

**Estimated scope:** L

### Task 2.3: Register and read canonical link definitions/topology

**Description:**
Replace app-local topology/link assumptions with real workspace link registration and topology reads.

**Acceptance criteria:**
- [ ] preset links register through workspace APIs
- [ ] topology summaries read from `links.topology`
- [ ] UI no longer treats topology as a purely decorative local field

**Verification:**
- [ ] topology status in the shell matches workspace topology reads
- [ ] linked interactions use real workspace coordination paths

**Files likely touched:**
- `apps/widgetva-system/src/presets/workspaceCases.js`
- `apps/widgetva-system/src/runtime/*`
- `apps/widgetva-system/src/workspace/*`
- `apps/widgetva-system/src/analysis/*`

**Estimated scope:** M

### Checkpoint: Workspace Shared State

- [ ] focus, selection, filters, and links are workspace-owned
- [ ] the app no longer maintains a parallel analytical coordination model

## Phase 3: Replace Host-Only Agent Surface With Real Runtime Surface

### Task 3.1: Drive inspect/evidence panels from real workspace reads

**Description:**
Panels should stop summarizing host-local mock state and instead summarize:

- real widget descriptions
- real workspace state
- real current selections
- real topology

**Acceptance criteria:**
- [ ] inspect panel reads from workspace/runtime surfaces
- [ ] evidence panel uses real focused widget / selection context
- [ ] summary text is grounded in real runtime reads

**Files likely touched:**
- `apps/widgetva-system/src/analysis/InspectPanel.jsx`
- `apps/widgetva-system/src/analysis/EvidencePanel.jsx`
- `apps/widgetva-system/src/runtime/*`

**Estimated scope:** M

### Task 3.2: Turn agent panel into a real execution surface

**Description:**
Replace the current host-only placeholder panel with a real integration surface that can:

- inspect current widget/workspace context
- expose available actions/perceptions
- execute actions
- query perceptions

It does not need full autonomous planning yet.
It does need real runtime execution plumbing.

**Acceptance criteria:**
- [ ] agent panel is no longer placeholder-only
- [ ] it can read current widget/workspace context
- [ ] it can execute at least a curated subset of real actions
- [ ] it can query at least a curated subset of real perceptions

**Verification:**
- [ ] manual action trigger changes real workspace state
- [ ] perception trigger returns real runtime data

**Files likely touched:**
- `apps/widgetva-system/src/analysis/AgentPanel.jsx`
- `apps/widgetva-system/src/runtime/*`

**Estimated scope:** L

### Checkpoint: Agent-Operable Host

- [ ] the app exposes a real runtime surface to future agent work
- [ ] the “agent” panel is attached to real execution and query paths

## Phase 4: Trace and Replay on the Real Runtime

### Task 4.1: Replace shell-local trace summaries with real runtime trace reads

**Description:**
Trace-related panels should read from the same runtime that widgets and workspace use.

**Acceptance criteria:**
- [ ] trace panel reads real trace entries
- [ ] execution log reads real runtime records
- [ ] branch/replay surfaces use real runtime metadata

**Verification:**
- [ ] user-visible trace changes after real actions
- [ ] replay list updates after runtime transitions

**Files likely touched:**
- `apps/widgetva-system/src/trace/*`
- `apps/widgetva-system/src/runtime/*`

**Estimated scope:** M

### Task 4.2: Wire replay controls to real workspace replay

**Description:**
The app should be able to replay runtime transitions through `widgetva-kit`, not through shell-local faux replay state.

**Acceptance criteria:**
- [ ] replay panel can invoke real replay
- [ ] replay updates visible widget/workspace state
- [ ] replay does not depend on a duplicate shell-only history model

**Verification:**
- [ ] replaying a recorded step changes visible workspace state correctly

**Files likely touched:**
- `apps/widgetva-system/src/trace/ReplayPanel.jsx`
- `apps/widgetva-system/src/runtime/*`

**Estimated scope:** M

### Checkpoint: Real Runtime Trace

- [ ] trace/replay are runtime-backed
- [ ] the app no longer fakes runtime history through local presentation data

## Phase 5: Prepare the Environment for Downstream Agent Work

### Task 5.1: Expose a stable app-facing runtime integration contract

**Description:**
Define the narrow contract that future agent work should rely on from the host app.

This should include:

- current workspace handle
- current focused widget ref
- current selection summary
- available actions/perceptions
- action execution hooks
- perception query hooks
- trace access hooks

This contract should live in the app runtime layer, not scattered across panels.

**Acceptance criteria:**
- [ ] a stable runtime host API exists inside `apps/widgetva-system/src/runtime`
- [ ] future agent work can attach to this surface without reading UI component internals
- [ ] panel code uses the same contract

**Files likely touched:**
- `apps/widgetva-system/src/runtime/*`
- `apps/widgetva-system/src/analysis/AgentPanel.jsx`

**Estimated scope:** M

### Task 5.2: Document curated first-party operating flows

**Description:**
Document the first real operating flows that the app supports for downstream agent work.

Examples:

- inspect focused widget
- execute a widget action
- query perception on current selection
- capture evidence after action
- replay recent changes

**Acceptance criteria:**
- [ ] first-party operator flows are documented
- [ ] downstream agent work has a clear entry path

**Files likely touched:**
- this document
- optional runtime README under `apps/widgetva-system/src/runtime/`

**Estimated scope:** S

### Checkpoint: First-Party VA System

- [ ] `apps/widgetva-system` is a real first-party VA system built on `widgetva-kit`
- [ ] it is suitable as the operating environment for future agent capability work
- [ ] analytical runtime ownership is not duplicated in the shell

## Recommended Implementation Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Checkpoint: Workspace Shared State
5. Phase 3
6. Phase 4
7. Phase 5

This order is important:

- do not attach agent execution before real workspace ownership exists
- do not attach replay before runtime trace is real
- do not try to polish app UX while analytical ownership is still duplicated

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| App keeps a parallel analytical state model alongside `WidgetWorkspace` | High | Migrate ownership category by category and delete duplicate canonical state after each phase |
| UI components start importing low-level kit modules directly | Medium | Force runtime construction through `src/runtime/*` only |
| Preset case schema remains presentation-driven instead of composition-driven | Medium | Add explicit preset-to-workspace mapping early in Phase 0 |
| Agent panel is connected too early to unstable app-local state | High | Delay real agent integration until after Phase 2 checkpoint |
| Trace/replay stay shell-local while actions become runtime-backed | High | Treat Phase 4 as required before calling the app a real first-party system |

## Success Criteria

This work is complete when:

- `apps/widgetva-system` still looks like the current multi-widget VA app shell
- but its analytical runtime is now truly powered by `widgetva-kit`
- the same workspace runtime is visible to humans and future agent operators
- the app can serve as the first real operating environment for downstream agent work
