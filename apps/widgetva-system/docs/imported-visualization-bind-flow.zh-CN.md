# Imported Visualization: Load -> Render -> Bind -> Agent

## 1. 目标

这条链路解决的是一个很具体的产品目标：

1. 用户先把一段可视化代码贴进当前 VA。
2. 系统先把图渲染出来，让用户确认“图本身是对的”。
3. 用户再明确点击一次 `Bind current visualization`，把这张图注册成 runtime widget。
4. 绑定完成后，agent 才开始基于 widget contract 做分析和操作。

这里最重要的边界是：

- `load` 只负责解析和渲染。
- `bind` 才负责进入 runtime / workspace / widget contract。
- agent 不应该在 `load` 之后自动启动，也不应该隐式绑定。

## 2. 产品步骤

当前 UI 上的推荐使用步骤是：

1. 在左侧环境切换里选渲染环境：`Vega` / `ECharts` / `Vgplot`。
2. 在 `Load spec` 面板粘贴代码。
3. 点击 `Load visualization`。
4. 此时工作区只显示一个 preview，用户先看图是否渲染正确。
5. 如果图正确，再点击 `Bind current visualization`。
6. 系统显示绑定成功提示，包括：
   - provider
   - widget kind
   - `widgetRef`
   - `workspaceRef`
   - action 数量
   - perception 数量
7. 这时右侧 agent 面板才真正可用，用户再输入自然语言目标。

这条流程是“先有图，再绑定成 widget，再和 agent 对话”，不是“贴完代码就自动变成 runtime workspace”。

## 3. 为什么这里不做成状态机

这里不需要额外引入一套复杂状态机，原因很简单：

- 这不是一个高并发、多分支、可重入的协议流程。
- 它本质上只是一个清晰的用户操作顺序：
  - 未加载
  - 已渲染 preview
  - 已绑定 runtime
- UI 是否可用，只需要几个明确字段就能判断。

当前实现里，真正承担流程门控的是这几个 store 字段：

- `loadedVisualizationPreview`
- `visualizationLoadError`
- `visualizationLoadSummary`
- `visualizationBindStatus`
- `visualizationBindError`
- `visualizationBindSummary`

也就是说，这里采用的是“步骤流 + 少量显式状态字段”，而不是另造一套复杂状态机框架。

相关代码在：

- [appStore.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/app/appStore.js:336)

## 4. load 阶段的边界

`load` 阶段只做三件事：

1. 解析用户贴进来的代码。
2. 自动识别 provider。
3. 构造一个 render-only preview widget，并显示在当前 workspace stage。

这里不会做：

- 不会注册 runtime workspace case。
- 不会生成 `widgetRef` 给 agent 使用。
- 不会自动开始 agent objective。
- 不会把 preview 混进现有 widget navigator。

### 4.1 解析和预览构造

解析与 preview 构造在：

- [importedArtifactLoader.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/appRuntime/imports/importedArtifactLoader.js:246)
- [buildVisualizationPreview(...)](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/appRuntime/imports/importedArtifactLoader.js:490)

这部分负责：

- `parseVisualizationArtifactScript(...)`
- `detectVisualizationProvider(...)`
- 推断 `widgetKind`
- 生成一个 `sourceType: 'loadedPreview'` 的 widget

### 4.2 store 中的 load 动作

真正触发 load 的 store 动作是：

- [loadVisualizationScript(...)](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/app/appStore.js:540)

它的结果是：

- 写入 `loadedVisualizationPreview`
- 设置 `visualizationLoadSummary`
- 清空之前的 bind 结果
- 不切换 `activeCaseId`
- 不创建 runtime session

## 5. render 阶段的 UI 呈现

preview 渲染以后，工作区进入“只显示一个预览图”的模式。

### 5.1 WorkspaceStage

工作区优先显示 preview widget，而不是 runtime widgets：

- [WorkspaceStage.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/WorkspaceStage.jsx:89)

这里的关键行为是：

- 如果 `loadedVisualizationPreview` 存在，就把它作为当前唯一 widget 渲染。
- header 文案改成 preview 模式。
- 状态文案显示 `single-view-preview`。
- 不显示 runtime 过滤条和联动统计。
- 不允许用户在 preview 阶段用 navigator 切换 runtime widget。

### 5.2 WidgetSurface

preview 复用现有 native renderer，而不是单独再造一套渲染系统：

- [WidgetSurface.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/workspace/WidgetSurface.jsx)

当前支持 `loadedPreview` 走和 `importedSpec` 一样的 provider 渲染分支。

## 6. bind 阶段的边界

`bind` 才是真正把图挂进 runtime 的步骤。

这里复用现有的 runtime 注册链路，但调用时机必须延后到用户显式点击 bind 之后。

### 6.1 bind 动作做什么

`bindCurrentVisualization(...)` 会做这些事情：

1. 读取 `loadedVisualizationPreview.scriptText`
2. 调用 `buildImportedVisualizationCase(...)`
3. 调用 `registerWorkspaceCaseOverride(...)`
4. 调用 `createInitialSessionState(...)`
5. 读取 runtime description
6. 生成绑定成功提示
7. 切换到新 imported workspace
8. 清掉 preview

相关代码在：

- [bindCurrentVisualization(...)](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/app/appStore.js:576)

### 6.2 为什么 bind 复用现有 runtime 接口

这里不需要再发明一套新的“绑定协议”。

因为系统里本来就已经有一条把图注册成 runtime widget 的能力链：

- `buildImportedVisualizationCase(...)`
- `registerWorkspaceCaseOverride(...)`
- `createInitialSessionState(...)`

真正要改的是“何时调用”，而不是“另造什么新 runtime 结构”。

相关构造代码：

- [buildImportedVisualizationCase(...)](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/appRuntime/imports/importedArtifactLoader.js:573)

## 7. 绑定成功后用户应该看到什么

点击 `Bind current visualization` 后，UI 需要给用户一个非常明确的成功反馈。

当前绑定成功 summary 包含：

- `Provider`
- `Widget kind`
- `widgetRef`
- `workspaceRef`
- action 数量
- perception 数量

生成逻辑在：

- [buildVisualizationBindSummary(...)](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/app/appStore.js:227)

这一步的目的不是给用户暴露一堆内部实现，而是明确告诉用户：

- 这张图现在已经不是普通 preview
- 它已经被绑定成 runtime widget
- agent 后续会基于哪一个 `widgetRef` / `workspaceRef` 工作

## 8. bind 之前，哪些面板要被门控

preview 阶段必须避免“看起来像已经进入 runtime，但其实还没有”的混乱感。

所以当前有几处明确门控：

### 8.1 AgentPanel

在 preview 还没 bind 时：

- agent 按钮禁用
- 按钮文案改成 `Bind visualization first`
- 文案提示用户先绑定

代码在：

- [AgentPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis/AgentPanel.jsx:123)

### 8.2 InspectPanel

在 preview 还没 bind 时：

- 不展示 widget refs / actions / perceptions
- 直接提示用户先 bind

代码在：

- [InspectPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis/InspectPanel.jsx:153)

### 8.3 WidgetLibraryPanel

在 preview 阶段：

- runtime widget 列表先隐藏
- summary 改成 `Preview pending bind`
- 展示 preview 的 title / provider / widgetKind

代码在：

- [WidgetLibraryPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/setup/WidgetLibraryPanel.jsx:24)

### 8.4 DatasetPanel

在 preview 阶段：

- 不把它伪装成已绑定数据工作区
- 明确提示：先 bind 才会暴露 runtime widget refs / action catalog / agent-readable handles

代码在：

- [DatasetPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/setup/DatasetPanel.jsx:55)

### 8.5 ControlsPanel

在 preview 阶段：

- 不再展示 runtime interaction / reset / analysis shortcut 按钮
- 直接切成 `Preview mode` 提示
- 明确告诉用户：先 bind，再使用这些 runtime controls

代码在：

- [ControlsPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/analysis/ControlsPanel.jsx:5)

## 9. VisualizationLoadPanel 的职责

`VisualizationLoadPanel` 现在承担的是整条交互链的入口 UI。

它当前的行为应该理解成：

1. 用户贴代码
2. 点 `Load visualization`
3. 如果 preview 成功出现，再显示 `Bind current visualization`
4. bind 成功后，显示 summary

代码在：

- [VisualizationLoadPanel.jsx](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/setup/VisualizationLoadPanel.jsx:4)

这个面板是整个流程里最接近用户的一层，所以它的职责是：

- 只展示必要步骤
- 不暴露过多内部中间对象
- 给出明确成功/失败反馈

## 10. 不应该暴露给用户的中间概念

下面这些概念可以保留在内部实现里，但不应该在 UI 上变成强感知字段：

- `artifactId`
- `renderSessionId`
- `viewHandle`
- `detectedStructure`
- `buildRenderDescriptor(...)`

对用户来说，真正重要的是：

- 图有没有成功渲染
- 当前走的是哪个 provider
- 绑定后变成了什么 widget kind
- agent 现在能不能操作它

## 11. 当前实现的产品语义

这条链路的产品语义已经明确为：

### 阶段 A：Load

- 用户把 spec / option / vgplot script 贴进来
- 系统自动识别 provider
- 图先渲染出来

### 阶段 B：Bind

- 用户显式点击 bind
- 系统把图注册成 runtime widget
- 用户拿到明确的绑定成功反馈

### 阶段 C：Agent

- 用户再发起自然语言分析请求
- agent 基于当前 bound workspace 的 contract 工作

也就是说，`bind = 把已渲染图注册为可被 agent 操作的 runtime widget`。

## 12. 当前验收重点

这条链路当前的验收重点应该是：

1. `Load visualization` 后，图能渲染出来，但 workspace 不切到 imported runtime。
2. `Bind current visualization` 后，workspace 才切换到 imported runtime。
3. bind 成功 summary 信息完整。
4. bind 前 agent 不可运行，bind 后 agent 可运行。
5. bind 前 inspect / widget navigator 不误导用户。

## 13. 关于 action catalog 的一个重要边界

绑定成功之后，用户会看到 action / perception 数量，但这里要注意：

- `bind` 成功只表示“这张图已经进入 runtime contract”。
- 它不表示该 widget family 的所有理论动作都会立刻可用。

真正暴露给 agent 的 action catalog，仍然会受到当前图 materialization 的限制。

例如：

- 某个 line 图如果当前没有满足 temporal drill-down 的结构条件，就不会立刻暴露 `line.drillDownXAxis`。
- 某个 heatmap 如果当前没有满足 drilldown 的轴语义，也不会暴露 `heatmap.drilldownAxis`。
- 某些需要额外结构状态的动作，也可能在当前图态下暂时不可用。

所以正确理解应该是：

- `bind` 解决的是“图进入 runtime，agent 可以看见并操作它”。
- `action catalog` 解决的是“在当前这张图的真实结构下，哪些动作此刻真的可执行”。

## 14. 人工验收流程

下面是一条最小可复现的人工验收路径，专门验证这次实现的是不是符合“先 load，后 bind，再 agent”的产品逻辑。

### 14.1 启动

```bash
cd /Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system
npm run dev -- --host 127.0.0.1 --port 4173
```

浏览器打开：

- [http://127.0.0.1:4173/](http://127.0.0.1:4173/)

### 14.2 验收用示例

把下面这段 Vega-Lite spec 粘进 `Load spec`：

```json
{
  "$schema": "https://vega.github.io/schema/vega-lite/v6.json",
  "title": "Loaded line into current VA",
  "data": {
    "values": [
      { "date": "2024-01-01", "value": 3 },
      { "date": "2024-02-01", "value": 5 },
      { "date": "2024-03-01", "value": 4 }
    ]
  },
  "mark": "line",
  "encoding": {
    "x": { "field": "date", "type": "temporal" },
    "y": { "field": "value", "type": "quantitative" }
  }
}
```

### 14.3 预期结果 A：点击 `Load visualization`

这一步之后应该看到：

1. 工作区中间已经渲染出图。
2. 左侧出现 `Bind current visualization` 按钮。
3. `Workspace navigator` 显示 `Preview pending bind`。
4. `Workspace stage` 显示 `single-view-preview`。
5. `InspectPanel` 提示先 bind。
6. `ControlsPanel` 进入 `Preview mode`，不再显示 runtime interaction 按钮。
7. 切到 `Agent` tab 后，按钮显示 `Bind visualization first`，且不可点击。

### 14.4 预期结果 B：点击 `Bind current visualization`

这一步之后应该看到：

1. `Bind current visualization` 按钮消失。
2. 出现绑定成功 summary。
3. summary 中包含：
   - `Provider`
   - `Widget kind`
   - `widgetRef`
   - `workspaceRef`
   - action 数量
   - perception 数量
4. `Workspace navigator` 变成真实 runtime widget 列表。
5. `DatasetPanel` 显示导入后的 rows / fields / coverage。
6. `Agent` tab 的按钮变成 `Run one agent step`，可以点击。
7. `Current context` 中出现真实的 imported widget ref。

### 14.5 当前已完成的真实页面验证

这条人工链路已经在本地页面上做过一次完整验证，确认结果如下：

1. `load` 后不会自动切成 imported runtime，只会显示 preview。
2. `bind` 后会切成 imported runtime。
3. preview 阶段的 `InspectPanel`、`AgentPanel`、`WidgetLibraryPanel`、`DatasetPanel`、`ControlsPanel` 都已经正确门控。
4. bind 成功 summary 会显示 `provider / kind / widgetRef / workspaceRef / actions / perceptions`。
5. bind 后 agent 按钮会从禁用态切成可运行态。

## 15. 自动化测试

当前这条链路已经有针对性测试覆盖：

- [visualizationLoadHostFlow.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/app/visualizationLoadHostFlow.test.js)
- [importedArtifactLoader.test.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/src/appRuntime/imports/importedArtifactLoader.test.js)

本地验证命令：

```bash
cd /Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system
node --test src/app/visualizationLoadHostFlow.test.js src/appRuntime/imports/importedArtifactLoader.test.js
```

当前结果：

- 19 tests
- 19 pass
- 0 fail

另外，store 层相关回归也已经补测：

```bash
cd /Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system
node --test src/app/appStore.test.js
```

当前结果：

- 13 tests
- 13 pass
- 0 fail

## 16. 下一步开发原则

后续继续往下做时，要保持这几个原则不变：

1. 不污染外部暴露接口。
2. 不在 `load` 阶段隐式创建 runtime workspace。
3. 不在 UI 上暴露过多内部中间对象。
4. 所有 agent 分析都建立在“用户已经明确 bind”这个前提上。
5. 对用户解释时，始终用“步骤流”而不是“内部状态机”。
