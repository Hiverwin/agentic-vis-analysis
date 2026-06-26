# WidgetVA VIS VA Frontend Architecture

## Context

This document defines the frontend information architecture for a WidgetVA-based visual analytics system that must satisfy two goals at the same time:

1. behave like a real VIS/VA research system centered on multi-widget analysis
2. demonstrate that agentic visual analysis is built on top of the same widget/workspace runtime rather than a separate product

The frontend should therefore not be designed as a chat application with charts attached. It should be designed as a visual analytics workspace whose control mode can shift between human-led, human-agent collaboration, and autonomous agent execution.

## Installed Design Skills

The following design skills were installed from `bergside/awesome-design-skills`:

- `application`
- `dashboard`
- `publication`

Installed local paths:

- `/Users/chenyutong/.codex/skills/application`
- `/Users/chenyutong/.codex/skills/dashboard`
- `/Users/chenyutong/.codex/skills/publication`

Important note:

- Codex must be restarted before these become first-class session skills.
- For this document, their local `SKILL.md` and `DESIGN.md` were read directly and applied manually.

## Design Intent

Build a blue-white academic visual analytics environment that feels like a research-grade system rather than a generic SaaS dashboard, while still being structured enough to show runtime inspection, evidence capture, multi-widget coordination, and agentic execution.

## Design Sources And How They Are Used

### `application`

Use for:

- overall app shell discipline
- explicit states
- implementation-ready component behavior
- product-grade consistency

Do not inherit:

- purple color system
- top-bar-only navigation assumption
- card-heavy default layout

### `dashboard`

Use for:

- modular grid logic
- strong data hierarchy
- dense operational surfaces
- productivity-oriented panel behavior

Do not inherit:

- dark theme
- cloud-console visual metaphor as the dominant look

### `publication`

Use for:

- editorial hierarchy
- academic tone
- evidence-oriented reading flow
- stronger typographic contrast for titles, notes, and findings

Do not inherit:

- purple editorial palette
- overly expressive headline style that competes with the workspace

## Core Product Positioning

The system is not just a runtime debug UI.

It is a `widget-first visual analytics studio` with:

- imported widget abstractions
- multi-widget workspace composition
- coordinated interactive analysis
- inspect and evidence surfaces
- runtime trace and replay
- optional agent control over the same workspace

## Non-Negotiable VIS/VA Principles

### 1. Workspace is the center

The main canvas must remain the primary visual object in every mode.

The UI must never collapse into:

- a chat-first screen
- a form-first dashboard
- a debug-console layout

### 2. Multi-widget coordination is explicit

The system must visibly support:

- one main view plus supporting views
- linked selections
- cross-filter behavior
- detail drill-down
- coordinated state reading

### 3. Evidence is first-class

The system must support more than transient interaction.

It must expose:

- current findings
- saved observations
- selection-aware evidence
- replayable analysis history

### 4. Agent is a control mode, not a separate application

Human and agent should operate on:

- the same `WidgetInstance` surfaces
- the same `WidgetWorkspace`
- the same trace
- the same replay model

This means agent behavior should appear as a mode shift inside one shell, not as a separate route or page with a separate mental model.

## Recommended Information Architecture

### Stable Shell

The frontend should use one persistent shell with four regions:

1. `Setup Rail`
2. `Workspace Stage`
3. `Adaptive Analysis Rail`
4. `Trace Drawer`

This shell stays stable across manual, copilot, and autonomous modes.

## Region Definitions

### A. Setup Rail

Location:

- left side

Primary role:

- workspace construction
- imported widget visibility
- dataset and scenario setup

Contents:

- imported widget library
- widget family catalog
- current dataset summary
- workspace templates
- active workspace topology summary
- link setup controls
- composition controls

Design behavior:

- compact
- list-driven
- low decoration
- more like a lab control shelf than a marketing sidebar

What should not live here:

- detailed inspection output
- long trace timelines
- primary agent reasoning transcript

### B. Workspace Stage

Location:

- center

Primary role:

- main analysis surface

Contents:

- primary widget
- supporting widgets
- focus + context layout behavior
- direct manipulation and human interaction
- linked selection feedback

Required layout behaviors:

- single focus view
- one-large-plus-many-supporting layout
- two-up comparison layout
- multi-widget grid layout
- focus promotion when a widget becomes active

This area should feel spatial and analytic, not card-based.

### C. Adaptive Analysis Rail

Location:

- right side

Primary role:

- contextual interpretation and control for the currently active analysis state

This rail should use tabs rather than one long stack.

Recommended tabs:

- `Inspect`
- `Agent`
- `Evidence`
- `Controls`

#### `Inspect`

Purpose:

- expose the current widget/workspace state in a human-readable way

Contents:

- focused widget summary
- current selection summary
- linked filter summary
- current encodings and transforms
- perception results
- visible row / derived data summary

#### `Agent`

Purpose:

- expose the current agent surface without taking over the whole interface

Contents:

- mode-aware prompt area
- current plan summary
- next suggested action
- latest agent response
- execution status
- human override / interrupt controls

#### `Evidence`

Purpose:

- convert ephemeral analysis into retained research artifacts

Contents:

- saved observations
- pinned findings
- selected rows or summaries
- annotations tied to widgets or selections
- possibly saved snapshots or state references later

#### `Controls`

Purpose:

- fast manual operations that should not clutter the workspace

Contents:

- encoding changes
- view reset
- comparison toggles
- replay shortcuts
- link enable/disable controls

### D. Trace Drawer

Location:

- bottom expandable drawer

Primary role:

- temporal history, replay, and branch-aware reasoning support

Recommended tabs:

- `Trace`
- `Replay`
- `Branches`
- `Execution Log`

Why bottom instead of right:

- trace is temporal and sequential
- replay often benefits from wider horizontal space
- right rail should stay focused on current state, not full history

## Control Modes

The system should not create separate apps for human and agent use.

Instead it should use one shell with a lightweight mode switch.

Recommended modes:

- `Manual Analysis`
- `Copilot`
- `Autonomous`

## Mode Behavior

### `Manual Analysis`

Primary meaning:

- human leads, system supports

Default UI behavior:

- `Inspect` tab active
- `Trace Drawer` collapsed by default
- `Agent` tab present but not visually dominant

### `Copilot`

Primary meaning:

- human leads, agent suggests and assists

Default UI behavior:

- `Agent` tab active
- `Inspect` and `Evidence` remain one click away
- `Trace Drawer` available but not forced open

### `Autonomous`

Primary meaning:

- agent actively executes on the shared workspace

Default UI behavior:

- `Agent` tab active
- `Trace Drawer` open by default on `Trace`
- interrupt and takeover controls always visible

Critical rule:

- the workspace itself does not change identity across modes
- only control emphasis and default panel visibility change

## Why This Structure Fits VIS/VA

This structure matches visual analytics logic because it keeps the system organized around:

- spatial workspace
- coordinated views
- inspectable state
- evidence accumulation
- replayable process

It also matches agentic visual analysis because:

- the same workspace remains central
- agent actions are shown as operations on the same runtime
- human and agent traces can be compared inside one history system

## Why Not A Chat-First Layout

A chat-first layout would weaken the core claim of the project.

It would make the system look like:

- an LLM app with charts as outputs

Instead of:

- a visual analytics environment with an optional agent controller

For this project, the second interpretation is the one that matters.

## Why Not Put Inspect And Trace Both On The Right

Because they serve different cognitive tasks.

- `Inspect` is near-field and state-local
- `Trace` is temporal and sequence-oriented

Putting both on the right would:

- overload the inspector rail
- reduce workspace breathing room
- make the interface feel like a debug stack

## Visual Direction

### High-Level Thesis

Use an academic blue-white system with editorial restraint and lab-grade clarity.

The visual mood should read as:

- calm
- analytic
- precise
- trustworthy

It should not read as:

- startup purple
- glassmorphism spectacle
- dark cloud console
- playful productivity app

## Color Direction

Reference the current frontend palette and preserve its blue-white base.

Recommended core tokens:

- `--bg: #f1f3f6`
- `--surface: #ffffff`
- `--surface2: #f6f8fb`
- `--border: #cfd6e2`
- `--border-strong: #b8c2d3`
- `--accent: #2f5d94`
- `--accent-hover: #244971`
- `--text: #26374d`
- `--text-muted: #4d617b`
- `--text-dim: #7f8ca1`
- `--success: #2f7f63`
- `--warning: #ab7b35`
- `--danger: #9b4b4b`

Additional guidance:

- keep backgrounds bright and quiet
- use blue as the only action accent
- use green, amber, red only for state semantics
- avoid gradients as the main identity device

## Typography Direction

Blend application clarity with publication hierarchy.

Recommended use:

- primary UI text: `Inter`
- mono and technical labels: `JetBrains Mono`
- optional editorial heading accent for section titles only if subtle

Do not let expressive display typography overpower the workspace.

## Layout Tone

The system should feel:

- paneled
- measured
- aligned
- compact but breathable

It should avoid:

- oversized hero sections
- floating marketing cards
- heavy shadows
- ornamental density

## Component Guidance

### Workspace Panels

Panels should:

- use restrained borders
- use white or pale-blue surfaces
- minimize shadow
- expose clear headers only where orientation is needed

### Tabs

Tabs are essential to reduce right-rail overload.

They should:

- be compact
- use strong active state contrast
- support keyboard switching
- preserve panel state when switching where possible

### Drawers

The bottom trace drawer should:

- open smoothly without covering the whole workspace by default
- support half-height and expanded states
- preserve scroll position in trace views

### Widget Cards In Setup Rail

These should communicate:

- widget kind
- contract summary
- supported action count
- supported perception count
- import / place affordance

They should not mimic marketplace cards.

Treat them as instrument modules.

## Accessibility Requirements

The frontend must satisfy these implementation constraints:

- all tabs keyboard navigable
- all mode switches keyboard operable
- all drawer states focus-visible
- all icon-only buttons labeled
- contrast at WCAG 2.2 AA minimum
- reduced-motion friendly transitions
- 44px minimum touch targets for major controls

## Proposed First Version Scope

### Required In V1

- stable shell
- left setup rail
- center multi-widget workspace
- right analysis rail with tabs
- bottom trace drawer with tabs
- mode switch for manual/copilot/autonomous
- blue-white academic design tokens

### Not Required In V1

- polished notebook authoring
- advanced persistence
- collaboration features
- deeply customized animation
- full agent transcript styling system

## Recommended Frontend Module Split

Suggested directory direction:

- `frontend/src/vaStudio/`
- `frontend/src/vaStudio/layout/`
- `frontend/src/vaStudio/panels/`
- `frontend/src/vaStudio/workspace/`
- `frontend/src/vaStudio/trace/`
- `frontend/src/vaStudio/evidence/`
- `frontend/src/vaStudio/modes/`

This should stay distinct from the older runtime-debug-oriented shell.

## QA Checklist

- Is the workspace still the dominant visual object in all modes?
- Can the user understand the system without opening the agent tab?
- Can copilot and autonomous be demonstrated without switching to a different page?
- Are inspect and trace clearly separated by cognitive role?
- Does the right rail stay usable without becoming a long debug column?
- Does the UI read as academic blue-white rather than purple SaaS?
- Can the frontend show imported widgets, multi-widget coordination, and agentic execution in one coherent shell?

