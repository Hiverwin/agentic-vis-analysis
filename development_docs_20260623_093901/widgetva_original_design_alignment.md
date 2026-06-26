# WidgetVA Original Design Alignment

基准文档：

- [widgetva_runtime_core_design.md](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva_runtime_core_design.md:1)

目标：

- 以原始设计文档为准，重新界定当前代码中的
  - 必须保留
  - 可以保留但应降级
  - 应冻结/退场/后置

本文档不讨论 benchmark 论文叙事，也不讨论 evaluation 完整性，只讨论是否符合原始 `WidgetVA Runtime` 主设计。

---

## 1. 原始设计的核心范围

原始文档明确要求的核心对象和能力只有这些：

1. `Widget Ref`
2. `Widget Description`
3. `View State`
4. `Action List`
5. `Perception Query List`
6. `Data Query Handle`
7. `Widget Link Map`
8. `Interaction Trace`
9. `Runtime Store`
10. `Action Executor`
11. `LinkEngine`
12. `Widget Adapter`
13. `Page API`
14. front-end first 的 multi-widget coordinated VA runtime

换句话说，原始目标是：

- agent-facing
- front-end first
- widget-centric
- data-space actions
- multi-widget propagation
- page API 可调用

而不是：

- benchmark-first
- evaluation-first
- result-schema-first
- introspection-platform-first

---

## 2. 必须保留

这些内容直接对应原始文档主线，应继续开发并优先验证。

### 2.1 Core model

- [frontend/src/widgetva/protocol/refs.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/refs.js:1)
- [frontend/src/widgetva/protocol/state.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/state.js:1)
- [frontend/src/widgetva/protocol/dataHandles.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/dataHandles.js:1)
- [frontend/src/widgetva/protocol/widgetLinks.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/widgetLinks.js:1)
- [frontend/src/widgetva/protocol/actions.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/actions.js:1)
- [frontend/src/widgetva/protocol/perception.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/perception.js:1)
- [frontend/src/widgetva/protocol/description.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/description.js:1)
- [frontend/src/widgetva/protocol/workspaceSpec.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/workspaceSpec.js:1)

### 2.2 Runtime core

- [frontend/src/widgetva/runtime/RuntimeStore.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/RuntimeStore.js:1)
- [frontend/src/widgetva/runtime/WidgetRegistry.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/WidgetRegistry.js:1)
- [frontend/src/widgetva/runtime/ActionContext.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/ActionContext.js:1)
- [frontend/src/widgetva/runtime/ActionExecutor.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/ActionExecutor.js:1)
- [frontend/src/widgetva/runtime/PerceptionContext.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/PerceptionContext.js:1)
- [frontend/src/widgetva/runtime/PerceptionQueryRegistry.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/PerceptionQueryRegistry.js:1)
- [frontend/src/widgetva/runtime/DataQueryContext.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/DataQueryContext.js:1)
- [frontend/src/widgetva/runtime/DataQueryExecutor.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/DataQueryExecutor.js:1)
- [frontend/src/widgetva/runtime/LinkEngine.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/LinkEngine.js:1)
- [frontend/src/widgetva/runtime/WorkspaceMaterializer.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/WorkspaceMaterializer.js:1)
- [frontend/src/widgetva/runtime/sharedStateDerivation.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/sharedStateDerivation.js:1)
- [frontend/src/widgetva/runtime/workspaceStoreReaders.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/workspaceStoreReaders.js:1)
- [frontend/src/widgetva/runtime/workspaceStoreMutators.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/workspaceStoreMutators.js:1)

### 2.3 Planning and adapter path

- [frontend/src/widgetva/protocol/planning.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/planning.js:1)
- [frontend/src/widgetva/runtime/planning/WorkspacePlanner.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/planning/WorkspacePlanner.js:1)
- [frontend/src/widgetva/runtime/deriveWorkspaceTopology.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/deriveWorkspaceTopology.js:1)
- `frontend/src/widgetva/adapters/**`
- `frontend/src/widgetva/widgets/**`

### 2.4 Page API and transport minimum path

- [frontend/src/widgetva/protocol/pagePort.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/pagePort.js:1)
- [frontend/src/widgetva/runtime/installPagePort.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/installPagePort.js:1)
- [frontend/src/widgetva/transport/inPageTransport.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/transport/inPageTransport.js:1)
- page-based transport/example surfaces only insofar as they prove the page API is usable

### 2.5 Frontend visible mainline

- [frontend/src/components/WorkspaceCanvas.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/WorkspaceCanvas.jsx:1)
- [frontend/src/components/ChartCanvas.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/ChartCanvas.jsx:1)
- [frontend/src/components/TableCanvas.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/TableCanvas.jsx:1)
- [frontend/src/components/RuntimeActionRunnerCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeActionRunnerCard.jsx:1)
- [frontend/src/components/RuntimePerceptionRunnerCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimePerceptionRunnerCard.jsx:1)
- [frontend/src/components/RuntimeDataQueryRunnerCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeDataQueryRunnerCard.jsx:1)
- [frontend/src/components/RuntimePlannerCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimePlannerCard.jsx:1)
- [frontend/src/components/RuntimeLinkMapCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeLinkMapCard.jsx:1)
- [frontend/src/components/RuntimePropagationCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimePropagationCard.jsx:1)
- [frontend/src/components/RuntimePageApiCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimePageApiCard.jsx:1)
- [frontend/src/components/RuntimeHistoryCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeHistoryCard.jsx:1)
- [frontend/src/components/RuntimeViewStateCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeViewStateCard.jsx:1)

---

## 3. 可以保留，但必须降级

这些内容不是原始主线的中心，但保留它们有助于开发、调试或未来扩展。

原则：

- 不再默认展示
- 不再默认驱动开发方向
- 不再要求 core 为它们继续膨胀

### 3.1 Observability

- [frontend/src/widgetva/runtime/InteractionTraceRecorder.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/InteractionTraceRecorder.js:1)
- [frontend/src/widgetva/runtime/ResponseRecorder.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/ResponseRecorder.js:1)
- [frontend/src/widgetva/runtime/StateManager.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/StateManager.js:1)
- [frontend/src/widgetva/runtime/RuntimeCoreIntrospector.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/RuntimeCoreIntrospector.js:1)

这些在原始文档里有合理性，因为 `Interaction Trace` 和 `StateManager` 是原始设计的一部分，但它们应服务主线，不应主导结构。

### 3.2 Introspection protocol summaries

- [frontend/src/widgetva/protocol/runtimeCore.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/runtimeCore.js:1)
- [frontend/src/widgetva/protocol/runtimeStore.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/runtimeStore.js:1)
- [frontend/src/widgetva/protocol/actionContext.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/actionContext.js:1)
- [frontend/src/widgetva/protocol/actionExecutor.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/actionExecutor.js:1)
- [frontend/src/widgetva/protocol/perceptionContext.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/perceptionContext.js:1)
- [frontend/src/widgetva/protocol/perceptionRegistry.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/perceptionRegistry.js:1)
- [frontend/src/widgetva/protocol/dataQueryContext.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/dataQueryContext.js:1)
- [frontend/src/widgetva/protocol/dataQueryEngine.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/dataQueryEngine.js:1)
- [frontend/src/widgetva/protocol/dataQueryExecutor.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/dataQueryExecutor.js:1)
- [frontend/src/widgetva/protocol/widgetRegistry.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/widgetRegistry.js:1)
- [frontend/src/widgetva/protocol/traceRecorder.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/traceRecorder.js:1)
- [frontend/src/widgetva/protocol/responses.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/responses.js:1)
- [frontend/src/widgetva/protocol/interactionTrace.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/interactionTrace.js:1)
- [frontend/src/widgetva/protocol/stateManager.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/stateManager.js:1)

这些不是必须删除，但应明确视为开发者可见性层，而不是核心业务协议层。

### 3.3 观察用 UI

- [frontend/src/components/RuntimeInspectorCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeInspectorCard.jsx:1)
- [frontend/src/components/RuntimeTraceCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeTraceCard.jsx:1)
- [frontend/src/components/RuntimePerceptionCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimePerceptionCard.jsx:1)
- [frontend/src/components/RuntimeDataQueryCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeDataQueryCard.jsx:1)
- [frontend/src/components/RuntimeRefCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeRefCard.jsx:1)
- [frontend/src/components/RuntimeAdapterCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeAdapterCard.jsx:1)
- [frontend/src/components/RuntimeActionCatalogCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeActionCatalogCard.jsx:1)
- [frontend/src/components/RuntimePerceptionCatalogCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimePerceptionCatalogCard.jsx:1)
- [frontend/src/components/InteractionTrajectoryPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/InteractionTrajectoryPanel.jsx:1)
- [frontend/src/components/TrajectoryModal.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/TrajectoryModal.jsx:1)

这些可以存在，但默认不应压过主运行链。

---

## 4. 应冻结、退场或后置

这些内容不是原始核心要求的一部分，而且已经明显开始影响主线开发。

### 4.1 Evaluation runtime

- [frontend/src/widgetva/runtime/RuntimeEvaluation.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/RuntimeEvaluation.js:1)
- [frontend/src/widgetva/runtime/BenchmarkRuntimeAdapter.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/BenchmarkRuntimeAdapter.js:1)
- [frontend/src/widgetva/runtime/installEvaluationPort.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/runtime/installEvaluationPort.js:1)
- [frontend/src/widgetva/protocol/evaluationPort.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/evaluationPort.js:1)

建议：

- 立即冻结
- 从默认 runtime 初始化路径退场
- 只保留显式开启的开发模式

### 4.2 Benchmark / evaluation contracts

- [frontend/src/widgetva/protocol/benchmark.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/benchmark.js:1)
- [frontend/src/widgetva/protocol/results.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/protocol/results.js:1)
- `frontend/src/widgetva/evaluation/**`

建议：

- 不再继续扩
- 从主开发循环剥离
- 迁移到单独 `evaluation/` 分层

### 4.3 Evaluation-first UI

- [frontend/src/components/RuntimeEvidenceCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeEvidenceCard.jsx:1)
- [frontend/src/components/RuntimeVerificationCard.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/components/RuntimeVerificationCard.jsx:1)

建议：

- 默认隐藏
- 不再作为主界面默认组件
- 只有显式需要 benchmark/evaluation 时再打开

### 4.4 顶层 public surface 中的大批 evaluation exports

- [frontend/src/widgetva/index.js](/Users/chenyutong/Desktop/agentic-visual-reframe/frontend/src/widgetva/index.js:1) 中大批：
  - `evaluation*FromPage`
  - `evaluation*FromWebSocket`
  - `evaluation*FromExtension`
  - `RuntimeEvaluation`
  - `BenchmarkRuntimeAdapter`
  - `installWidgetVAEvaluationPort`

建议：

- 不立即删除
- 但应从“主 public API”降级为“advanced/evaluation API”
- 后续最好拆到单独入口，而不是继续塞在顶层 `index.js`

---

## 5. 立即执行建议

如果按原始文档回收，建议优先按下面顺序做。

### Step 1

只保留主界面默认路径中的：

- planner
- page API
- action runner
- perception runner
- data-query runner
- link map
- live propagation
- history
- view state

说明：

- 这一步已经开始做了
- `RuntimeEvidenceCard` / `RuntimeVerificationCard` 已经可以默认隐藏

### Step 2

把 evaluation runtime 从默认初始化中摘掉：

- `RuntimeEvaluation`
- `BenchmarkRuntimeAdapter`
- `installWidgetVAEvaluationPort`

说明：

- 这一步会真正减少主 runtime 的复杂度
- 也是原始主线收束最重要的一步

### Step 3

把 benchmark/evaluation 顶层导出改成“后置入口”：

- 不再和主 runtime/core surface 混在一个主入口里

### Step 4

只继续开发：

- `refs / state / description / actions / perception / dataHandles / widgetLinks`
- `RuntimeStore / ActionExecutor / PerceptionQueryRegistry / DataQueryExecutor / LinkEngine`
- `planning / materialization / pagePort`
- `WorkspaceCanvas` 及其主运行链组件

---

## 6. 关于“降级层是否还有必要”

结论：

- **有必要存在**
- **但不应该继续参与默认开发流**

原因：

1. 原始文档本来就需要 `Interaction Trace` 和 state/history。
2. 开发主线时，最小 observability 仍然有用。
3. 但 evaluation/benchmark 这层不应该继续默认装载、默认显示、默认扩展。

所以正确做法不是：

- 把一切观察和验证能力删光

而是：

- 保留最小 observability
- 让 evaluation/benchmark 退成显式附加层

换句话说：

- `observability` 应保留
- `evaluation-first runtime` 应降级

---

## 7. 当前建议的开发边界

### 继续开发

- `frontend/src/widgetva/protocol/refs.js`
- `frontend/src/widgetva/protocol/state.js`
- `frontend/src/widgetva/protocol/dataHandles.js`
- `frontend/src/widgetva/protocol/widgetLinks.js`
- `frontend/src/widgetva/protocol/actions.js`
- `frontend/src/widgetva/protocol/perception.js`
- `frontend/src/widgetva/protocol/description.js`
- `frontend/src/widgetva/protocol/planning.js`
- `frontend/src/widgetva/protocol/pagePort.js`
- `frontend/src/widgetva/runtime/RuntimeStore.js`
- `frontend/src/widgetva/runtime/ActionExecutor.js`
- `frontend/src/widgetva/runtime/PerceptionQueryRegistry.js`
- `frontend/src/widgetva/runtime/DataQueryExecutor.js`
- `frontend/src/widgetva/runtime/LinkEngine.js`
- `frontend/src/widgetva/runtime/WorkspaceMaterializer.js`
- `frontend/src/widgetva/runtime/planning/WorkspacePlanner.js`
- `frontend/src/widgetva/runtime/installPagePort.js`
- `frontend/src/widgetva/transport/inPageTransport.js`
- `frontend/src/components/WorkspaceCanvas.jsx`
- `frontend/src/components/RuntimeActionRunnerCard.jsx`
- `frontend/src/components/RuntimePerceptionRunnerCard.jsx`
- `frontend/src/components/RuntimeDataQueryRunnerCard.jsx`
- `frontend/src/components/RuntimePlannerCard.jsx`
- `frontend/src/components/RuntimeLinkMapCard.jsx`
- `frontend/src/components/RuntimePropagationCard.jsx`

### 冻结或后置

- `frontend/src/widgetva/protocol/benchmark.js`
- `frontend/src/widgetva/protocol/results.js`
- `frontend/src/widgetva/protocol/evaluationPort.js`
- `frontend/src/widgetva/runtime/RuntimeEvaluation.js`
- `frontend/src/widgetva/runtime/BenchmarkRuntimeAdapter.js`
- `frontend/src/widgetva/runtime/installEvaluationPort.js`
- `frontend/src/widgetva/evaluation/**`
- `frontend/src/components/RuntimeEvidenceCard.jsx`
- `frontend/src/components/RuntimeVerificationCard.jsx`
