# WidgetVA Abstraction 分层图与接口草案

> 目的：把 `widget abstraction`、`runtime core`、`transport / agent interface` 三层明确拆开，避免后续设计时把“widget 自身能力”“运行时管理能力”“agent 调用面”混在一起。

---

## 1. 一句话结论

WidgetVA 更合理的分层不是：

```text
widget -> agent
```

而是：

```text
widget implementation
  ↓
widget adapter / abstraction
  ↓
runtime core
  ↓
workspace runtime
  ↓
page API / transport
  ↓
agent / human / test runner
```

其中：

- `widget abstraction` 回答：这个 widget 是什么，它天然支持什么。
- `runtime core` 回答：这些 widget 在页面里如何被统一管理、执行、观测、回放。
- `transport` 回答：外部如何调用 runtime。
- `agent` 只是 transport 的一个调用方，不是 runtime 的前提。

所以，在接入 agent 之前，runtime 不应该是空的；它至少已经要能支持 human 和 programmatic caller 通过同一套 contract 操作 widget。

---

## 2. 分层图

```text
┌──────────────────────────────────────────────────────────────┐
│                    Agent / Human / Test                      │
│   LLM Agent | UI Event Handler | Playwright | Benchmark      │
└───────────────────────────────▲──────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────┐
│                  Transport / External Surface                 │
│   window.__widgetVA | MCP | WebSocket | Browser Extension    │
└───────────────────────────────▲──────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────┐
│                     Workspace Runtime Layer                   │
│   workspace state | shared selections | links | topology     │
│   multi-widget coordination | replay | trace | branching     │
└───────────────────────────────▲──────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────┐
│                        Runtime Core Layer                     │
│   widget registry | state store | action executor            │
│   perception registry | data query executor | trace recorder │
└───────────────────────────────▲──────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────┐
│                  Widget Adapter / Abstraction                 │
│   widget description | action descriptors | perception       │
│   data handles | selection model | render/update hooks       │
└───────────────────────────────▲──────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────┐
│                   Concrete Widget Implementations             │
│   Vega-Lite | D3 | ECharts | Table | Canvas | Custom View    │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 每层职责

### 3.1 Concrete Widget Implementation

这是具体技术栈实现层，例如：

- Vega-Lite chart
- D3 chart
- ECharts chart
- custom table
- canvas / SVG / DOM hybrid widget

这一层只关心：

- 如何渲染
- 如何响应本地交互
- 如何暴露内部状态给 adapter

它不应该直接承担：

- agent 接口
- workspace coordination
- replay / trace / history

---

### 3.2 Widget Adapter / Abstraction

这是“把某个 widget 接入统一系统”的桥接层。

它回答的问题是：

```text
这个 widget 是什么？
它支持哪些动作？
它可以提供哪些证据？
它的数据视图如何被读取？
它的选择和高亮模型是什么？
```

这一层是 `widget-specific` 的。

不同 widget 的差异主要在这里：

- `actions` 不同
- `perception` 不同
- `selection semantics` 不同
- `state apply strategy` 不同

但它们要输出统一形状的 contract。

---

### 3.3 Runtime Core

这是“单个或多个 widget 已经接入以后”的统一执行环境。

它不关心 widget 是 Vega-Lite 还是 D3，它只关心：

- widget ref 是否存在
- action descriptor 是否存在
- action 如何执行
- state 如何变化
- query 如何返回结果
- trace 如何记录

这一层应该先于 agent 存在。

也就是说，即使没有 agent，runtime core 也应该已经能支持：

- human action 统一进入 action pipeline
- perception query 统一查询
- runtime state 统一维护
- trace / history 统一记录

---

### 3.4 Workspace Runtime

当存在多个 widget 时，单 widget runtime 不够，需要 workspace 层。

它回答的问题是：

```text
当前页面有哪些 widget？
这些 widget 如何联动？
共享选择和全局过滤放在哪里？
哪个 widget 是 focused widget？
哪些 state 是 widget-local，哪些是 workspace-global？
```

这一层应负责：

- workspace state
- widget links
- shared selection / shared filter
- propagation
- topology
- multi-widget replay / branch / trace

---

### 3.5 Transport / External Surface

这一层是 runtime 的对外调用面。

它的目标不是“再发明业务逻辑”，而是稳定暴露 runtime 已有能力。

调用者可能是：

- browser 内 agent
- backend MCP bridge
- Playwright benchmark runner
- browser extension
- manual developer tools

这一层的原则：

- surface 稳定
- 不暴露 implementation detail
- human 与 agent 尽量走同一语义 contract

---

## 4. 核心对象边界

建议把核心对象按“所属层”明确分类。

### 4.1 Abstraction 层对象

- `WidgetKind`
- `WidgetRef`
- `WidgetDescription`
- `ActionDescriptor`
- `PerceptionDescriptor`
- `DataHandleDescriptor`
- `SelectionModel`
- `WidgetAdapter`

### 4.2 Runtime Core 层对象

- `RuntimeStore`
- `WidgetRegistry`
- `ActionExecutor`
- `PerceptionRegistry`
- `DataQueryExecutor`
- `TraceRecorder`
- `StateManager`

### 4.3 Workspace 层对象

- `WorkspaceDescription`
- `WorkspaceState`
- `WidgetLink`
- `LinkEngine`
- `WorkspacePlanner` (optional / future)
- `ReplayContext`
- `BranchRegistry`

### 4.4 Transport 层对象

- `PagePort`
- `TransportClient`
- `McpToolMapping`
- `PlaywrightClient`
- `BrowserExtensionClient`

---

## 5. 最小接口草案

下面这套接口不是最终代码，而是用来固定边界。

### 5.1 Widget Adapter 接口

```ts
type WidgetRef = string
type DataRef = string
type SelectionRef = string

interface WidgetAdapter {
  kind: string

  describe(ctx: WidgetDescribeContext): WidgetDescription

  readState(ctx: WidgetReadContext): WidgetState

  applyState(
    patch: WidgetStatePatch,
    ctx: WidgetApplyContext,
  ): Promise<WidgetApplyResult> | WidgetApplyResult

  listActions(ctx: WidgetDescribeContext): ActionDescriptor[]

  listPerceptionQueries(ctx: WidgetDescribeContext): PerceptionDescriptor[]

  listDataHandles?(ctx: WidgetDescribeContext): DataHandleDescriptor[]
}
```

这个接口的重点是：

- adapter 负责“widget-specific semantics”
- adapter 不直接负责 workspace coordination
- adapter 不直接暴露 agent surface

---

### 5.2 Widget Description

```ts
interface WidgetDescription {
  ref: WidgetRef
  kind: string
  title?: string
  provider?: string

  primaryDataRef?: DataRef | null
  selectionModel?: SelectionModelSummary | null

  capabilities: {
    supportsSelection: boolean
    supportsHighlight: boolean
    supportsFiltering: boolean
    supportsDomainZoom: boolean
    supportsEncodingMutation: boolean
    supportsSpecMutation: boolean
  }

  actionNames: string[]
  perceptionQueryNames: string[]
}
```

它描述的是“这个 widget 天生支持什么”，不是“当前 workspace 如何联动它”。

---

### 5.3 Action Descriptor

```ts
interface ActionDescriptor {
  name: string
  targetRef?: WidgetRef | string | null

  primitive:
    | 'select'
    | 'filter'
    | 'highlight'
    | 'zoom'
    | 'encode'
    | 'sort'
    | 'navigate'
    | 'reset'
    | 'workspace'

  category?: string
  sideEffectScope: 'widget' | 'workspace'

  paramsSchema?: Record<string, unknown>

  effects: Array<{
    kind: string
    targetRefs?: string[]
  }>

  preconditions?: Array<{
    kind: string
    message?: string
  }>
}
```

关键点：

- action 是 abstraction 层声明，runtime 层执行
- `primitive` 应该稳定且小，不要把 branch/jump/undo 混成一类
- `sideEffectScope` 要明确区分 widget-local 和 workspace-global

---

### 5.4 Perception Descriptor

```ts
interface PerceptionDescriptor {
  name: string
  targetRef?: WidgetRef | DataRef | null
  category?: 'inspect' | 'summarize' | 'compute' | 'verify'

  evidenceKinds: string[]
  paramsSchema?: Record<string, unknown>
  returnsSchema?: Record<string, unknown>

  sideEffectFree: boolean
}
```

这里的重点是：

- perception 语义上应当是“逻辑只读”
- 即使 runtime 记录 trace，也不应把 perception 设计成业务写操作

---

### 5.5 Runtime Core 接口

```ts
interface WidgetRuntimeCore {
  store: RuntimeStore

  describeWidget(ref: WidgetRef): WidgetDescription | null
  describeWorkspace(): WorkspaceDescription

  readView(options?: ReadViewOptions): WorkspaceState

  executeAction(call: ActionCall): Promise<ActionResult>

  queryPerception(call: PerceptionQueryCall): Promise<PerceptionResult>

  queryData?(call: DataQueryCall): Promise<DataQueryResult>

  getInteractionTrace(options?: TraceReadOptions): InteractionTraceRecord[]
}
```

这里已经进入 runtime 语义：

- 有统一 store
- 有统一执行
- 有统一读取
- 有统一 trace

---

### 5.6 Workspace 接口

```ts
interface WorkspaceDescription {
  workspaceId: string
  widgets: WidgetDescription[]
  links: WidgetLink[]

  transportHints?: {
    recommendedTools: string[]
    optionalTools: string[]
  }

  runtimeTopology?: {
    topology: 'T1' | 'T2' | 'T3' | 'T4' | 'T5' | 'T6'
    topologyLabel?: string
  }
}

interface WorkspaceState {
  stateId: string
  widgets: Record<WidgetRef, WidgetState>

  shared: {
    focusedWidget?: WidgetRef | null
    activeSelections?: Record<SelectionRef, SelectionState>
    globalFilters?: unknown[]
    comparisonTargets?: string[]
    annotations?: unknown[]
  }
}
```

重点：

- widget 自己的状态在 `widgets[ref]`
- workspace-global state 在 `shared`
- 不要把两者混在一起

---

### 5.7 Transport / Page API 接口

```ts
interface WidgetVAPagePort {
  describePagePort(): PagePortDescription

  describeWorkspace(options?: DescribeWorkspaceOptions): Promise<WorkspaceDescription>

  readView(options?: ReadViewOptions): Promise<WorkspaceState>

  executeAction(call: ActionCall): Promise<ActionResult>

  queryPerception(call: PerceptionQueryCall): Promise<PerceptionResult>

  queryData?(call: DataQueryCall): Promise<DataQueryResult>

  readSnapshot?(options?: SnapshotReadOptions): Promise<WorkspaceSnapshot | null>
  listStateHistory?(options?: StateHistoryOptions): Promise<StateHistoryEntry[]>
  listBranches?(): Promise<BranchSummary[]>
}
```

它是 runtime 的对外调用面，不是 adapter 的对外调用面。

---

## 6. 单 widget 与多 widget 的关系

建议把两者关系定义为：

```text
single widget runtime = workspace runtime 的特例
```

也就是：

- 单 widget 不是另一套架构
- 单 widget 只是 `workspace.widgets.length === 1`

这样好处是：

- human path 和 dashboard path 不分叉
- agent 不需要区分单图 / 多图两套调用协议
- replay / trace / perception surface 保持一致

---

## 7. “runtime 在 agent 接入前是不是空的？”

答案：不是。

更准确的说法是：

```text
runtime 先为“统一交互与统一状态管理”而存在，
agent 只是后来接上的自动化操作者。
```

所以，在没有 agent 的时候，runtime 至少应该已经支持：

### 7.1 Human path

- human selection 进入统一 state pipeline
- human action 进入统一 action executor
- human interaction 被写入 trace

### 7.2 Programmatic path

- `describeWorkspace()`
- `readView()`
- `executeAction()`
- `queryPerception()`

### 7.3 Workspace path

- widget registration
- shared selection
- widget link propagation
- workspace state updates

如果这些都还不存在，那么接入 agent 时就会出现一个典型问题：

```text
不是 agent 接入 runtime
而是临时给 agent 造了一套旁路控制面
```

这通常会让 human 与 agent 变成两套系统，后期很难收敛。

---

## 8. 推荐的稳定依赖方向

建议强制保持下面这个依赖方向：

```text
Concrete Widget
  -> Widget Adapter
  -> Runtime Core
  -> Workspace Runtime
  -> Page API / Transport
  -> Agent Client
```

不要反过来：

```text
Agent logic
  -> runtime internals
  -> widget implementation details
```

否则会出现：

- agent 依赖某种 widget provider 的细节
- transport 暴露内部 store 结构
- runtime 很难替换或扩展

---

## 9. 当前文档体系的建议定位

基于这个分层，当前几份文档更适合这样定位：

- [widgetva_runtime_core_design.md](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva_runtime_core_design.md)
  - 主要是 `runtime core + workspace runtime + page API`
- [widgetva_runtime_core_design_clear_terms.md](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva_runtime_core_design_clear_terms.md)
  - 是上面那份的术语清洗与边界收紧版
- 本文档
  - 主要负责把 `abstraction / runtime / transport` 三层拆开

也就是说，本文档不是替代 runtime design，而是给 runtime design 加一层更清晰的上位边界。

---

## 10. 后续最值得先固定的 5 个接口

如果要先收口，建议优先冻结这 5 个接口：

1. `WidgetAdapter`
2. `WidgetDescription`
3. `ActionDescriptor`
4. `WorkspaceState`
5. `WidgetVAPagePort`

原因很简单：

- `WidgetAdapter` 决定可扩展性
- `WidgetDescription` 决定 discoverability
- `ActionDescriptor` 决定 agent 能做什么
- `WorkspaceState` 决定 replay / delta / evaluation
- `PagePort` 决定外部 transport 稳定性

这五个稳定下来，后面的 planner、benchmark、multi-transport 都会顺很多。

---

## 11. 最终总结

最核心的边界可以压缩成三句话：

```text
Widget abstraction 定义“widget 是什么、支持什么”。
Runtime core 定义“这些 widget 如何被统一执行、观测、记录、协调”。
Transport / agent surface 定义“外部如何调用 runtime”。
```

以及一个重要判断：

```text
runtime 不是为 agent 才存在；
agent 是 runtime 的一个调用者。
```

这条边界一旦固定，后面设计多 widget、workspace、trace、evaluation、transport 时就不会反复打架。
