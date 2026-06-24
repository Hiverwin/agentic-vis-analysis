# WidgetVA Runtime：面向 Agentic Visual Analytics 的前端 Widget 技术实现设计

> 目标：把现有的 `W = <S, A, P>` widget-centric abstraction 从 benchmark 内部工具，升级为一个可复用、纯前端优先、支持 multi-widget coordinated VA 的运行时框架。  
> 说明：本文档只讨论核心功能和技术实现，不讨论论文写作、实验叙事和投稿包装。

---

## 0. 命名与定位

为了避免和 VACP 在命名和结构上过度相似，这里先给这套实现暂定一个内部名：**WidgetVA Runtime**。

它不是 visualization grammar，也不是 benchmark 本身，而是一套 **agent-facing front-end runtime contract**。

它的核心定位是：

```text
已有 VA 前端 / 新构建的 VA widgets
  ↓
Widget Adapter 层
  ↓
WidgetVA Runtime Core
  ↓
window.__widgetVA Page API
  ↓
可选 Transport：MCP / Playwright / browser extension / in-page agent
  ↓
LLM/VLM Agent
```

和 VACP 相比，这套设计需要保留“agent 不直接操作 pixel / DOM，而是操作结构化语义接口”的思想，但不要照搬它的术语和结构。本文档中使用下面这些命名：

| 设计对象 | 本文档命名 | 避免直接使用的类似命名 |
|---|---|---|
| 稳定语义 ID | Widget Ref / Ref | stable widget reference |
| 页面可见能力描述 | Workspace Description | capability graph |
| 当前状态快照 | View State | state snapshot |
| 可执行动作集合 | Action List | action catalog |
| 动作执行器 | Action Executor | execution gateway |
| 数据查询入口 | Data Query Handle | DataHandle |
| 感知/证据查询 | Perception Query | perception query / inspect_data |
| 多组件关系图 | Widget Link Map | relation graph / capability graph |
| 网页内部接口 | Page API | runtime bridge |
| 图表适配器 | Widget Adapter | provider |
| 历史记录 | Interaction Trace | interaction trace graph |

---

## 1. 设计目标

WidgetVA Runtime 的核心目标有五个。

### 1.0 理论定位：不是 graph-first，而是 coordinated state system

为了让这套设计更贴近 VA / TVCG 语境，WidgetVA Runtime 不建议被表述为一个单纯的 graph-based system。

更合适的理论定位是三层组合：

```text
1. Coordinated Multiple Views (CMV)
2. State Transition System
3. Capability-Oriented Interface
```

分别对应：

```text
CMV 回答：多个视图如何围绕同一分析任务协同工作
State Transition 回答：action 如何改变 widget / workspace state
Capability Interface 回答：agent 能发现什么、能做什么、如何验证结果
```

其中 graph 仍然有价值，但更适合作为局部表示工具：

```text
Widget Link Map
Interaction Trace / Provenance
```

而不是整个系统的唯一理论基础。

### G1. Front-end first

Widget abstraction 必须搬到前端。因为 agent 真正需要操作的是当前浏览器中的 live VA state，而不是后端里某个抽象状态副本。

前端 runtime 要维护：

```text
widgets
widget states
actions
perception queries
widget links
interaction trace
state delta
```

后端可以继续负责：

```text
LLM 调用
任务管理
benchmark 运行
日志持久化
大数据查询
```

但 widget contract 本身应该优先存在于前端。

### G2. Widget-centric, not grammar-centric

Vega/Vega-Lite 描述“图怎么画”。WidgetVA 描述“agent 怎么读、怎么操作、怎么验证一个可交互 VA widget”。

所以 WidgetVA 不只存 `vega_spec`，还要暴露：

```text
当前 view state
可执行 actions
每个 action 的参数 schema
每个 action 的 effects
可查询 evidence
多 widget 联动关系
human / agent 统一 interaction trace
```

### G3. Data-space action, not pixel action

Agent 不应该拖拽屏幕坐标，而应该调用数据空间里的 intent-level actions，例如：

```text
brush_interval(field='MPG', range=[20, 40])
filter_category(field='Origin', values=['Japan'])
zoom_domain(x=[60, 120], y=[20, 40])
change_encoding(channel='y', field='ST_Depression')
```

### G4. Multi-widget is first-class

现有版本主要是一 widget 一任务。新的实现要支持 dashboard-level widget link：

```text
scatter brush filters bar chart
map click highlights table rows
timeline brush filters all views
parallel coordinates selection updates summary panel
```

multi-widget 不是后续插件，而是 runtime 的核心功能。

这里需要强调：

```text
multi-widget 不等于两个 widget
multi-widget 也不应靠枚举固定数量的 view
```

更合理的设计单位是：

```text
workspace = { widgets, links, shared state, task context }
```

也就是说，系统应支持任意数量的 widget，但通过 workspace topology 控制复杂度，而不是预先限定 “2-view / 3-view / 4-view”。

### G4.1 后续需要补上的 Workspace Planner

为了避免“上传一个数据集后系统随意决定生成几个 view”，后续应补一层显式的 Workspace Planner。

它的输入应包括：

```text
dataset schema
task / user intent
run mode
complexity budget
preferred topology (optional)
```

它的输出应包括：

```ts
{
  topology: "T1" | "T2" | "T3" | "T4" | "T5" | "T6";
  widgets: WidgetPlan[];
  links: WidgetLink[];
  rationale: string[];
}
```

设计原则：

```text
先决定 workspace topology，再决定 widget 数量
widget 数量由 topology 和 complexity budget 决定，而不是只由 chart taxonomy 决定
MVP 先支持 T1 / T2 / T3，后续再扩 T4+
```

当前阶段不急着实现完整 Planner，但必须把它作为后续主线能力保留在架构中。

### G5. Evaluation-ready by design

因为你的工作同时有 benchmark 贡献，所以 runtime 必须天然支持 evaluation hooks：

```text
action trace
state delta
final state constraints
evidence logs
alternative valid traces
human vs agent action interaction trace
```

---

## 2. 总体架构

```text
┌──────────────────────────────────────────────────────────────┐
│                        Agent Layer                            │
│  LLM / VLM / Agent scaffold / benchmark runner                │
└───────────────────────────────▲──────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────┐
│                    Optional Transport Layer                    │
│  MCP server / Playwright / Browser extension / WebSocket       │
└───────────────────────────────▲──────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────┐
│                         Page API                             │
│  window.__widgetVA.describeWorkspace()                      │
│  window.__widgetVA.readView()                               │
│  window.__widgetVA.executeAction()                           │
│  window.__widgetVA.queryPerception()                              │
└───────────────────────────────▲──────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────┐
│                   WidgetVA Runtime Core                     │
│  WidgetRegistry                                               │
│  ActionExecutor                                              │
│  PerceptionQueryRegistry                                            │
│  LinkEngine                                            │
│  InteractionTraceRecorder                                             │
│  StateManager                                              │
└───────────────────────────────▲──────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────┐
│                      Widget Adapter Layer                     │
│  VegaLiteAdapter / EChartsAdapter / D3Adapter / CustomAdapter │
└───────────────────────────────▲──────────────────────────────┘
                                │
┌───────────────────────────────┴──────────────────────────────┐
│                      Existing VA Front-end                     │
│  Vue / React / D3 / Vega-Lite / ECharts / Canvas / SVG         │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. 核心对象概览

WidgetVA Runtime 由 8 个核心对象组成。

```text
1. Widget Ref
2. Widget Description
3. View State
4. Action List
5. Perception Query List
6. Data Query Handle
7. Widget Link Map
8. Interaction Trace
```

它们共同回答 agent 的四个问题：

```text
页面里有什么？
当前状态是什么？
我可以做什么？
做完以后发生了什么？
```

---

## 4. Widget Ref

### 4.1 目的

Widget Ref 是给 widget、selection、data query handle、action target、widget link 的稳定语义地址。

它不是 DOM id，不是 CSS selector，也不是 canvas 坐标。

### 4.2 格式

建议使用自己的 scheme，例如：

```text
wl://{appId}/workspace/{workspaceId}/widget/{widgetId}
wl://{appId}/workspace/{workspaceId}/widget/{widgetId}/selection/{selectionId}
wl://{appId}/workspace/{workspaceId}/data/{dataId}
wl://{appId}/workspace/{workspaceId}/link/{linkId}
```

示例：

```text
wl://heart-risk/workspace/main/widget/risk_scatter
wl://heart-risk/workspace/main/widget/risk_scatter/selection/risk_region
wl://heart-risk/workspace/main/widget/summary_bar
wl://heart-risk/workspace/main/data/current_selection
wl://heart-risk/workspace/main/link/scatter_brush_filters_bar
```

### 4.3 TypeScript 类型

```ts
export type Ref = `wl://${string}`;

export interface RefParts {
  appId: string;
  workspaceId: string;
  kind: "widget" | "selection" | "data" | "link" | "action";
  localId: string;
}

export function makeRef(parts: {
  appId: string;
  workspaceId: string;
  path: string;
}): Ref {
  const normalized = parts.path.replace(/^\/+/, "");
  return `wl://${parts.appId}/workspace/${parts.workspaceId}/${normalized}` as Ref;
}
```

---

## 5. Widget Description

### 5.1 目的

Widget Description 描述一个 widget 是什么、展示什么、支持哪些交互、和哪些数据/其他 widget 相关。

它是 agent 的“说明书”。

### 5.2 Description 内容

```ts
export type WidgetKind =
  | "bar"
  | "line"
  | "scatter"
  | "heatmap"
  | "parallelCoordinates"
  | "sankey"
  | "map"
  | "table"
  | "custom";

export interface WidgetDescription {
  ref: Ref;
  kind: WidgetKind;

  title: string;
  description?: string;

  // 说明这个 widget 适合哪些分析任务
  analyticRoles?: Array<
    | "lookup"
    | "compare"
    | "rank"
    | "correlate"
    | "cluster"
    | "outlier"
    | "trend"
    | "distribution"
    | "flow"
    | "geoPattern"
  >;

  // 当前 widget 使用的数据入口
  primaryDataRef?: Ref;

  // 该 widget 暴露的操作和查询
  actionNames: string[];
  perceptionQueryNames: string[];

  // 给 agent 的短提示，不是长 prompt
  usageNotes?: string[];
}
```

### 5.3 示例

```ts
const scatterDescription: WidgetDescription = {
  ref: "wl://heart-risk/workspace/main/widget/risk_scatter",
  kind: "scatter",
  title: "Risk Scatterplot",
  description: "Shows latency vs. error rate; bubble size encodes traffic volume.",
  analyticRoles: ["correlate", "cluster", "outlier"],
  primaryDataRef: "wl://heart-risk/workspace/main/data/risk_records",
  actionNames: [
    "scatter.brushRegion",
    "scatter.zoomDomain",
    "widget.changeEncoding",
    "widget.clearSelection"
  ],
  perceptionQueryNames: [
    "perception.inspectVisibleRows",
    "perception.summarizeSelection",
    "perception.computeCorrelation",
    "perception.findOutliers"
  ],
  usageNotes: [
    "Use brushRegion for selecting data-space rectangles.",
    "Use summarizeSelection after brushing to verify selected groups."
  ]
};
```

---

## 6. View State

### 6.1 目的

View State 是当前 widget / workspace 的运行时状态。

它不是完整数据集，也不是 Vega spec 的简单复制，而是 agent 决策所需的 compact state。

### 6.2 Widget State

```ts
export interface WidgetState {
  ref: Ref;
  kind: WidgetKind;
  version: number;
  updatedAt: string;

  data: {
    sourceDataRef: Ref;
    currentDataRef?: Ref;
    rowCount?: number;
    visibleCount?: number;
    selectedCount?: number;
  };

  encodings: Record<
    "x" | "y" | "color" | "size" | "shape" | "row" | "column" | string,
    FieldEncoding | undefined
  >;

  transforms: TransformState[];
  view: ViewTransformState;
  selections: Record<Ref, SelectionState>;
  feedback?: InteractionFeedbackState;
}

export interface FieldEncoding {
  field: string;
  type: "quantitative" | "nominal" | "ordinal" | "temporal" | "geo";
  aggregate?: "count" | "sum" | "mean" | "median" | "min" | "max";
  bin?: boolean;
  scale?: unknown;
}

export interface TransformState {
  kind: "filter" | "sort" | "aggregate" | "derive" | "sample";
  source?: Ref;
  spec: unknown;
}

export interface ViewTransformState {
  xDomain?: [number, number] | [string, string];
  yDomain?: [number, number] | [string, string];
  zoom?: {
    level?: number;
    center?: [number, number];
  };
  sort?: {
    field: string;
    order: "ascending" | "descending";
  };
}

export type SelectionState =
  | {
      kind: "interval";
      fields: string[];
      value: Record<string, [number, number] | [string, string]>;
    }
  | {
      kind: "point";
      keyField: string;
      keys: Array<string | number>;
    }
  | {
      kind: "category";
      field: string;
      values: string[];
    };

export interface InteractionFeedbackState {
  hoveredItem?: unknown;
  highlightedKeys?: Array<string | number>;
  tooltip?: Record<string, unknown>;
}
```

### 6.3 Workspace State

```ts
export interface WorkspaceState {
  stateId: string;
  createdAt: string;

  widgets: Record<Ref, WidgetState>;

  shared: {
    activeSelections: Record<Ref, SelectionState>;
    globalFilters: Record<string, unknown>;
    focusedWidget?: Ref;
  };

  taskContext?: {
    taskId?: string;
    userQuery?: string;
    taskMode?: "goal_oriented" | "open_ended" | "benchmark";
    coordinationScope?: "single_widget" | "multi_widget" | "workspace";
    expectedAnswerType?: "exact" | "bounded" | "exploratory";
    targetWidgetRefs?: Ref[];
  };

  // 可选：只返回相对上一轮变化的内容
  delta?: {
    baseStateId: string;
    changedRefs: Ref[];
    removedRefs: Ref[];
  };
}
```

---

## 7. Action List

### 7.1 目的

Action List 告诉 agent 当前能执行哪些 intent-level actions。

每个 action 需要有：

```text
名字
说明
目标 ref
参数 schema
前置条件
effects
示例
```

### 7.1.1 Primitive → Binding 两级组织

为了避免 action catalog 在 multi-widget 场景下爆炸，同时保证 portability，建议把动作组织为两层：

```text
Layer 1: Action Primitive
  filter / sort / aggregate / reencode / zoom / select / highlight / navigate / compare / annotate / reset / undo

Layer 2: Widget Binding
  scatter.brushRegion
  scatter.zoomDomain
  bar.sortBars
  heatmap.filterCells
  table.focusRows
```

设计原则：

```text
primitive 负责跨 widget 的稳定语义
binding 负责具体 widget 的参数形式和执行细节
agent 优先理解 primitive，再调用当前 workspace 中可用的 binding
benchmark 和 evaluator 也优先记录 primitive 级别的行为，用 binding 级别补充执行细节
```

### 7.2 类型定义

```ts
export type ActionPrimitive =
  | "filter"
  | "sort"
  | "aggregate"
  | "reencode"
  | "zoom"
  | "select"
  | "highlight"
  | "navigate"
  | "compare"
  | "annotate"
  | "reset"
  | "undo";

export type ActionCategory =
  | "dataTransform"
  | "visualMapping"
  | "viewTransform"
  | "selection"
  | "annotation"
  | "navigation"
  | "coordination";

export interface ActionDescriptor {
  name: string;
  title: string;
  description: string;
  primitive: ActionPrimitive;
  category: ActionCategory;

  scope?: "local" | "workspace";
  targetRef?: Ref;
  affectedRefs?: Ref[];
  affectedStatePaths?: string[];

  paramsSchema: Record<string, unknown>;

  preconditions?: Array<{
    description: string;
    failureMessage: string;
  }>;

  postconditions?: Array<{
    description: string;
    checkHint?: string;
  }>;

  effects?: ActionEffect[];
  reversible?: boolean;

  examples?: Array<{
    userGoal: string;
    params: unknown;
  }>;
}

export type ActionEffect =
  | {
      kind: "updatesSelection";
      ref: Ref;
      description: string;
    }
  | {
      kind: "filtersWidget";
      ref: Ref;
      description: string;
    }
  | {
      kind: "updatesViewDomain";
      ref: Ref;
      description: string;
    }
  | {
      kind: "changesEncoding";
      ref: Ref;
      description: string;
    }
  | {
      kind: "highlightsItems";
      ref: Ref;
      description: string;
    };
```

### 7.3 Action Call / Result

```ts
export interface ActionCall {
  callId: string;
  name: string;
  params: unknown;
  actor?: "agent" | "human" | "system";
  reason?: string;
}

export type ActionResult =
  | {
      ok: true;
      callId: string;
      actionName: string;
      updatedRefs: Ref[];
      stateId: string;
      statePatch: Record<Ref, unknown>;
      result?: unknown;
      verificationHints?: string[];
    }
  | {
      ok: false;
      callId: string;
      actionName: string;
      error: {
        code:
          | "UNKNOWN_OPERATION"
          | "INVALID_PARAMS"
          | "PRECONDITION_FAILED"
          | "RUNTIME_ERROR";
        message: string;
        details?: unknown;
      };
      recoveryHints?: string[];
    };
```

### 7.4 示例：brush action

```ts
const brushRegionDescriptor: ActionDescriptor = {
  name: "scatter.brushRegion",
  title: "Brush scatterplot region",
  description:
    "Select data points inside a data-space rectangle on a scatterplot. Linked widgets may be filtered or highlighted according to workspace widget links.",
  primitive: "select",
  category: "selection",
  scope: "workspace",
  targetRef: "wl://heart-risk/workspace/main/widget/risk_scatter/selection/risk_region",
  affectedRefs: [
    "wl://heart-risk/workspace/main/widget/risk_scatter",
    "wl://heart-risk/workspace/main/widget/summary_bar"
  ],
  affectedStatePaths: [
    "widgets[risk_scatter].selections[risk_region]",
    "widgets[summary_bar].transforms"
  ],
  paramsSchema: {
    type: "object",
    properties: {
      selectionRef: { type: "string" },
      xField: { type: "string" },
      yField: { type: "string" },
      xRange: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 },
      yRange: { type: "array", items: { type: "number" }, minItems: 2, maxItems: 2 }
    },
    required: ["selectionRef", "xField", "yField", "xRange", "yRange"]
  },
  postconditions: [
    {
      description: "The interval selection should exist on the scatterplot.",
      checkHint: "Inspect the selection state on risk_scatter."
    },
    {
      description: "The linked summary bar should be filtered to the brushed records.",
      checkHint: "Check whether summary_bar received a filter transform from the link."
    }
  ],
  reversible: true,
  effects: [
    {
      kind: "updatesSelection",
      ref: "wl://heart-risk/workspace/main/widget/risk_scatter/selection/risk_region",
      description: "Updates the scatterplot interval selection."
    },
    {
      kind: "filtersWidget",
      ref: "wl://heart-risk/workspace/main/widget/summary_bar",
      description: "Filters the linked summary bar chart to selected records."
    }
  ]
};
```

---

## 8. Perception Query List

### 8.1 目的

Perception Query 是 side-effect-free 的证据查询。它不改变 widget state，只返回当前视图或当前数据切片的结构化证据。

它对应你论文里的 Perception P，但这里进一步工程化为统一的 query registry。

### 8.2 Query 类型

```ts
export type PerceptionQueryCategory =
  | "inspect"
  | "summarize"
  | "compute"
  | "verify";

export interface PerceptionQueryDescriptor {
  name: string;
  title: string;
  description: string;
  category: PerceptionQueryCategory;
  targetRef?: Ref;
  paramsSchema: Record<string, unknown>;
  returnsSchema?: Record<string, unknown>;
  sideEffectFree: true;
}

export interface PerceptionQueryCall {
  callId: string;
  name: string;
  params: unknown;
}

export type PerceptionQueryResult =
  | {
      ok: true;
      callId: string;
      queryName: string;
      result: unknown;
    }
  | {
      ok: false;
      callId: string;
      queryName: string;
      error: {
        code: "UNKNOWN_QUERY" | "INVALID_PARAMS" | "RUNTIME_ERROR";
        message: string;
        details?: unknown;
      };
    };
```

### 8.3 推荐 Query 设计

```text
inspectViewConfig       查看当前 encodings/transforms/domains/selections
inspectVisibleRows      返回当前可见数据行，小样本或 limit 后结果
summarizeVisible        返回当前 view 的聚合摘要
summarizeSelection      返回当前 selection 的数量、分布、聚合
computeCorrelation      计算字段之间相关性
findExtremes            查最大/最小/top-k
findOutliers            查异常点
compareGroups           比较两个 group 的统计差异
verifyActionEffect   验证上一轮 action 是否达到预期状态
```

### 8.4 示例：summarizeSelection

```ts
const summarizeSelectionDescriptor: PerceptionQueryDescriptor = {
  name: "perception.summarizeSelection",
  title: "Summarize selected records",
  description:
    "Return aggregate summaries for the data records selected by a widget selection.",
  category: "summarize",
  targetRef: "wl://heart-risk/workspace/main/data/current_selection",
  sideEffectFree: true,
  paramsSchema: {
    type: "object",
    properties: {
      selectionRef: { type: "string" },
      groupBy: { type: "array", items: { type: "string" } },
      measures: {
        type: "array",
        items: {
          type: "object",
          properties: {
            field: { type: "string" },
            op: { enum: ["count", "mean", "sum", "min", "max", "median"] },
            as: { type: "string" }
          }
        }
      }
    },
    required: ["selectionRef"]
  }
};
```

---

## 9. Data Query Handle

### 9.1 目的

Data Query Handle 是数据访问入口。它不等于完整数据，而是一个可查询的数据视图。

它解决两个问题：

```text
1. 不把全量数据塞进 agent context。
2. 让 agent 在需要证据时精确查询当前 view / selection / linked filters 后的数据。
```

### 9.2 类型定义

```ts
export interface DataQueryHandle {
  ref: Ref;
  title: string;
  description?: string;

  sourceKind: "inline" | "csv" | "arrow" | "duckdb" | "remote" | "custom";

  schema: {
    fields: Array<{
      name: string;
      type: "quantitative" | "nominal" | "ordinal" | "temporal" | "geo" | "boolean";
      nullable?: boolean;
      description?: string;
    }>;
  };

  stats?: {
    rowCount?: number;
    visibleCount?: number;
    selectedCount?: number;
  };

  supportedQueries: Array<
    | "schema"
    | "sampleRows"
    | "filter"
    | "aggregate"
    | "groupBy"
    | "sql"
    | "summary"
  >;
}
```

### 9.3 前端实现选项

按复杂度递增：

```text
MVP：JS array + filter/map/reduce
中等：Arquero
复杂：DuckDB-WASM
超大数据：remote query endpoint + front-end data query handle description
```

建议先做 MVP + 可替换接口。

```ts
export interface DataQueryEngine {
  getSchema(dataRef: Ref): Promise<DataQueryHandle["schema"]>;

  query(dataRef: Ref, query: {
    kind: "sampleRows" | "aggregate" | "summary" | "sql";
    spec: unknown;
  }): Promise<unknown>;
}
```

---

## 10. Widget Link Map

### 10.1 目的

Widget Link Map 描述多个 widget 之间如何联动。

它是 multi-widget 的核心。

### 10.1.1 不是固定 view 数量，而是 topology

runtime 不需要预先规定系统最多只能有几个 view。真正需要约束的是 workspace 的 topology。

推荐先支持下面几类 topology：

```text
T1. Single View
T2. Coordinated Pair
T3. Overview + Detail
T4. Triple Dashboard
T5. Drill-down Chain
T6. Global Control + Multiple Targets
```

解释：

```text
T1 Single View
  一个 widget 独立完成分析

T2 Coordinated Pair
  例如 scatter ↔ bar，selection/filter 在两者之间传播

T3 Overview + Detail
  overview 控制 detail 的 domain / filter / subset

T4 Triple Dashboard
  例如 scatter + bar + table，共享同一 selection context

T5 Drill-down Chain
  一个 widget 的输出逐步收缩另一个 widget 的分析范围

T6 Global Control + Multiple Targets
  一个 timeline / filter panel / map selection 同时影响多个 views
```

这意味着：

```text
multi-widget 支持多少个 view，不由 chart taxonomy 决定
而由 workspace topology、link density、和 shared-state complexity 决定
```

工程上建议：

```text
MVP: T1 + T2
Next: T3 + T4
Later: T5 + T6
```

### 10.2 类型定义

```ts
export type WidgetLinkKind =
  | "contains"
  | "usesData"
  | "filters"
  | "highlights"
  | "syncsDomain"
  | "sharesSelection"
  | "comparesWith"
  | "derivesFrom";

export interface WidgetLink {
  ref: Ref;
  kind: WidgetLinkKind;
  from: Ref;
  to: Ref;
  description?: string;

  trigger?:
    | "selectionChanged"
    | "filterChanged"
    | "domainChanged"
    | "encodingChanged"
    | "hoverChanged";

  effect?:
    | "applyFilter"
    | "applyHighlight"
    | "syncDomain"
    | "updateData"
    | "compare";

  automatic?: boolean;
}
```

### 10.3 示例：scatter brush filters bar

```ts
const scatterBrushFiltersBar: WidgetLink = {
  ref: "wl://heart-risk/workspace/main/link/scatter_brush_filters_bar",
  kind: "filters",
  from: "wl://heart-risk/workspace/main/widget/risk_scatter/selection/risk_region",
  to: "wl://heart-risk/workspace/main/widget/summary_bar",
  description:
    "The scatterplot brush filters the summary bar chart to records inside the selected risk region.",
  trigger: "selectionChanged",
  effect: "applyFilter",
  automatic: true
};
```

### 10.4 Propagation Engine

当某个 action 改变了 selection/filter/domain 时，LinkEngine 会查找相关 links 并传播状态变化。

```ts
export class LinkEngine {
  constructor(private store: RuntimeStore) {}

  propagate(changedRef: Ref): Ref[] {
    const affected: Ref[] = [];

    for (const link of Object.values(this.store.links)) {
      if (link.from !== changedRef) continue;
      if (!link.automatic) continue;

      if (link.effect === "applyFilter") {
        this.applyFilterLink(link);
        affected.push(link.to);
      }

      if (link.effect === "applyHighlight") {
        this.applyHighlightLink(link);
        affected.push(link.to);
      }

      if (link.effect === "syncDomain") {
        this.applyDomainSync(link);
        affected.push(link.to);
      }
    }

    return affected;
  }

  private applyFilterLink(link: WidgetLink) {
    const target = this.store.widgets[link.to];
    if (!target) return;

    target.transforms.push({
      kind: "filter",
      source: link.from,
      spec: { linkRef: link.ref }
    });

    target.version += 1;
  }

  private applyHighlightLink(link: WidgetLink) {
    const target = this.store.widgets[link.to];
    if (!target) return;

    target.feedback = {
      ...target.feedback,
      highlightedKeys: []
    };

    target.version += 1;
  }

  private applyDomainSync(link: WidgetLink) {
    const source = this.store.widgets[link.from];
    const target = this.store.widgets[link.to];
    if (!source || !target) return;

    target.view.xDomain = source.view.xDomain;
    target.view.yDomain = source.view.yDomain;
    target.version += 1;
  }
}
```

---

## 11. Runtime Store

### 11.1 目的

Runtime Store 是前端全局状态管理器。可以用 Vuex、Pinia、Zustand，也可以先用纯 TS store。

推荐当前版本使用：

```text
Vue 3 + Pinia 或 Vuex
TypeScript
Zod / Ajv 做 schema validation
```

### 11.2 Store 类型

```ts
export interface RuntimeStore {
  appId: string;
  workspaceId: string;

  descriptions: Record<Ref, WidgetDescription>;
  widgets: Record<Ref, WidgetState>;
  dataHandles: Record<Ref, DataQueryHandle>;
  links: Record<Ref, WidgetLink>;

  actions: Record<string, ActionDescriptor>;
  perceptionQueries: Record<string, PerceptionQueryDescriptor>;

  interactionTrace: InteractionTraceRecord[];

  stateId: string;
  version: number;
}
```

### 11.3 Pinia 示例

```ts
import { defineStore } from "pinia";

export const useWidgetVAStore = defineStore("widgetVA", {
  state: (): RuntimeStore => ({
    appId: "demo",
    workspaceId: "main",
    descriptions: {},
    widgets: {},
    dataHandles: {},
    links: {},
    actions: {},
    perceptionQueries: {},
    interactionTrace: [],
    stateId: crypto.randomUUID(),
    version: 0
  }),

  actions: {
    registerWidget(description: WidgetDescription, state: WidgetState) {
      this.descriptions[description.ref] = description;
      this.widgets[state.ref] = state;
      this.version += 1;
      this.stateId = crypto.randomUUID();
    },

    registerLink(link: WidgetLink) {
      this.links[link.ref] = link;
      this.version += 1;
    },

    patchWidget(ref: Ref, patch: Partial<WidgetState>) {
      const old = this.widgets[ref];
      if (!old) throw new Error(`Unknown widget: ${ref}`);

      this.widgets[ref] = {
        ...old,
        ...patch,
        version: old.version + 1,
        updatedAt: new Date().toISOString()
      };

      this.version += 1;
      this.stateId = crypto.randomUUID();
    }
  }
});
```

---

## 12. Action Executor

### 12.1 目的

Action Executor 负责把 action name 路由到真实前端函数。

它做四件事：

```text
1. 找 action handler
2. 校验参数
3. 执行 handler
4. 触发 LinkEngine + InteractionTraceRecorder + StateManager
```

### 12.2 类型和实现

```ts
export type ActionHandler = (
  params: unknown,
  ctx: ActionContext
) => Promise<{
  updatedRefs: Ref[];
  result?: unknown;
}>;

export interface ActionContext {
  store: RuntimeStore;
  patchWidget(ref: Ref, patch: Partial<WidgetState>): void;
  propagate(changedRef: Ref): Ref[];
  readStatePatch(refs: Ref[]): Record<Ref, unknown>;
}

export class ActionExecutor {
  private descriptors = new Map<string, ActionDescriptor>();
  private handlers = new Map<string, ActionHandler>();

  register(descriptor: ActionDescriptor, handler: ActionHandler) {
    if (this.handlers.has(descriptor.name)) {
      throw new Error(`Duplicate action: ${descriptor.name}`);
    }

    this.descriptors.set(descriptor.name, descriptor);
    this.handlers.set(descriptor.name, handler);
  }

  list(): ActionDescriptor[] {
    return Array.from(this.descriptors.values());
  }

  async run(call: ActionCall, ctx: ActionContext): Promise<ActionResult> {
    const descriptor = this.descriptors.get(call.name);
    const handler = this.handlers.get(call.name);

    if (!descriptor || !handler) {
      return {
        ok: false,
        callId: call.callId,
        actionName: call.name,
        error: {
          code: "UNKNOWN_OPERATION",
          message: `Unknown action: ${call.name}`
        },
        recoveryHints: ["Call describeWorkspace() to inspect available actions."]
      };
    }

    try {
      // TODO: 用 Ajv 或 Zod 校验 descriptor.paramsSchema
      // validateParams(descriptor.paramsSchema, call.params)

      const output = await handler(call.params, ctx);

      const statePatch = ctx.readStatePatch(output.updatedRefs);

      return {
        ok: true,
        callId: call.callId,
        actionName: call.name,
        updatedRefs: output.updatedRefs,
        stateId: ctx.store.stateId,
        statePatch,
        result: output.result,
        verificationHints: [
          "Call readView({ refs: updatedRefs }) to verify the state update.",
          "Call perception query if the task requires numerical or aggregate evidence."
        ]
      };
    } catch (err) {
      return {
        ok: false,
        callId: call.callId,
        actionName: call.name,
        error: {
          code: "RUNTIME_ERROR",
          message: err instanceof Error ? err.message : String(err)
        }
      };
    }
  }
}
```

---

## 13. Widget Adapter

### 13.1 目的

Widget Adapter 把具体图表库或自定义图表接入 WidgetVA Runtime。

它不是“框架核心”，而是“翻译层”。

它需要提供：

```text
description
initial state
actions
perception queries
render update hooks
human interaction hooks
```

### 13.2 Adapter 接口

```ts
export interface WidgetAdapter {
  widgetRef: Ref;

  getDescription(): WidgetDescription;
  getState(): WidgetState;

  registerActions(router: ActionExecutor): void;
  registerPerceptionQueries(registry: PerceptionQueryRegistry): void;

  // 人类直接操作图表时，把事件转成同一套 action 或 state patch
  bindHumanInteractions?(): void;

  // runtime state 改变后，调用底层图表库更新渲染
  applyState?(state: WidgetState): void;
}
```

### 13.3 Scatterplot Adapter 示例

```ts
export class ScatterWidgetAdapter implements WidgetAdapter {
  constructor(
    public widgetRef: Ref,
    private chart: {
      getState(): WidgetState;
      setBrush(selection: SelectionState): void;
      setDomain(x: [number, number], y: [number, number]): void;
      changeEncoding(channel: string, field: string): void;
      onBrush?: (handler: (selection: SelectionState) => void) => void;
    },
    private dataRef: Ref
  ) {}

  getDescription(): WidgetDescription {
    return {
      ref: this.widgetRef,
      kind: "scatter",
      title: "Scatterplot Widget",
      description: "A scatterplot that supports brushing, zooming, and encoding changes.",
      analyticRoles: ["correlate", "cluster", "outlier"],
      primaryDataRef: this.dataRef,
      actionNames: [
        "scatter.brushRegion",
        "scatter.zoomDomain",
        "widget.changeEncoding",
        "widget.clearSelection"
      ],
      perceptionQueryNames: [
        "perception.inspectVisibleRows",
        "perception.summarizeSelection",
        "perception.computeCorrelation"
      ]
    };
  }

  getState(): WidgetState {
    return this.chart.getState();
  }

  registerActions(router: ActionExecutor): void {
    router.register(
      {
        name: "scatter.brushRegion",
        title: "Brush scatterplot region",
        description: "Select points inside a data-space rectangle.",
        category: "selection",
        targetRef: `${this.widgetRef}/selection/brush` as Ref,
        paramsSchema: {
          type: "object",
          properties: {
            xField: { type: "string" },
            yField: { type: "string" },
            xRange: { type: "array", items: { type: "number" } },
            yRange: { type: "array", items: { type: "number" } }
          },
          required: ["xField", "yField", "xRange", "yRange"]
        }
      },
      async (params, ctx) => {
        const p = params as {
          xField: string;
          yField: string;
          xRange: [number, number];
          yRange: [number, number];
        };

        const selectionRef = `${this.widgetRef}/selection/brush` as Ref;

        const selection: SelectionState = {
          kind: "interval",
          fields: [p.xField, p.yField],
          value: {
            [p.xField]: p.xRange,
            [p.yField]: p.yRange
          }
        };

        // 1. 调底层图表库
        this.chart.setBrush(selection);

        // 2. 更新 runtime state
        const current = ctx.store.widgets[this.widgetRef];
        ctx.patchWidget(this.widgetRef, {
          selections: {
            ...current.selections,
            [selectionRef]: selection
          }
        });

        // 3. 根据 widget links 自动传播
        const propagated = ctx.propagate(selectionRef);

        return {
          updatedRefs: [this.widgetRef, selectionRef, ...propagated],
          result: {
            selectionRef,
            message: "Scatterplot brush applied."
          }
        };
      }
    );
  }

  registerPerceptionQueries(registry: PerceptionQueryRegistry): void {
    // 这里注册 inspect/summarize/compute 查询
  }

  bindHumanInteractions(): void {
    if (!this.chart.onBrush) return;

    this.chart.onBrush((selection) => {
      // 人类手动 brush 时，也应该转成同一套 action 或 state patch，
      // 这样 human 和 agent 的 interaction trace 可以统一记录。
      // MVP 可以直接 patch state；正式版建议调用 ActionExecutor。
    });
  }
}
```

---

## 14. Page API

### 14.1 目的

Page API 是网页内部暴露给 agent executor 的对象。

不要叫 `window.__vacp`，建议使用：

```ts
window.__widgetVA
```

### 14.2 API 设计

```ts
export interface WidgetVAPagePort {
  describeWorkspace(options?: {
    includeSchemas?: boolean;
    includeExamples?: boolean;
  }): Promise<WorkspaceDescription>;

  readView(options?: {
    refs?: Ref[];
    deltaSince?: string;
  }): Promise<WorkspaceState>;

  executeAction(call: ActionCall): Promise<ActionResult>;

  queryPerception(call: PerceptionQueryCall): Promise<PerceptionQueryResult>;

  getInteractionTrace(options?: {
    limit?: number;
    sinceStateId?: string;
  }): Promise<InteractionTraceRecord[]>;
}
```

### 14.3 Workspace Description

```ts
export interface WorkspaceDescription {
  appId: string;
  workspaceId: string;
  generatedAt: string;

  workspaceCapabilities?: Array<
    | "singleWidgetAnalysis"
    | "multiWidgetCoordination"
    | "sharedSelection"
    | "crossFilter"
    | "domainSync"
    | "traceReplay"
    | "benchmarkExecution"
  >;

  widgets: WidgetDescription[];
  dataHandles: DataQueryHandle[];
  links: WidgetLink[];

  actions: ActionDescriptor[];
  perceptionQueries: PerceptionQueryDescriptor[];

  benchmarkSupport?: {
    taskSchemaVersion: string;
    evaluationHooks: Array<
      | "stateDelta"
      | "traceRead"
      | "verificationHints"
      | "constraintCheck"
      | "workspaceSnapshot"
    >;
  };
}
```

### 14.4 安装 Page API

```ts
export function installWidgetVAPagePort(args: {
  store: RuntimeStore;
  actionExecutor: ActionExecutor;
  perceptionQueryRegistry: PerceptionQueryRegistry;
  actionContext: ActionContext;
}) {
  const port: WidgetVAPagePort = {
    async describeWorkspace(options) {
      return {
        appId: args.store.appId,
        workspaceId: args.store.workspaceId,
        generatedAt: new Date().toISOString(),
        widgets: Object.values(args.store.descriptions),
        dataHandles: Object.values(args.store.dataHandles),
        links: Object.values(args.store.links),
        actions: args.actionExecutor.list(),
        perceptionQueries: args.perceptionQueryRegistry.list()
      };
    },

    async readView(options) {
      const refs = options?.refs ?? (Object.keys(args.store.widgets) as Ref[]);

      const widgets: Record<Ref, WidgetState> = {};
      for (const ref of refs) {
        const state = args.store.widgets[ref];
        if (state) widgets[ref] = state;
      }

      return {
        stateId: args.store.stateId,
        createdAt: new Date().toISOString(),
        widgets,
        shared: {
          activeSelections: {},
          globalFilters: {},
          focusedWidget: undefined
        }
      };
    },

    async executeAction(call) {
      const result = await args.actionExecutor.run(call, args.actionContext);
      return result;
    },

    async queryPerception(call) {
      return args.perceptionQueryRegistry.run(call);
    },

    async getInteractionTrace(options) {
      const limit = options?.limit ?? 50;
      return args.store.interactionTrace.slice(-limit);
    }
  };

  (window as any).__widgetVA = port;
  return port;
}
```

---

## 15. Optional Transport：MCP / Playwright

### 15.1 原则

Transport 层只做转发，不放 VA 语义。

Agent 看到的外部 tools 建议保持少量稳定：

```text
workspace_describe
view_read
action_run
perception_query
interaction_trace_read
```

不要把每个 widget action 都注册成 MCP tool，否则 multi-widget 后工具数量会爆炸。

### 15.2 Playwright 调用示例

```ts
// 外部 Node / Playwright 环境
const description = await page.evaluate(() => {
  return (window as any).__widgetVA.describeWorkspace();
});

const state = await page.evaluate(() => {
  return (window as any).__widgetVA.readView();
});

const result = await page.evaluate((call) => {
  return (window as any).__widgetVA.executeAction(call);
}, {
  callId: "call-001",
  name: "scatter.brushRegion",
  params: {
    xField: "latency",
    yField: "error_rate",
    xRange: [100, 300],
    yRange: [0.05, 0.20]
  },
  actor: "agent"
});
```

---

## 16. Agent Loop

WidgetVA Runtime 支持你的 closed-loop scaffold，但把它从 prompt 行为升级为 runtime 支持。

推荐 agent loop：

```text
1. describeWorkspace()
   读取 widgets / actions / perception queries / widget links

2. readView()
   读取当前 compact state

3. queryPerception() 可选
   查询当前 view/selection 的证据

4. executeAction()
   执行一个 intent-level action

5. readView({ deltaSince })
   读取变化后的 state patch

6. queryPerception({ verify... })
   验证 action effect 或获取分析证据

7. produce answer or continue
```

这能直接支撑你现在的 observe → plan → act → verify → reason scaffold。

推荐在 runtime 中把验证目标显式化，而不是完全交给 prompt：

```text
ActionDescriptor.postconditions
ActionResult.verificationHints
PerceptionQuery.verify*
WorkspaceState.delta
```

这样 benchmark runner 可以复用同一套验证入口，而不是为每类任务单独写隐式检查逻辑。

---

## 17. Interaction Trace

### 17.1 目的

Interaction Trace 记录 human 和 agent 的统一分析轨迹。

它支持：

```text
回放
undo/redo
branching
benchmark trace scoring
human intervention
agent failure diagnosis
```

### 17.2 类型定义

```ts
export interface InteractionTraceRecord {
  stateId: string;
  parentStateId?: string;

  actor: "agent" | "human" | "system";

  action?: ActionCall;
  query?: PerceptionQueryCall;

  affectedRefs: Ref[];
  stateId: string;
  statePatch?: Record<Ref, unknown>;

  timestamp: string;

  notes?: {
    rationale?: string;
    verification?: string;
    userVisibleSummary?: string;
  };
}
```

### 17.3 记录时机

```text
action 成功后
human interaction 被参数化后
agent query 重要证据后
undo / reset / branch 后
```

---

## 18. Multi-widget 操作流程示例

场景：scatter brush 过滤 bar chart 和 table。

### 18.1 Workspace Description

```ts
widgets: [
  {
    ref: "wl://cars/workspace/main/widget/scatter",
    kind: "scatter",
    title: "Horsepower vs MPG"
  },
  {
    ref: "wl://cars/workspace/main/widget/origin_bar",
    kind: "bar",
    title: "Cars by Origin"
  },
  {
    ref: "wl://cars/workspace/main/widget/car_table",
    kind: "table",
    title: "Car Records"
  }
]

links: [
  {
    ref: "wl://cars/workspace/main/link/scatter_brush_filters_bar",
    kind: "filters",
    from: "wl://cars/workspace/main/widget/scatter/selection/brush",
    to: "wl://cars/workspace/main/widget/origin_bar",
    trigger: "selectionChanged",
    effect: "applyFilter",
    automatic: true
  },
  {
    ref: "wl://cars/workspace/main/link/scatter_brush_filters_table",
    kind: "filters",
    from: "wl://cars/workspace/main/widget/scatter/selection/brush",
    to: "wl://cars/workspace/main/widget/car_table",
    trigger: "selectionChanged",
    effect: "applyFilter",
    automatic: true
  }
]
```

### 18.2 Agent Action

```ts
await window.__widgetVA.executeAction({
  callId: "call-001",
  name: "scatter.brushRegion",
  actor: "agent",
  params: {
    xField: "Horsepower",
    yField: "MPG",
    xRange: [60, 120],
    yRange: [20, 40]
  }
});
```

### 18.3 Runtime 内部流程

```text
1. ActionExecutor 找到 scatter.brushRegion handler
2. handler 调 scatter chart 的 setBrush
3. handler patch scatter widget state
4. LinkEngine 发现 scatter brush filters bar/table
5. 自动给 bar/table 加 derived filter transform
6. InteractionTraceRecorder 记录 action
7. StateManager 生成新 stateId
8. 返回 updatedRefs + statePatch
```

### 18.4 返回结果

```json
{
  "ok": true,
  "callId": "call-001",
  "actionName": "scatter.brushRegion",
  "updatedRefs": [
    "wl://cars/workspace/main/widget/scatter",
    "wl://cars/workspace/main/widget/scatter/selection/brush",
    "wl://cars/workspace/main/widget/origin_bar",
    "wl://cars/workspace/main/widget/car_table"
  ],
  "statePatch": {
    "wl://cars/workspace/main/widget/scatter": {
      "selections": {
        "wl://cars/workspace/main/widget/scatter/selection/brush": {
          "kind": "interval",
          "fields": ["Horsepower", "MPG"],
          "value": {
            "Horsepower": [60, 120],
            "MPG": [20, 40]
          }
        }
      }
    },
    "wl://cars/workspace/main/widget/origin_bar": {
      "transforms": [
        {
          "kind": "filter",
          "source": "wl://cars/workspace/main/widget/scatter/selection/brush"
        }
      ]
    },
    "wl://cars/workspace/main/widget/car_table": {
      "transforms": [
        {
          "kind": "filter",
          "source": "wl://cars/workspace/main/widget/scatter/selection/brush"
        }
      ]
    }
  },
  "verificationHints": [
    "Read the updated scatter selection state.",
    "Query the current_selection query to confirm selectedCount.",
    "Read linked bar/table states to confirm filter propagation."
  ]
}
```

---

## 19. 推荐目录结构

```text
src/
  widgetva/
    protocol/
      refs.ts
      description.ts
      state.ts
      actions.ts
      dataHandles.ts
      widgetLinks.ts
      interactionTrace.ts

    runtime/
      RuntimeStore.ts
      ActionExecutor.ts
      PerceptionQueryRegistry.ts
      LinkEngine.ts
      StateManager.ts
      InteractionTraceRecorder.ts
      installPagePort.ts

    adapters/
      WidgetAdapter.ts
      VegaLiteWidgetAdapter.ts
      EChartsWidgetAdapter.ts
      D3WidgetAdapter.ts
      CustomWidgetAdapter.ts

    widgets/
      scatter/
        ScatterWidget.vue
        scatterAdapter.ts
        scatterActions.ts
        scatterPerceptionQueries.ts
      bar/
      line/
      heatmap/
      table/
      map/
      parallelCoordinates/

    data/
      DataQueryEngine.ts
      JsArrayDataQueryEngine.ts
      DuckDbDataQueryEngine.ts
      RemoteDataQueryEngine.ts

    transport/
      mcpTools.ts
      playwrightClient.ts

    evaluation/
      traceRecorder.ts
      stateConstraintEvaluator.ts
      actionTraceEvaluator.ts
      evidenceEvaluator.ts
```

---

## 20. MVP 实现路线

### Phase 1：Single-widget front-end runtime

目标：把现有 Python/FastAPI tool registry 中的 widget tool 迁到前端。

实现：

```text
Widget Ref
Widget Description
Widget State
ActionExecutor
PerceptionQueryRegistry
Page API: window.__widgetVA
1-2 个 widget adapter：scatter/bar
```

验收：

```text
浏览器控制台可以调用：
window.__widgetVA.describeWorkspace()
window.__widgetVA.readView()
window.__widgetVA.executeAction(...)
window.__widgetVA.queryPerception(...)
```

### Phase 2：Human 和 agent 共用 action pipeline

目标：人类鼠标操作也被参数化成同一套 action / interaction trace。

实现：

```text
bindHumanInteractions
human action records
interaction trace
undo / jump-to-state
```

验收：

```text
人类 brush 和 agent brush 在 interaction trace 里格式一致。
```

### Phase 3：Multi-widget widget link

目标：支持 linked widgets。

实现：

```text
Widget Link Map
Widget Link Engine
shared activeSelections
affectedRefs / effects
multi-widget state patch
```

验收：

```text
scatter brush 自动过滤 bar/table。
agent 可以通过 describeWorkspace 理解 link。
execute 后返回 updatedRefs 包含所有受影响 widgets。
```

### Phase 4：Data Query Handle

目标：让 agent 按需查询 evidence。

实现：

```text
DataQueryHandle
JsArrayDataQueryEngine
summarizeSelection
computeCorrelation
findExtremes
compareGroups
```

验收：

```text
state 里不塞全量 rows。
agent 通过 queryPerception 获取当前 selection 的聚合证据。
```

### Phase 5：Transport and benchmark integration

目标：接入 MCP/Playwright 和 benchmark runner。

实现：

```text
workspace_describe
view_read
action_run
perception_query
interaction_trace_read
trace recorder
state constraint evaluator
```

验收：

```text
同一个 benchmark task 可以在 pixel baseline、flat tool baseline、WidgetVA condition 下运行。
```

---

## 20.1 Benchmark Runtime Integration

为了确保这套 runtime 不只是通用前端框架，而是真的能直接服务你现有和后续的 benchmark / evaluation，建议把 benchmark task 升级为 workspace-level task contract。

### Task 对象

```ts
export interface BenchmarkTaskSpec {
  taskId: string;
  datasetId: string;
  workspaceId: string;

  userQuery: string;

  taskFamily:
    | "lookup"
    | "filter"
    | "compare"
    | "rank"
    | "distribution"
    | "correlation"
    | "outlier"
    | "cluster"
    | "trend"
    | "flow"
    | "multiViewCoordination"
    | "drillDown";

  answerType: "exact" | "bounded" | "exploratory";
  interactionHorizon: "single_step" | "multi_step";
  coordinationScope: "single_widget" | "multi_widget" | "workspace";
  evidenceType: "initial_view" | "interaction_revealed" | "cross_widget";

  targetWidgetRefs: Ref[];
  initialWorkspaceStateId?: string;

  references: {
    acceptableAnswers?: unknown[];
    requiredPrimitives?: ActionPrimitive[];
    optionalBindings?: string[];
    finalStateConstraints?: StateConstraint[];
    tracePatterns?: TracePattern[];
  };
}

export interface StateConstraint {
  ref: Ref;
  path: string;
  matcher: "equals" | "contains" | "overlap" | "nonEmpty" | "exists";
  expected?: unknown;
}

export interface TracePattern {
  primitiveSequence?: ActionPrimitive[];
  requiredRefs?: Ref[];
  maxSteps?: number;
}
```

### 设计原则

```text
benchmark 任务不要只绑定单 widget
任务应能显式声明 coordination scope
reference trace 不应只记录具体 tool name，也应记录 primitive pattern
state constraints 应可直接映射到 WorkspaceState / WidgetState 路径
```

---

## 20.2 Evaluation Hooks and Experimental Conditions

为了让 runtime 直接支持能力评估，建议内建统一的 evaluation hooks，而不是事后从日志硬解析。

### Runtime 必须直接暴露的评估信息

```text
1. action call trace
2. primitive trace
3. state delta per step
4. affected refs
5. verification hints and verify-query results
6. final workspace snapshot
7. branch / undo / reset events
```

### 评估条件建议

同一个 benchmark task 至少应支持下面四个运行条件：

```text
Condition A: Pixel-level
  只能 screenshot + click / drag / keyboard

Condition B: Flat tool
  有函数调用，但没有 WidgetVA workspace description / link map / state patch / verification hints

Condition C: Single-widget WidgetVA
  开启 WidgetVA protocol，但只暴露单 widget

Condition D: Full WidgetVA workspace
  开启 WidgetVA protocol + multi-widget links + verification-ready runtime
```

### 建议指标

```text
Task success
Answer quality
Primitive selection accuracy
Binding execution accuracy
State constraint satisfaction
Cross-widget propagation accuracy
Invalid action rate
Recovery success rate
Average steps / token cost / wall-clock latency
Replay consistency
```

### 为什么这些 hooks 要放进 runtime

```text
否则 benchmark evaluator 会和 runtime 脱节
否则 multi-widget propagation 无法被稳定复现和评分
否则 protocol 相比 flat tools / pixel baseline 的优势难以被干净量化
```

---

## 21. 与现有论文版本的对应关系

当前论文中的 `W = <S, A, P>` 可以直接映射：

```text
S → WidgetState + WorkspaceState
A → ActionList + ActionExecutor
P → PerceptionQueryList + DataQueryEngine
```

当前 system interface 中的三个重要 UI 也可以接入 runtime：

```text
Visualization Panel → Widget Adapter + Widget State rendering
Agent Panel → Page API + Agent loop
Interaction Trace Panel → Interaction Trace
```

当前 benchmark 的三类 evaluation 也能直接被 runtime 支撑：

```text
Answer Quality → final response + evidence logs
Tool Quality → ActionCall trace
State Quality → View State / state constraints
```

如果升级到 workspace-level benchmark，则还可增加：

```text
Coordination Quality → Widget Link propagation + shared selection consistency
Process Quality → primitive trace + recovery path + replay consistency
```

---

## 22. 关键设计差异：为什么它不是 Vega-Lite，也不是简单 tool calls

### 22.1 不是 Vega-Lite

Vega-Lite 主要回答：

```text
怎么根据 spec 渲染图？
字段映射到哪些视觉通道？
selection 怎么声明？
```

WidgetVA Runtime 回答：

```text
agent 当前能操作哪些 widget？
每个 action 的参数是什么？
action 会影响哪些 widgets？
当前 state 和上一步 state 有什么差异？
agent 应该怎么查询证据？
human 和 agent 的操作如何统一记录和回放？
```

### 22.2 不是 flat tools

Flat tools 只是给 agent 一堆函数：

```text
filter_categorical
zoom_2d_region
calculate_correlation
```

WidgetVA Runtime 额外提供：

```text
target refs
affected refs
widget links
state patches
verification hints
interaction trace
perception queries
```

这能减少 tool grounding error 和 planning drift。

### 22.3 不是 pixel/DOM control

Pixel/DOM control 要求 agent 猜：

```text
点哪里
拖哪里
哪个 DOM element 对应哪个数据对象
```

WidgetVA Runtime 让 agent 操作：

```text
数据字段
数据范围
selection ref
widget ref
action schema
```

---

## 23. 最小端到端示例

```ts
// 1. 创建 store/router/registry
const store = createRuntimeStore({ appId: "demo", workspaceId: "main" });
const actionExecutor = new ActionExecutor();
const perceptionQueryRegistry = new PerceptionQueryRegistry();
const widgetLinkEngine = new LinkEngine(store);

// 2. 创建底层图表
const scatterChart = createScatterChart({ el: "#scatter", data });

// 3. 创建 adapter
const scatterAdapter = new ScatterWidgetAdapter(
  "wl://demo/workspace/main/widget/scatter",
  scatterChart,
  "wl://demo/workspace/main/data/cars"
);

// 4. 注册 widget
store.descriptions[scatterAdapter.widgetRef] = scatterAdapter.getDescription();
store.widgets[scatterAdapter.widgetRef] = scatterAdapter.getState();

// 5. 注册 actions 和 queries
scatterAdapter.registerActions(actionExecutor);
scatterAdapter.registerPerceptionQueries(perceptionQueryRegistry);

// 6. 安装 page API
installWidgetVAPagePort({
  store,
  actionExecutor,
  perceptionQueryRegistry,
  actionContext: {
    store,
    patchWidget: (ref, patch) => store.patchWidget(ref, patch),
    propagate: (ref) => widgetLinkEngine.propagate(ref),
    readStatePatch: (refs) => readStatePatch(store, refs)
  }
});

// 7. agent / console 调用
await window.__widgetVA.describeWorkspace();

await window.__widgetVA.executeAction({
  callId: "1",
  name: "scatter.brushRegion",
  actor: "agent",
  params: {
    xField: "Horsepower",
    yField: "MPG",
    xRange: [60, 120],
    yRange: [20, 40]
  }
});

await window.__widgetVA.readView();
```

---

## 24. 开发优先级建议

最先实现的核心能力：

```text
1. Ref 生成器
2. Widget Description / State 类型
3. ActionExecutor
4. Page API
5. Scatter + Bar adapters
6. PerceptionQueryRegistry: inspect/summarize/compute
7. InteractionTraceRecorder
8. LinkEngine
```

暂时可以不急着实现：

```text
MCP server
DuckDB-WASM
复杂 DSL query
全量 schema validation UI
复杂 benchmark evaluator
```

先把前端 runtime 跑通，再把 benchmark 接上来。

### UI 待办（暂不打断主线）

当前前端主要服务于功能推进，不代表最终 VA system 的视觉语言。

后续可以单独开一条 UI refinement 任务，目标更贴近 VIS / TVCG 常见 VA 系统审美：

```text
更克制的信息密度
更明确的 workspace / view hierarchy
更弱装饰、更强结构
更专业的 panel / toolbar / provenance 视觉语言
更贴近分析系统而非消费级 dashboard 的配色和排版
```

但这部分应在 widget/workspace runtime 主线稳定后再做。

---

## 25. 一句话总结

WidgetVA Runtime 的核心不是“多写几个 tool”，而是把 VA widget 做成 agent 可发现、可操作、可验证、可组合的前端 runtime contract：

```text
Widget state tells the agent what is shown.
Action catalog tells the agent what can be changed.
Perception queries tell the agent how to collect evidence.
Widget Link map tells the agent how widgets affect each other.
Interaction trace tells humans and evaluators how the analysis happened.
```

它应该继承你现在 `W = <S, A, P>` 的优势，但升级为 multi-widget、front-end runtime、evaluation-ready 的技术框架。
