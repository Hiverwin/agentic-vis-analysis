import { createOfficialPageDockClient } from './officialPageDockClient.js'
import {
  buildDockTraceSteps,
  extractDockWorkspaceSummary,
} from './officialPageDockModel.js'

const DOCK_HOST_ID = 'widgetva-dock-host'
const DEFAULT_MODEL = 'deepseek/deepseek-v4-flash'
let installedDockController = null

const DOCK_STYLES = `
:host {
  color-scheme: light;
  --dock-blue: #225f9f;
  --dock-blue-strong: #174e87;
  --dock-blue-soft: #eef6ff;
  --dock-border: #b9cce3;
  --dock-text: #17263d;
  --dock-muted: #62738b;
  --dock-line: #dce7f5;
  --dock-success: #2f7d5c;
  --dock-failed: #a24b4b;
  --dock-surface: #fbfdff;
  --dock-raised: #ffffff;
  --dock-font: -apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif;
  --dock-mono: "SFMono-Regular", Menlo, Consolas, "Liberation Mono", monospace;
  font-family: var(--dock-font);
}

* {
  box-sizing: border-box;
}

.dock {
  position: fixed;
  top: 14px;
  right: 14px;
  width: 390px;
  max-height: calc(100vh - 28px);
  z-index: 2147483647;
  display: grid;
  grid-template-rows: auto minmax(0, auto) auto auto;
  overflow: hidden;
  border: 1px solid var(--dock-border);
  border-radius: 8px;
  background: rgba(251, 253, 255, 0.98);
  box-shadow: 0 16px 42px rgba(24, 47, 78, 0.16);
  backdrop-filter: blur(10px);
}

.dock.collapsed {
  width: 190px;
  grid-template-rows: auto;
  border-color: transparent;
  background: transparent;
  box-shadow: 0 10px 24px rgba(24, 47, 78, 0.18);
}

.dock.collapsed .dock-body,
.dock.collapsed .chat,
.dock.collapsed .composer,
.dock.collapsed .result,
.dock.collapsed .api-panel,
.dock.collapsed .dock-title span {
  display: none;
}

.dock-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: center;
  min-height: 42px;
  padding: 8px 10px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.14);
  background: var(--dock-blue-strong);
  color: #fff;
  cursor: grab;
  user-select: none;
  touch-action: none;
}

.dock.dragging .dock-header {
  cursor: grabbing;
}

.dock.collapsed .dock-header {
  grid-template-columns: minmax(0, 1fr) auto;
  border-radius: 8px;
  border-bottom: 0;
}

.dock-title {
  min-width: 0;
}

.dock-title strong {
  display: block;
  color: #fff;
  font-size: 13px;
  letter-spacing: 0;
  line-height: 1.2;
}

.dock-title span {
  display: block;
  margin-top: 2px;
  color: rgba(237, 246, 255, 0.76);
  font-family: var(--dock-mono);
  font-size: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 7px;
  border: 1px solid var(--dock-border);
  border-radius: 7px;
  color: var(--dock-muted);
  background: #fff;
  font-family: var(--dock-mono);
  font-size: 10px;
}

.status-dot::before {
  content: "";
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #9aa8ba;
}

.status-dot.ready::before,
.status-dot.success::before {
  background: var(--dock-success);
}

.status-dot.failed::before {
  background: var(--dock-failed);
}

.status-dot.running::before {
  background: var(--dock-blue);
  animation: widgetvaPulse 0.95s ease-in-out infinite;
}

button {
  appearance: none;
  border: 1px solid var(--dock-border);
  background: #fff;
  color: var(--dock-text);
  border-radius: 7px;
  font: inherit;
  cursor: pointer;
}

button:hover {
  border-color: #92b5df;
}

button:focus-visible,
textarea:focus-visible,
input:focus-visible {
  outline: 2px solid rgba(34, 95, 159, 0.28);
  outline-offset: 2px;
}

.primary-button {
  height: 24px;
  padding: 0 9px;
  border-color: var(--dock-blue);
  background: var(--dock-blue);
  color: #fff;
  font-size: 11px;
  font-weight: 650;
}

.primary-button:hover {
  background: var(--dock-blue-strong);
}

.icon-button {
  height: 24px;
  min-width: 38px;
  padding: 0 8px;
  display: inline-grid;
  place-items: center;
  border-color: rgba(255, 255, 255, 0.28);
  color: #fff;
  background: rgba(255, 255, 255, 0.1);
  font-size: 11px;
  font-weight: 650;
}

.icon-button:hover {
  border-color: rgba(255, 255, 255, 0.55);
  background: rgba(255, 255, 255, 0.16);
}

.dock-body {
  min-height: 0;
  overflow: auto;
  max-height: min(54vh, 430px);
}

.summary {
  padding: 10px 12px;
  border-bottom: 1px solid var(--dock-line);
}

.summary-header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  align-items: start;
}

.summary-controls {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  color: var(--dock-muted);
  font-size: 11px;
}

.summary-line strong {
  min-width: 0;
  color: var(--dock-text);
  text-align: right;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.tag-row {
  display: flex;
  gap: 7px;
  margin-top: 9px;
}

.meta-tag {
  height: 24px;
  padding: 0 8px;
  border-radius: 7px;
  color: #24527f;
  background: #fff;
  font-family: var(--dock-mono);
  font-size: 10px;
}

.chat {
  min-height: 0;
  overflow: auto;
  padding: 12px;
  max-height: min(34vh, 280px);
}

.message {
  margin: 0 0 12px;
  padding-left: 10px;
  border-left: 2px solid var(--dock-line);
}

.message.restorable {
  border-left-color: #79a9d9;
  border-radius: 7px;
  cursor: pointer;
  margin-left: -5px;
  padding: 7px 8px 8px 13px;
  transition:
    background-color 0.16s ease,
    box-shadow 0.16s ease,
    transform 0.16s ease,
    border-color 0.16s ease;
}

.message.restorable:hover,
.message.restorable:focus-visible {
  background: rgba(34, 95, 159, 0.07);
  border-left-color: var(--dock-blue);
  box-shadow: 0 6px 16px rgba(34, 95, 159, 0.11);
  outline: none;
  transform: translateX(2px);
}

.message.restorable:active {
  transform: translateX(2px) scale(0.995);
}

.message.user {
  border-left-color: var(--dock-blue);
}

.message.assistant {
  border-left-color: #79a9d9;
}

.message.assistant.running {
  border-left-color: var(--dock-blue);
}

.message.system {
  border-left-color: #b5c5d7;
}

.message-meta {
  color: var(--dock-muted);
  font-family: var(--dock-mono);
  font-size: 10px;
}

.message-step-label {
  color: var(--dock-blue);
}

.message-text {
  margin-top: 4px;
  color: var(--dock-text);
  font-size: 12px;
  line-height: 1.48;
  white-space: pre-wrap;
}

.activity-row {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.spinner {
  width: 13px;
  height: 13px;
  border: 2px solid #c9d8ea;
  border-top-color: var(--dock-blue);
  border-radius: 999px;
  animation: widgetvaSpin 0.8s linear infinite;
  flex: 0 0 auto;
}

.activity-dots::after {
  content: "";
  animation: widgetvaDots 1.1s steps(4, end) infinite;
}

.empty {
  color: var(--dock-muted);
  font-size: 12px;
  line-height: 1.45;
}

.trace {
  padding: 10px 12px 12px;
  border-top: 1px solid var(--dock-line);
  border-bottom: 1px solid var(--dock-line);
}

.trace[hidden] {
  display: none;
}

.section-title {
  margin: 0 0 8px;
  color: var(--dock-muted);
  font-family: var(--dock-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.trace-scroll {
  overflow-x: auto;
  overflow-y: hidden;
  cursor: grab;
  padding: 2px 2px 6px;
  user-select: none;
  scrollbar-width: thin;
}

.trace-scroll.dragging {
  cursor: grabbing;
}

.trace-track {
  display: flex;
  align-items: center;
  min-height: 52px;
  width: max-content;
}

.trace-node-wrap {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 42px;
  height: 42px;
  flex: 0 0 auto;
}

.trace-node {
  position: relative;
  width: 30px;
  height: 30px;
  padding: 0;
  display: inline-grid;
  place-items: center;
  border-radius: 999px;
  border-color: #b8cbe4;
  background: #fff;
  color: var(--dock-blue);
  font-family: var(--dock-mono);
  font-size: 11px;
  font-weight: 700;
  touch-action: none;
  transition: transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease;
}

.trace-node:hover,
.trace-node:focus-visible {
  transform: translateY(-1px);
  box-shadow: 0 6px 14px rgba(34, 95, 159, 0.16);
}

.trace-node.active {
  border-color: var(--dock-blue);
  box-shadow: 0 0 0 3px rgba(34, 95, 159, 0.12);
}

.trace-node.success {
  border-color: #8fc6ae;
  color: var(--dock-success);
}

.trace-node.failed {
  border-color: #d8a4a4;
  color: var(--dock-failed);
}

.trace-node.running {
  border-color: #8ab7e6;
  color: var(--dock-blue);
}

.trace-node.running::after {
  content: "";
  position: absolute;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(34, 95, 159, 0.2);
  border-top-color: rgba(34, 95, 159, 0.8);
  border-radius: 999px;
  animation: widgetvaSpin 1s linear infinite;
}

.trace-node.dragging {
  cursor: grabbing;
  transform: translateY(-1px) scale(0.98);
}

.trace-edge {
  width: 34px;
  height: 6px;
  flex: 0 0 auto;
  color: #a9bdd5;
}

.result {
  padding: 10px 12px;
  border-bottom: 1px solid var(--dock-line);
}

.result[hidden],
.api-panel[hidden] {
  display: none;
}

.result-answer {
  color: var(--dock-text);
  font-size: 12px;
  line-height: 1.45;
}

.result-time {
  margin-top: 5px;
  color: var(--dock-muted);
  font-family: var(--dock-mono);
  font-size: 10px;
}

.api-panel {
  padding: 10px 12px;
  border-top: 1px solid var(--dock-line);
  background: #f8fbff;
}

.api-grid {
  display: grid;
  gap: 8px;
}

.api-grid label {
  display: grid;
  gap: 4px;
  color: var(--dock-muted);
  font-size: 11px;
}

.api-grid input {
  width: 100%;
  height: 30px;
  border: 1px solid var(--dock-border);
  border-radius: 8px;
  padding: 0 8px;
  color: var(--dock-text);
  background: #fff;
  font: inherit;
  font-size: 12px;
}

.api-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.secondary-button {
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}

.composer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 8px;
  padding: 8px 10px 10px;
  border-top: 1px solid var(--dock-line);
}

.composer textarea {
  width: 100%;
  min-height: 42px;
  max-height: 92px;
  box-sizing: border-box;
  resize: vertical;
  overflow: auto;
  border: 1px solid var(--dock-border);
  border-radius: 7px;
  padding: 8px 9px;
  color: var(--dock-text);
  background: #fff;
  font: inherit;
  font-size: 12px;
  line-height: 1.4;
}

.send-button {
  align-self: end;
  width: 42px;
  height: 34px;
  border-color: var(--dock-blue);
  background: var(--dock-blue);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
}

.popover {
  position: absolute;
  z-index: 2147483647;
  width: min(320px, calc(100% - 24px));
  padding: 10px;
  border: 1px solid var(--dock-border);
  border-radius: 8px;
  background: #fff;
  color: var(--dock-text);
  box-shadow: 0 16px 36px rgba(22, 48, 85, 0.18);
  font-size: 11px;
  line-height: 1.42;
}

@keyframes widgetvaSpin {
  to {
    transform: rotate(360deg);
  }
}

@keyframes widgetvaPulse {
  0%, 100% {
    transform: scale(1);
    opacity: 0.72;
  }
  50% {
    transform: scale(1.5);
    opacity: 1;
  }
}

@keyframes widgetvaDots {
  0% {
    content: "";
  }
  25% {
    content: ".";
  }
  50% {
    content: "..";
  }
  75%, 100% {
    content: "...";
  }
}

.popover[hidden] {
  display: none;
}

.popover-title {
  margin-bottom: 6px;
  color: var(--dock-blue);
  font-family: var(--dock-mono);
  font-size: 10px;
}

.popover-code {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--dock-mono);
  font-size: 10px;
}

@media (max-width: 520px) {
  .dock {
    left: 10px;
    right: 10px;
    width: auto;
  }
}
`

function formatError(error) {
  return error?.message || String(error || 'Unknown error.')
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return ''
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function createElement(tag, className = '', text = '') {
  const element = document.createElement(tag)
  if (className) element.className = className
  if (text) element.textContent = text
  return element
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function summarizeTraceParams(params = {}) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) return ''
  return Object.entries(params)
    .filter(([, value]) => value != null && value !== '')
    .slice(0, 3)
    .map(([key, value]) => {
      if (Array.isArray(value)) return `${key}: ${value.join(', ')}`
      if (value && typeof value === 'object') return `${key}: ${JSON.stringify(value).slice(0, 80)}`
      return `${key}: ${String(value)}`
    })
    .join('\n')
}

function formatTracePopover(step = {}) {
  return [
    `Action: ${step.operation?.name || 'None'}`,
    summarizeTraceParams(step.operation?.params || {}),
  ].filter((line) => typeof line === 'string' && line.trim().length > 0).join('\n\n')
}

function createTraceEdgeElement() {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.setAttribute('class', 'trace-edge')
  svg.setAttribute('viewBox', '0 0 34 6')
  svg.setAttribute('aria-hidden', 'true')
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', 'M2 3 H32')
  path.setAttribute('fill', 'none')
  path.setAttribute('stroke', 'currentColor')
  path.setAttribute('stroke-width', '1.5')
  path.setAttribute('stroke-linecap', 'round')
  svg.appendChild(path)
  return svg
}

function renderJson(value) {
  if (value == null) return 'None'
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function ensureDocumentRoot(callback) {
  if (document.documentElement) {
    callback()
    return
  }
  document.addEventListener('readystatechange', () => {
    if (document.documentElement) callback()
  }, { once: true })
}

export function installWidgetVADock({
  routeLabel = 'Official page',
  provider = 'unknown',
  root = window,
  ensurePageScript = null,
  openOnInstall = false,
} = {}) {
  if (document.getElementById(DOCK_HOST_ID)) {
    return installedDockController
  }

  const client = createOfficialPageDockClient(root)
  const state = {
    routeLabel,
    provider,
    collapsed: !openOnInstall,
    binding: false,
    bound: false,
    running: false,
    status: 'idle',
    statusText: 'Not bound',
    apiConfig: null,
    pendingObjective: null,
    queuedObjectives: [],
    snapshot: null,
    messages: [{
      role: 'system',
      label: 'Dock',
      text: 'Bind this page to start using WidgetVA.',
    }],
    traceSteps: [],
    result: null,
    activeTraceStepId: null,
  }

  const host = document.createElement('div')
  host.id = DOCK_HOST_ID
  const shadow = host.attachShadow({ mode: 'open' })
  shadow.innerHTML = `
    <style>${DOCK_STYLES}</style>
    <section class="dock" aria-label="WidgetVA Dock">
      <header class="dock-header" data-role="header">
        <div class="dock-title">
          <strong>WidgetVA Dock</strong>
          <span data-role="route"></span>
        </div>
        <button class="icon-button" data-action="collapse" type="button" aria-label="Open WidgetVA Dock">Open</button>
      </header>
      <div class="dock-body">
        <section class="summary" aria-label="Bound widget summary">
          <div class="summary-header">
            <div class="summary-line"><span>Widget</span><strong data-role="widget">None</strong></div>
            <div class="summary-controls">
              <span class="status-dot" data-role="status">idle</span>
              <button class="primary-button" data-action="bind" type="button">Bind</button>
            </div>
          </div>
          <div class="tag-row" data-role="tags"></div>
        </section>
        <section class="chat" data-role="chat" aria-label="Agent conversation"></section>
        <section class="trace" data-role="trace" aria-label="Trace">
          <p class="section-title">Trace</p>
          <div class="trace-scroll" data-role="trace-scroll">
            <div class="trace-track" data-role="trace-track"></div>
          </div>
        </section>
      </div>
      <section class="result" data-role="result" hidden>
        <p class="section-title">Result</p>
        <div class="result-answer" data-role="result-answer"></div>
        <div class="result-time" data-role="result-time"></div>
      </section>
      <section class="api-panel" data-role="api-panel" hidden>
        <p class="section-title">OpenRouter</p>
        <div class="api-grid">
          <label>API key<input data-role="api-key" type="password" autocomplete="off"></label>
          <label>Model<input data-role="api-model" type="text"></label>
        </div>
        <div class="api-actions">
          <button class="primary-button" data-action="save-api" type="button">Save and Run</button>
          <button class="secondary-button" data-action="cancel-api" type="button">Cancel</button>
        </div>
      </section>
      <form class="composer" data-role="composer">
        <textarea data-role="input" placeholder="Ask WidgetVA to inspect or interact with this visualization"></textarea>
        <button class="send-button" type="submit" aria-label="Send request">→</button>
      </form>
      <div class="popover" data-role="popover" hidden>
        <div class="popover-title" data-role="popover-title"></div>
        <pre class="popover-code" data-role="popover-body"></pre>
      </div>
    </section>
  `

  ensureDocumentRoot(() => {
    document.documentElement.appendChild(host)
  })

  const $ = (selector) => shadow.querySelector(selector)
  const elements = {
    dock: $('.dock'),
    header: $('[data-role="header"]'),
    route: $('[data-role="route"]'),
    status: $('[data-role="status"]'),
    bind: $('[data-action="bind"]'),
    collapse: $('[data-action="collapse"]'),
    widget: $('[data-role="widget"]'),
    tags: $('[data-role="tags"]'),
    chat: $('[data-role="chat"]'),
    traceScroll: $('[data-role="trace-scroll"]'),
    trace: $('[data-role="trace"]'),
    traceTrack: $('[data-role="trace-track"]'),
    result: $('[data-role="result"]'),
    resultAnswer: $('[data-role="result-answer"]'),
    resultTime: $('[data-role="result-time"]'),
    composer: $('[data-role="composer"]'),
    input: $('[data-role="input"]'),
    apiPanel: $('[data-role="api-panel"]'),
    apiKey: $('[data-role="api-key"]'),
    apiModel: $('[data-role="api-model"]'),
    saveApi: $('[data-action="save-api"]'),
    cancelApi: $('[data-action="cancel-api"]'),
    popover: $('[data-role="popover"]'),
    popoverTitle: $('[data-role="popover-title"]'),
    popoverBody: $('[data-role="popover-body"]'),
  }
  let activePopoverAnchor = null
  let popoverHideTimer = null
  let dockDragPointerId = null
  let dockDragOffsetX = 0
  let dockDragOffsetY = 0
  let dockDragStartX = 0
  let dockDragStartY = 0
  let suppressHeaderClick = false

  function readViewportSize() {
    return {
      width: root.innerWidth || document.documentElement.clientWidth || 1024,
      height: root.innerHeight || document.documentElement.clientHeight || 768,
    }
  }

  function positionDock(left, top) {
    const viewport = readViewportSize()
    const rect = elements.dock.getBoundingClientRect()
    const width = rect.width || elements.dock.offsetWidth || 190
    const height = rect.height || elements.dock.offsetHeight || 42
    const maxLeft = Math.max(8, viewport.width - width - 8)
    const maxTop = Math.max(8, viewport.height - Math.min(height, viewport.height - 16) - 8)
    elements.dock.style.left = `${clamp(left, 8, maxLeft)}px`
    elements.dock.style.top = `${clamp(top, 8, maxTop)}px`
    elements.dock.style.right = 'auto'
  }

  function keepDockInViewport() {
    const rect = elements.dock.getBoundingClientRect()
    positionDock(rect.left, rect.top)
  }

  function isHeaderControl(target) {
    return Boolean(target?.closest?.('button, input, textarea, a, select'))
  }

  function isolateDockInputEvent(event) {
    event.stopPropagation?.()
  }

  ;[
    'beforeinput',
    'input',
    'keydown',
    'keypress',
    'keyup',
    'compositionstart',
    'compositionupdate',
    'compositionend',
    'paste',
    'copy',
    'cut',
  ].forEach((eventName) => {
    shadow.addEventListener(eventName, isolateDockInputEvent)
    host.addEventListener(eventName, isolateDockInputEvent)
  })

  function addMessage(role, text, {
    label = role,
    stepId = null,
    running = false,
  } = {}) {
    state.messages.push({ role, text, label, stepId, running })
    renderMessages()
  }

  function hasMessageForStep(stepId) {
    return Boolean(stepId) && state.messages.some((message) => message.stepId === stepId)
  }

  function clearRunningMessages() {
    for (const message of state.messages) {
      if (message.running) message.running = false
    }
  }

  function readSummary() {
    return extractDockWorkspaceSummary(state.snapshot || {})
  }

  function renderHeader() {
    elements.dock.classList.toggle('collapsed', state.collapsed)
    elements.route.textContent = state.routeLabel
    elements.status.textContent = state.statusText
    elements.status.className = `status-dot ${state.status}`
    elements.bind.textContent = state.binding ? 'Binding' : state.bound ? 'Rebind' : 'Bind'
    elements.bind.disabled = state.binding
    elements.collapse.textContent = state.collapsed ? 'Open' : 'Hide'
    elements.collapse.setAttribute(
      'aria-label',
      state.collapsed ? 'Expand WidgetVA Dock' : 'Collapse WidgetVA Dock',
    )
  }

  function renderSummary() {
    const summary = readSummary()
    elements.widget.textContent = summary.widget.kind
      ? `${summary.widget.kind} · ${summary.widget.label}`
      : 'None'
    elements.tags.textContent = ''

    const tags = [
      {
        label: 'Widget',
        title: 'Widget',
        body: renderJson(summary.widget),
      },
      {
        label: 'Links',
        title: 'Links',
        body: summary.links.length > 0
          ? summary.links.map((link) => {
            const suffix = [
              link.kind ? `(${link.kind})` : '',
              link.count > 1 ? `x${link.count}` : '',
            ].filter(Boolean).join(' ')
            return `${link.label}${suffix ? ` ${suffix}` : ''}`
          }).join('\n')
          : 'No links exposed.',
      },
      {
        label: 'Tools',
        title: 'Tools',
        body: [
          `Actions:\n${summary.tools.actions.length > 0 ? summary.tools.actions.join('\n') : 'None'}`,
          `Perceptions:\n${summary.tools.perceptions.length > 0 ? summary.tools.perceptions.join('\n') : 'None'}`,
        ].join('\n\n'),
      },
    ]

    for (const tag of tags) {
      const button = createElement('button', 'meta-tag', tag.label)
      button.type = 'button'
      button.addEventListener('mouseenter', () => showPopover(button, tag.title, tag.body))
      button.addEventListener('mouseleave', scheduleHidePopover)
      button.addEventListener('focus', () => showPopover(button, tag.title, tag.body))
      button.addEventListener('blur', scheduleHidePopover)
      elements.tags.appendChild(button)
    }
  }

  function renderMessages() {
    elements.chat.textContent = ''
    if (state.messages.length === 0) {
      elements.chat.appendChild(createElement('div', 'empty', 'No conversation yet.'))
      return
    }

    for (const message of state.messages) {
      const item = createElement('article', `message ${message.role}${message.running ? ' running' : ''}`)
      if (message.stepId) item.dataset.stepId = message.stepId
      const meta = createElement('div', 'message-meta', message.label || message.role)
      const step = message.stepId
        ? state.traceSteps.find((entry) => entry.id === message.stepId) || null
        : null
      if (step) {
        item.classList.add('restorable')
        item.tabIndex = 0
        item.setAttribute('role', 'button')
        item.setAttribute('aria-label', `Restore ${step.label}`)
        item.addEventListener('click', () => {
          void restoreTraceStep(step)
        })
        item.addEventListener('keydown', (event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          void restoreTraceStep(step)
        })
        meta.textContent = ''
        meta.appendChild(createElement('span', 'message-step-label', message.label || step.label))
      }
      const text = createElement('div', 'message-text')
      if (message.running) {
        const row = createElement('span', 'activity-row')
        row.append(
          createElement('span', 'spinner'),
          createElement('span', 'activity-dots', message.text || ''),
        )
        text.appendChild(row)
      } else {
        text.textContent = message.text || ''
      }
      item.append(meta, text)
      elements.chat.appendChild(item)
    }
    elements.chat.scrollTop = elements.chat.scrollHeight
  }

  function renderTrace() {
    elements.traceTrack.textContent = ''
    if (state.traceSteps.length === 0) {
      elements.trace.hidden = true
      return
    }
    elements.trace.hidden = false
    const displaySteps = state.traceSteps[0]?.id === 'state_0'
      ? state.traceSteps
      : [
          {
            id: 'state_0_display',
            label: 'State 0',
            status: 'success',
            operation: { kind: null, name: null, params: {} },
            state: {
              stateId: state.snapshot?.state?.stateId || state.snapshot?.observation?.state?.stateId || null,
              recoverableState: state.snapshot?.state || state.snapshot?.observation?.state || null,
              updatedRefs: [],
              summary: 'Initial state.',
            },
          },
          ...state.traceSteps,
        ]

    displaySteps.forEach((step, index) => {
      if (index > 0) elements.traceTrack.appendChild(createTraceEdgeElement())
      const wrap = createElement('span', 'trace-node-wrap')
      const activeClass = state.activeTraceStepId === step.id ? ' active' : ''
      const node = createElement('button', `trace-node ${step.status}${activeClass}`, String(index))
      node.type = 'button'
      node.setAttribute('aria-label', `${step.label}: ${step.operation?.name || 'agent step'}`)
      node.addEventListener('mouseenter', () => {
        showPopover(node, step.label, formatTracePopover(step))
      })
      node.addEventListener('mouseleave', scheduleHidePopover)
      node.addEventListener('focus', () => showPopover(node, step.label, formatTracePopover(step)))
      node.addEventListener('blur', scheduleHidePopover)
      node.addEventListener('click', () => {
        if (suppressTraceClick) return
        void restoreTraceStep(step)
      })
      installTraceNodeDrag(node, step)
      wrap.appendChild(node)
      elements.traceTrack.appendChild(wrap)
    })
  }

  function renderResult() {
    const hasResult = Boolean(state.result?.answer)
    elements.result.hidden = !hasResult
    elements.resultAnswer.textContent = state.result?.answer || ''
    elements.resultTime.textContent = state.result?.durationText ? `Total time ${state.result.durationText}` : ''
  }

  function renderApiPanel() {
    elements.apiPanel.hidden = !state.pendingObjective
    if (!elements.apiModel.value) {
      elements.apiModel.value = state.apiConfig?.model || DEFAULT_MODEL
    }
  }

  function render() {
    renderHeader()
    renderSummary()
    renderMessages()
    renderTrace()
    renderResult()
    renderApiPanel()
    root.requestAnimationFrame?.(keepDockInViewport) || setTimeout(keepDockInViewport, 0)
  }

  function showPopover(anchor, title, body) {
    clearPopoverHideTimer()
    activePopoverAnchor = anchor
    const rect = anchor.getBoundingClientRect()
    const dockRect = elements.dock.getBoundingClientRect()
    elements.popoverTitle.textContent = title
    elements.popoverBody.textContent = body
    elements.popover.hidden = false
    const left = Math.min(
      Math.max(12, rect.left - dockRect.left),
      Math.max(12, dockRect.width - 332),
    )
    const top = Math.min(
      rect.bottom - dockRect.top + 8,
      Math.max(12, dockRect.height - 180),
    )
    elements.popover.style.left = `${left}px`
    elements.popover.style.top = `${top}px`
  }

  function clearPopoverHideTimer() {
    if (popoverHideTimer) {
      clearTimeout(popoverHideTimer)
      popoverHideTimer = null
    }
  }

  function scheduleHidePopover() {
    clearPopoverHideTimer()
    popoverHideTimer = setTimeout(() => {
      const anchorHovered = activePopoverAnchor?.matches?.(':hover')
      const anchorFocused = activePopoverAnchor && shadow.activeElement === activePopoverAnchor
      const popoverHovered = elements.popover.matches(':hover')
      if (anchorHovered || anchorFocused || popoverHovered) return
      hidePopover()
    }, 120)
  }

  function hidePopover() {
    clearPopoverHideTimer()
    activePopoverAnchor = null
    elements.popover.hidden = true
  }

  elements.popover.addEventListener('mouseenter', clearPopoverHideTimer)
  elements.popover.addEventListener('mouseleave', scheduleHidePopover)

  async function refreshAgentConfig() {
    try {
      state.apiConfig = await client.readAgentConfig()
    } catch {
      state.apiConfig = null
    }
    renderApiPanel()
  }

  async function bindPage() {
    state.binding = true
    state.status = 'running'
    state.statusText = 'Preparing'
    renderHeader()
    try {
      if (typeof ensurePageScript === 'function') {
        await ensurePageScript()
      }
      state.statusText = 'Binding'
      renderHeader()
      const snapshot = await client.request('bind', { forceReattach: true })
      state.snapshot = snapshot
      state.bound = snapshot?.status === 'ready'
      if (!state.bound) {
        throw new Error(`WidgetVA binding did not reach ready. Status: ${snapshot?.status || 'idle'}.`)
      }
      state.status = state.bound ? 'ready' : 'idle'
      state.statusText = state.bound ? 'Bound' : snapshot?.status || 'Idle'
      if (state.bound) {
        addMessage('system', 'Page bound to WidgetVA runtime.', { label: 'Bind' })
      }
    } catch (error) {
      state.status = 'failed'
      state.statusText = 'Bind failed'
      addMessage('system', formatError(error), { label: 'Bind failed' })
    } finally {
      state.binding = false
      render()
    }
  }

  async function ensureReadyForAgent(objective) {
    if (!state.bound) {
      await bindPage()
    }
    if (!state.bound) return false

    await refreshAgentConfig()
    if (!state.apiConfig?.apiKeyConfigured) {
      state.pendingObjective = objective
      addMessage('system', 'Add your OpenRouter API key once. It will be stored by the extension runtime.', {
        label: 'API key',
      })
      render()
      return false
    }
    return true
  }

  function applySessionResult(result, durationMs) {
    const session = result?.session || {}
    const snapshot = result?.snapshot || null
    if (snapshot) state.snapshot = snapshot
    state.traceSteps = buildDockTraceSteps({ session, snapshot })

    for (const step of state.traceSteps) {
      if (step.reply && !hasMessageForStep(step.id)) {
        addMessage('assistant', step.reply, {
          label: `${step.label} · ${step.operation?.name || step.operation?.kind || 'agent'}`,
          stepId: step.id,
        })
      }
    }

    state.result = {
      answer: session.finalAnswer || session.answer || state.traceSteps.at(-1)?.reply || 'Finished.',
      durationText: formatDuration(durationMs),
    }
  }

  function applySessionProgress(payload = {}) {
    const progress = payload?.progress || {}
    const snapshot = payload?.snapshot || null
    if (snapshot) state.snapshot = snapshot
    const turns = Array.isArray(progress.turns)
      ? progress.turns
      : progress.turn
        ? [progress.turn]
        : []
    if (turns.length === 0) return

    const session = { turns }
    state.traceSteps = buildDockTraceSteps({ session, snapshot: snapshot || state.snapshot || {} })
    const latestStep = state.traceSteps.at(-1)
    if (latestStep?.id) {
      state.activeTraceStepId = latestStep.id
    }
    if (latestStep?.reply && !hasMessageForStep(latestStep.id)) {
      addMessage('assistant', latestStep.reply, {
        label: `${latestStep.label} · ${latestStep.operation?.name || latestStep.operation?.kind || 'agent'}`,
        stepId: latestStep.id,
      })
    }
    render()
  }

  async function runObjective(objective, { recordUser = true } = {}) {
    const trimmed = typeof objective === 'string' ? objective.trim() : ''
    if (!trimmed) return

    if (recordUser) {
      addMessage('user', trimmed, { label: 'You' })
    }

    if (state.running) {
      state.queuedObjectives.push(trimmed)
      addMessage('system', 'Queued as follow-up guidance.', { label: 'Queue' })
      return
    }

    const ready = await ensureReadyForAgent(trimmed)
    if (!ready) return

    state.running = true
    state.status = 'running'
    state.statusText = 'Analyzing'
    addMessage('assistant', 'Agent is analyzing this visualization', {
      label: 'Agent',
      running: true,
    })
    render()

    const startedAt = performance.now()
    try {
      const result = await client.request('runSession', {
        objective: trimmed,
        maxTurns: 8,
        chatTimeoutMs: 90000,
      }, {
        timeoutMs: 300000,
        onProgress: applySessionProgress,
      })
      clearRunningMessages()
      applySessionResult(result, performance.now() - startedAt)
      state.status = 'success'
      state.statusText = 'Done'
    } catch (error) {
      clearRunningMessages()
      state.status = 'failed'
      state.statusText = 'Failed'
      addMessage('assistant', formatError(error), { label: 'Error' })
    } finally {
      state.running = false
      render()
      const next = state.queuedObjectives.shift()
      if (next) {
        void runObjective(next, { recordUser: false })
      }
    }
  }

  async function restoreTraceStep(step) {
    const recoverableState = step?.state?.recoverableState || null
    const stateId = step?.state?.stateId || recoverableState?.stateId || null
    if (!stateId) {
      state.activeTraceStepId = step?.id || state.activeTraceStepId
      state.status = state.bound ? 'ready' : state.status
      state.statusText = 'No restorable state'
      render()
      return
    }

    try {
      const result = await client.request('restore', {
        stateId,
        ...(recoverableState ? { state: recoverableState } : {}),
      })
      if (result?.snapshot) state.snapshot = result.snapshot
      state.activeTraceStepId = step.id
      state.status = 'ready'
      state.statusText = `Restored ${step.label}`
      const message = shadow.querySelector(`[data-step-id="${step.id}"]`)
      if (message) message.scrollIntoView({ block: 'nearest' })
      render()
    } catch (error) {
      addMessage('system', formatError(error), { label: 'Restore failed' })
    }
  }

  async function saveApiAndRun() {
    const apiKey = elements.apiKey.value.trim()
    const model = elements.apiModel.value.trim() || DEFAULT_MODEL
    if (!apiKey) {
      addMessage('system', 'Enter an OpenRouter API key to continue.', { label: 'API key' })
      return
    }
    try {
      state.apiConfig = await client.configureAgent({
        apiKey,
        model,
        appName: 'WidgetVA Dock',
        siteUrl: window.location.origin,
      })
      elements.apiKey.value = ''
      const objective = state.pendingObjective
      state.pendingObjective = null
      addMessage('system', 'Agent configuration saved.', { label: 'API key' })
      render()
      if (objective) {
        void runObjective(objective, { recordUser: false })
      }
    } catch (error) {
      addMessage('system', formatError(error), { label: 'API key failed' })
    }
  }

  elements.header.addEventListener('pointerdown', (event) => {
    if (isHeaderControl(event.target)) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    const rect = elements.dock.getBoundingClientRect()
    dockDragPointerId = event.pointerId
    dockDragOffsetX = event.clientX - rect.left
    dockDragOffsetY = event.clientY - rect.top
    dockDragStartX = event.clientX
    dockDragStartY = event.clientY
    suppressHeaderClick = false
    elements.dock.classList.add('dragging')
    elements.header.setPointerCapture?.(event.pointerId)
  })
  elements.header.addEventListener('pointermove', (event) => {
    if (dockDragPointerId !== event.pointerId) return
    const deltaX = event.clientX - dockDragStartX
    const deltaY = event.clientY - dockDragStartY
    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      suppressHeaderClick = true
    }
    positionDock(event.clientX - dockDragOffsetX, event.clientY - dockDragOffsetY)
  })
  elements.header.addEventListener('pointerup', (event) => {
    if (dockDragPointerId !== event.pointerId) return
    dockDragPointerId = null
    elements.dock.classList.remove('dragging')
    elements.header.releasePointerCapture?.(event.pointerId)
    setTimeout(() => {
      suppressHeaderClick = false
    }, 0)
  })
  elements.header.addEventListener('pointercancel', (event) => {
    if (dockDragPointerId !== event.pointerId) return
    dockDragPointerId = null
    suppressHeaderClick = false
    elements.dock.classList.remove('dragging')
    elements.header.releasePointerCapture?.(event.pointerId)
  })
  root.addEventListener?.('resize', keepDockInViewport)

  elements.header.addEventListener('click', () => {
    if (suppressHeaderClick) return
    if (!state.collapsed) return
    state.collapsed = false
    render()
  })
  elements.bind.addEventListener('click', (event) => {
    event.stopPropagation()
    void bindPage()
  })
  elements.collapse.addEventListener('click', (event) => {
    event.stopPropagation()
    state.collapsed = !state.collapsed
    render()
  })
  elements.composer.addEventListener('submit', (event) => {
    event.preventDefault()
    const text = elements.input.value
    elements.input.value = ''
    void runObjective(text)
  })
  elements.input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      elements.composer.requestSubmit()
    }
  })
  elements.saveApi.addEventListener('click', () => {
    void saveApiAndRun()
  })
  elements.cancelApi.addEventListener('click', () => {
    state.pendingObjective = null
    renderApiPanel()
  })

  let dragStartX = 0
  let dragStartScroll = 0
  let suppressTraceClick = false
  elements.traceScroll.addEventListener('pointerdown', (event) => {
    if (event.target?.closest?.('.trace-node')) return
    dragStartX = event.clientX
    dragStartScroll = elements.traceScroll.scrollLeft
    suppressTraceClick = false
    elements.traceScroll.classList.add('dragging')
    elements.traceScroll.setPointerCapture?.(event.pointerId)
  })
  elements.traceScroll.addEventListener('pointermove', (event) => {
    if (!elements.traceScroll.classList.contains('dragging')) return
    const delta = event.clientX - dragStartX
    if (Math.abs(delta) > 4) suppressTraceClick = true
    elements.traceScroll.scrollLeft = dragStartScroll - delta
  })
  elements.traceScroll.addEventListener('pointerup', () => {
    elements.traceScroll.classList.remove('dragging')
    setTimeout(() => {
      suppressTraceClick = false
    }, 0)
  })
  elements.traceScroll.addEventListener('pointercancel', () => {
    elements.traceScroll.classList.remove('dragging')
    suppressTraceClick = false
  })

  function installTraceNodeDrag(node, step) {
    let pointerId = null
    let startX = 0
    let startScroll = 0
    let dragged = false

    node.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      pointerId = event.pointerId
      startX = event.clientX
      startScroll = elements.traceScroll.scrollLeft
      dragged = false
      node.classList.add('dragging')
      node.setPointerCapture?.(event.pointerId)
      event.stopPropagation()
    })

    node.addEventListener('pointermove', (event) => {
      if (pointerId !== event.pointerId) return
      const delta = event.clientX - startX
      if (Math.abs(delta) > 4) {
        dragged = true
        suppressTraceClick = true
      }
      if (dragged) {
        elements.traceScroll.scrollLeft = startScroll - delta
      }
    })

    node.addEventListener('pointerup', (event) => {
      if (pointerId !== event.pointerId) return
      pointerId = null
      node.classList.remove('dragging')
      node.releasePointerCapture?.(event.pointerId)
      event.stopPropagation()
      if (!dragged) {
        suppressTraceClick = true
        void restoreTraceStep(step)
      }
      setTimeout(() => {
        suppressTraceClick = false
      }, 0)
    })

    node.addEventListener('pointercancel', (event) => {
      if (pointerId !== event.pointerId) return
      pointerId = null
      dragged = false
      suppressTraceClick = false
      node.classList.remove('dragging')
      node.releasePointerCapture?.(event.pointerId)
    })
  }

  const controller = {
    host,
    refresh: render,
    bind: bindPage,
    isBound: () => state.bound,
    open() {
      state.collapsed = false
      render()
    },
  }

  installedDockController = controller

  render()
  void refreshAgentConfig()

  return controller
}
