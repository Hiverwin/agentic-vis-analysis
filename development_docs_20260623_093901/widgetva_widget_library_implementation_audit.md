# WidgetVA Widget Library Implementation Audit

本文基于当前仓库里的 `widgetva-kit` 实现，整理你关心的几条主线：

- 对外暴露的接口是否以 `widget` 为中心
- 每个 widget abstraction 是否内置 runtime / framework
- widget 之间是否主要通过 `action / perception` 区分能力
- 是否同时支持单 widget import 和多 widgets + workspace
- 是否支持多种可视化语言 / 渲染框架
- agent 是否通过 transport 层操作 widget / workspace 做分析

---

## 1. 结论总览

当前 `widgetva-kit` 已经基本落成一个 `widget-first` 的库：

1. 根入口 `widgetva-kit/src/index.js` 只直接导出 `widgets` 和 `workspace` 两类公共 API。
2. `core / adapters / transport` 不是根入口默认暴露，而是通过子路径导出，如 `widgetva-kit/adapters`、`widgetva-kit/transports`。
3. 单个 widget 的运行形态是 `WidgetInstance`；多个 widget 的协同容器是 `WidgetWorkspace`。
4. 每个 widget family 都有自己的 `action descriptors` 和 `perception descriptors`，运行时注册到统一 runtime。
5. runtime 目前是统一的 `WidgetVA runtime`，widget abstraction 本身并不各自实现一套 runtime；它们主要通过 adapter 注入不同渲染框架和交互绑定。
6. 多种渲染语言 / 框架已经有 adapter 层：`vega-lite`、`d3`、`echarts`，并预留 `custom` / provider runtime 扩展点。
7. agent 的可操作面已经通过 transport 抽象出来，可在 in-page、Playwright、WebSocket、Browser Extension 上读状态、跑 action、查 perception、回放 trace。

---

## 2. 对外接口层

### 2.1 根入口导出

根入口只暴露 widget-first API。

来源：`widgetva-kit/src/index.js`

```js
export {
  WidgetInstance,
  createWidgetInstance,
  describeBarWidgetContract,
  describeHeatmapWidgetContract,
  describeLineWidgetContract,
  describeParallelCoordinatesWidgetContract,
  describeSankeyWidgetContract,
  describeScatterWidgetContract,
  SUPPORTED_WIDGET_TYPES,
  WIDGET_POOL_CONSTRUCTOR_FIELDS,
  createBarWidget,
  createHeatmapWidget,
  createLineWidget,
  createParallelCoordinateWidget,
  createParallelCoordinatesWidget,
  createSankeyWidget,
  createScatterWidget,
} from './widgets/index.js'

export {
  WidgetWorkspace,
  createWidgetWorkspace,
} from './workspace/index.js'
```

这说明当前“默认对外暴露的接口类型”确实是：

- `widget`
- `workspace`

### 2.2 package exports 结构

来源：`widgetva-kit/package.json`

```json
{
  "exports": {
    ".": "./src/index.js",
    "./core": "./src/core.js",
    "./core-compose": "./src/coreCompose.js",
    "./core-inspect": "./src/coreInspect.js",
    "./core-runtime": "./src/coreRuntime.js",
    "./adapters": "./src/adapters.js",
    "./transport": "./src/transport.js",
    "./transports": "./src/transports.js",
    "./widgets": "./src/widgets.js",
    "./workspace": "./src/workspace.js"
  }
}
```

因此现在的公共使用方式分两层：

- 默认根入口：面向业务使用者，偏 `widget/workspace`
- 子路径入口：面向扩展者，偏 `core/adapters/transports`

---

## 3. 核心模块与子模块

`widgetva-kit/src` 当前主模块树：

```text
widgetva-kit/src
├── adapters
│   ├── widgetFamilies
│   └── widgets
├── core
│   ├── data
│   ├── examples
│   ├── protocol
│   ├── rendering
│   └── runtime
├── transports
├── widgets
│   ├── bar
│   ├── heatmap
│   ├── line
│   ├── parallelCoordinates
│   ├── sankey
│   └── scatter
└── workspace
    └── state
```

推荐把它理解为 5 层：

1. `widgets/`
   单 widget API、family contract、pool/factory。
2. `workspace/`
   多 widget 编排、共享协调状态、links、workspace 级读写。
3. `adapters/`
   把 widget runtime contract 适配到 Vega-Lite / D3 / ECharts / custom provider。
4. `core/`
   真正的 runtime、protocol、store、trace、page port、planning。
5. `transports/`
   agent / 外部客户端如何跨边界操作 runtime。

---

## 4. Widget abstraction: 当前是“统一 runtime + 各 widget family 能力差异”

### 4.1 单 widget 的外部对象是 `WidgetInstance`

来源：`widgetva-kit/src/widgets/widgetInstance.js`

```js
export const WIDGET_INSTANCE_PUBLIC_METHODS = [
  'mount',
  'unmount',
  'isMounted',
  'describe',
  'listActionNames',
  'listPerceptionNames',
  'listActionDescriptors',
  'listPerceptionDescriptors',
  'readState',
  'readWorkspaceState',
  'executeAction',
  'queryPerception',
  'getTrace',
  'readSnapshot',
  'readSnapshotEntry',
  'replay',
  'dispose',
]
```

这里可以看出 widget abstraction 对外已经是完整可运行对象，而不是一段静态 spec。

### 4.2 runtime 是统一内置，不是每个 widget 各自一套 runtime

`WidgetInstance` 在没有传入 runtime 时，会内部创建 runtime；如果传入 runtime，则挂到共享 runtime 上。

来源：`widgetva-kit/src/widgets/widgetInstance.js`

```js
const nextRuntime = normalizedOptions.runtime || createWidgetVARuntime(normalizedOptions.runtimeOptions)
return new WidgetInstance({
  runtime: nextRuntime,
  ownsRuntime: !runtime,
})
```

配合 `createWidgetInstance` / `createTypedWidget` 的用法，当前模型是：

- widget abstraction 可以“自带一个 runtime 实例”独立运行
- 也可以“复用外部 runtime”加入同一个 workspace

所以更准确的定义不是“每个 widget abstraction 内置一套不同 runtime”，而是：

- 每个 widget abstraction 都能挂载到统一 runtime contract
- framework/rendering 差异放在 adapter 层
- action/perception 差异放在 widget family 层

### 4.3 单 widget 工厂

来源：`widgetva-kit/src/widgets/pool.js`

```js
export function createScatterWidget(options = {}) {
  return createTypedWidget('scatter', options)
}

export function createBarWidget(options = {}) {
  return createTypedWidget('bar', options)
}
```

`createTypedWidget()` 做了几件关键事：

- 合成 spec 与数据
- 在没有 runtime 时构造静态 `hostBridge`
- 选定对应 widget family adapter
- 最终返回 `WidgetInstance`

---

## 5. Widget 之间的差异：主要落在 action / perception contract

### 5.1 family contract 已经显式分离

来源：`widgetva-kit/src/widgets/scatter/index.js`

```js
export function describeScatterWidgetContract() {
  return {
    kind: 'scatter',
    actionNames: ['scatter.brushRegion', 'scatter.zoomDomain', 'scatter.identifyClusters', 'scatter.showRegression'],
    perceptionNames: [
      'perception.computeCorrelation',
      'perception.findOutliers',
      'perception.findExtremes',
    ],
  }
}
```

这说明当前 family 抽象的差异，不是 runtime 本身，而是：

- 支持哪些 action
- 支持哪些 perception query
- 这些能力如何绑定到具体 widget kind

### 5.2 action 是可执行操作，带 schema / precondition / effect

来源：`widgetva-kit/src/widgets/scatter/actions.js`

```js
makeActionDescriptor({
  name: 'scatter.brushRegion',
  title: 'Brush scatterplot region',
  primitive: 'select',
  category: 'selection',
  paramsSchema: {
    type: 'object',
    properties: {
      xField: { type: 'string' },
      yField: { type: 'string' },
      xRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
      yRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
    },
    required: ['xField', 'yField', 'xRange', 'yRange'],
  },
  effects: [
    makeSelectionEffect(selectionRef || widgetRef, 'Creates or updates an interval selection on the scatterplot.'),
  ],
})
```

这个设计已经具备 agent-friendly 特征：

- 可发现
- 可解释
- 可验证
- 可做前置/后置条件推理

### 5.3 perception 是只读分析查询

来源：`widgetva-kit/src/widgets/scatter/perception.js`

```js
makePerceptionDescriptor({
  name: 'perception.computeCorrelation',
  title: 'Compute correlation',
  category: 'compute',
  sideEffectFree: true,
  evidenceKinds: ['statisticalEvidence', 'correlationEvidence'],
})
```

这部分已经把 perception 和 action 清晰分开：

- `action`: 改状态
- `perception`: 读状态 / 算分析证据

这和你要的 “每个 widget 的 action 和 perception 工具不同” 是一致的。

---

## 6. 单 widget import：已经支持

### 6.1 单 widget 直接创建

当前最自然的用法是：

```js
import { createScatterWidget } from 'widgetva-kit'

const widget = createScatterWidget({
  spec: {
    mark: 'point',
    encoding: {
      x: { field: 'x', type: 'quantitative' },
      y: { field: 'y', type: 'quantitative' },
    },
    data: { values: [{ x: 1, y: 2 }] },
  },
})
```

对应实现依据：

- `widgetva-kit/src/index.js`
- `widgetva-kit/src/widgets/pool.js`

### 6.2 单 widget 可以独立执行 action / perception

来源：`widgetva-kit/src/widgets/widgetInstance.test.js`

```js
const actionResult = await widget.executeAction({
  name: 'widget.testSelect',
  params: { selection: ['a'] },
})

const perceptionResult = await widget.queryPerception({
  name: 'perception.inspectViewConfig',
  params: {},
})
```

因此现在的单 widget abstraction 已经具备：

- 独立 mount/render
- 独立 action 调用
- 独立 perception 查询
- trace / snapshot / replay

---

## 7. 多 widgets import：已经支持，并通过 workspace 管理

### 7.1 `WidgetWorkspace` 是多 widget 编排容器

来源：`widgetva-kit/src/workspace/widgetWorkspace.js`

```js
export const WIDGET_WORKSPACE_PUBLIC_METHODS = [
  'listWidgetDescriptions',
  'listWidgets',
  'getWidget',
  'registerWidget',
  'removeWidget',
  'listActionNames',
  'listPerceptionNames',
  'listActionDescriptors',
  'listPerceptionDescriptors',
  'listLinks',
  'getLink',
  'registerLink',
  'removeLink',
  'describe',
  'describeComposition',
  'readState',
  'readCoordinationState',
  'executeAction',
  'queryPerception',
  'getTrace',
  'replay',
]
```

这说明 workspace 并不只是视觉容器，而是：

- widget registry
- link registry
- shared coordination state
- workspace-level execution surface

### 7.2 多 widget 必须共享一个 runtime

来源：`widgetva-kit/src/workspace/widgetWorkspace.js`

```js
function resolveSharedRuntime(widgets = [], explicitRuntime = null) {
  if (explicitRuntime) return explicitRuntime
  const runtimes = widgets
    .map((widget) => widget?.runtime || null)
    .filter(Boolean)

  const [firstRuntime] = runtimes
  const mismatchedRuntime = runtimes.find((runtime) => runtime !== firstRuntime)
  if (mismatchedRuntime) {
    throw new Error('WidgetWorkspace requires all widget instances to share the same runtime.')
  }
}
```

所以当前设计很明确：

- 多 widget 不是松散并列
- 而是共同挂在一个 shared runtime 上

### 7.3 workspace 管理的是共享协调状态

workspace 当前显式维护的共享状态包括：

- `focusedWidget`
- `comparisonTargets`
- `globalFilters`
- `annotations`
- `selections.registry`
- `selections.views.primary`
- `selections.views.byWidget`
- `links.definitions`
- `links.topology`

对应代码：

- `widgetva-kit/src/workspace/widgetWorkspace.js`
- `widgetva-kit/src/workspace/state/selectionStateModel.js`
- `widgetva-kit/src/workspace/state/linkStateModel.js`
- `widgetva-kit/src/workspace/state/workspaceSharedStateMutators.js`

### 7.4 多 widget 组合示例

基于当前 API，可以这样组合：

```js
import {
  createBarWidget,
  createScatterWidget,
  createWidgetWorkspace,
} from 'widgetva-kit'

const scatter = createScatterWidget({ runtime, spec: scatterSpec })
const bar = createBarWidget({ runtime, spec: barSpec })

const workspace = createWidgetWorkspace({
  widgets: [scatter, bar],
  links: [
    {
      from: scatter.resolveWidgetRef(),
      to: bar.resolveWidgetRef(),
      kind: 'selectionFilter',
    },
  ],
})
```

这和你说的“多 widget 的情况下用 workspace 管理”是对齐的，而且已经是代码里的主路径。

---

## 8. runtime / core：关键内部模块

### 8.1 runtime 组装入口

来源：`widgetva-kit/src/core/runtime/createWidgetRuntime.js`

```js
const store = createRuntimeStore()
const traceRecorder = new InteractionTraceRecorder({ store })
const responseRecorder = new ResponseRecorder({ store })
const dataQueryExecutor = new DataQueryExecutor({ store, dataQueryEngine, traceRecorder })
const linkEngine = new LinkEngine({ store })
const actionExecutor = new ActionExecutor({ store, sync, hostBridge, linkEngine, traceRecorder })
const perceptionQueryRegistry = new PerceptionQueryRegistry({
  store,
  dataQueryEngine,
  dataQueryExecutor,
  traceRecorder,
  linkEngine,
})
```

runtime 的主要子模块已经比较稳定：

- `RuntimeStore`
- `ActionExecutor`
- `PerceptionQueryRegistry`
- `DataQueryExecutor`
- `LinkEngine`
- `InteractionTraceRecorder`
- `ResponseRecorder`
- `AgentLoopRuntime`
- `installWidgetVAPagePort`

### 8.2 AgentLoopRuntime 说明 agent 是一等公民

来源：`widgetva-kit/src/core/runtime/AgentLoopRuntime.js`

```js
const recommendedOrder = [
  'describeWorkspace',
  'readView',
  'queryPerception(optional)',
  'executeAction',
  'readView(deltaSince)',
  'queryPerception(verify)',
  'produceAnswerOrContinue',
]
```

这部分说明 runtime 已经在内部定义了 agent 操作 workspace 的标准循环：

- 描述 workspace
- 读 view/state
- 感知分析
- 执行动作
- 验证动作效果
- 记录 / 回放 / 分支

---

## 9. 不同可视化语言 / rendering framework：已支持 adapter 层扩展

### 9.1 adapter contract 是统一扩展点

来源：`widgetva-kit/src/adapters/widgetAdapterContract.js`

```js
export function createWidgetAdapterDefinition(definition) {
  return {
    provider: 'custom',
    providerCapabilities: defaultProviderCapabilities(),
    buildActionDescriptors: () => [],
    buildPerceptionDescriptors: () => [],
    registerActions: () => {},
    registerPerceptionQueries: () => {},
    bindHumanInteractions: () => () => {},
    applyState: () => {},
    createInstance(args) {
      return createWidgetAdapterInstance({
        definition,
        humanInteraction: definition.getHumanInteractionConfig?.(),
        bindHumanInteractions: definition.bindHumanInteractions,
        applyState: definition.applyState,
        ...args,
      })
    },
    ...definition,
  }
}
```

一个渲染语言要接入，核心上需要回答几件事：

- 如何描述 provider capability
- 如何绑定 human interaction
- 如何把 runtime state 应用到 view
- 如何注册 action / perception

### 9.2 Vega-Lite adapter

来源：`widgetva-kit/src/adapters/VegaLiteWidgetAdapter.js`

```js
providerCapabilities: {
  renderStrategy: 'vegaEmbed',
  stateApplyStrategy: 'signalPatch',
  interactionBindingStrategy: 'vegaViewListeners',
  supportsSignalPatching: true,
  supportsOptionMerging: false,
  supportsImperativeRender: false,
}
```

定位：

- 强依赖 Vega view listener
- 以 signal/state patch 为核心

### 9.3 D3 adapter

来源：`widgetva-kit/src/adapters/D3WidgetAdapter.js`

```js
providerCapabilities: {
  renderStrategy: 'providerView',
  stateApplyStrategy: 'imperativeRender',
  interactionBindingStrategy: 'providerEvents',
  supportsSignalPatching: false,
  supportsOptionMerging: false,
  supportsImperativeRender: true,
}
```

定位：

- 通过 provider 自己的 imperative render 接 runtime

### 9.4 ECharts adapter

来源：`widgetva-kit/src/adapters/EChartsWidgetAdapter.js`

```js
providerCapabilities: {
  renderStrategy: 'providerView',
  stateApplyStrategy: 'optionMerge',
  interactionBindingStrategy: 'providerEvents',
  supportsSignalPatching: false,
  supportsOptionMerging: true,
  supportsImperativeRender: false,
}
```

定位：

- 用 `setOption()` 做状态合并

### 9.5 当前结论

所以“支持各种可视化语言渲染出来的 widget”这件事，在当前库里的真实实现方式是：

- 不是每种可视化语言自己实现一整套 WidgetVA runtime
- 而是统一挂到 `adapter contract`
- rendering / state apply / interaction binding 由 provider adapter 定义

这一层已经不止 Vega-Lite：

- `vega-lite`
- `d3`
- `echarts`
- `custom`

---

## 10. agent 通过 transport 层操作 widget / workspace：已经支持

### 10.1 transport 公共接口

来源：`widgetva-kit/src/transports/index.js`

```js
export {
  createPlaywrightTransportClient,
  createWebSocketTransportClient,
  createBrowserExtensionTransportClient,
} from './publicTransportClients.js'
```

### 10.2 transport surface 是 widget/workspace-first

来源：`widgetva-kit/src/transports/widgetWorkspaceTransportSurface.js`

```js
return Object.assign(client, {
  describeWidget(options = {}) { ... },
  readWidgetState(options = {}) { ... },
  executeWidgetAction(call = {}) { ... },
  queryWidgetPerception(call = {}) { ... },
  readWidgetTrace(options = {}) { ... },
  replayWidget(stateIdOrOptions) { ... },
  readWorkspaceState(options = {}) { ... },
  executeWorkspaceAction(call = {}) { ... },
  queryWorkspacePerception(call = {}) { ... },
  readWorkspaceTrace(options = {}) { ... },
  replayWorkspace(stateIdOrOptions) { ... },
})
```

这说明 transport 层暴露给 agent 的抽象已经非常清晰：

- 描述 widget / workspace
- 读状态
- 跑 action
- 跑 perception
- 读 trace
- replay

### 10.3 in-page transport 直接对接 page port

来源：`widgetva-kit/src/transports/inPageTransport.js`

```js
export async function executeWorkspaceAction(call = {}) {
  return executeWorkspaceActionViaTransport(inPageTransportDelegate, call)
}

export async function queryWorkspacePerception(call = {}) {
  return queryWorkspacePerceptionViaTransport(inPageTransportDelegate, call)
}
```

### 10.4 Playwright transport

来源：`widgetva-kit/src/transports/publicTransportClients.js`

```js
export function createPlaywrightTransportClient(page) {
  return createWidgetWorkspaceTransportClient(new WidgetVAPlaywrightClient(page))
}
```

这意味着 agent 可以在浏览器自动化场景里直接调 widget/workspace surface。

### 10.5 WebSocket / Browser Extension bridge

来源：

- `widgetva-kit/src/transports/webSocketBridge.js`
- `widgetva-kit/src/transports/browserExtensionBridge.js`

两者本质上都做同一件事：

- 接收 transport alias
- 转发到 page port
- 返回执行结果

所以 transport 层已经不是单一环境绑定，而是一个跨宿主的控制平面。

### 10.6 agent 侧示例

```js
import { createPlaywrightTransportClient } from 'widgetva-kit/transports'

const client = createPlaywrightTransportClient(page)

const widget = await client.describeWidget({ widgetId: 'scatter_main' })
const before = await client.readWidgetState({ widgetId: 'scatter_main' })

await client.executeWidgetAction({
  name: 'scatter.brushRegion',
  targetRef: widget.ref,
  params: {
    xField: 'Horsepower',
    yField: 'Miles_per_Gallon',
    xRange: [80, 160],
    yRange: [20, 35],
  },
})

const after = await client.queryWidgetPerception({
  name: 'perception.computeCorrelation',
  targetRef: widget.ref,
  params: {
    xField: 'Horsepower',
    yField: 'Miles_per_Gallon',
  },
})
```

---

## 11. 当前实现和你的目标的对应关系

### 11.1 已经做到的

- 对外主接口是 `widget` / `workspace`
- 单 widget import 已支持
- 多 widgets import + workspace 管理已支持
- action / perception 已经成为 family-level capability contract
- agent transport 已经成型
- 多渲染框架 adapter 已经有基础骨架

### 11.2 当前更准确的系统定义

当前库不是“每个 widget abstraction 各自带一套不同 runtime”，而是：

- 一个统一 `WidgetVA runtime`
- 一组 widget family contract
- 一层 rendering/provider adapter
- 一层 workspace coordination
- 一层 agent transport

### 11.3 还可以继续补强的点

如果后面要更彻底支持“各种可视化语言渲染出的 widget”，建议优先继续补这几块：

1. 让 `adapter definition` 的 provider capability 再标准化一些，尤其是 selection mapping、highlight mapping、state diff apply。
2. 把更多 family adapter 从 Vega-Lite family 逻辑里抽离成真正 provider-agnostic 的 action/perception bundles。
3. 为 `workspace` 增加更明确的 import/composition API，而不只是通过 `widgets: []` 构造。
4. 把 transport / MCP surface 与 page port alias 的 schema 文档单独固化出来，方便 agent 侧自动发现。

---

## 12. 建议你后续把文档体系拆成 3 份

如果你后面想继续沉淀，我建议把这份 audit 再拆成三份稳定文档：

1. `widgetva_public_api.md`
   讲 root exports、subpath exports、import 方式。
2. `widgetva_runtime_and_workspace.md`
   讲 runtime/store/action/perception/workspace/link/trace。
3. `widgetva_adapter_and_transport.md`
   讲 provider adapter、page port、transport、agent integration。

这样更适合后续对外讲清楚“widget abstraction + runtime + workspace + transport”的完整故事。
