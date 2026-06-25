# WidgetVA Observable D3 验收与继续开发文档

本文档面向两个目标：

- 合作者按照统一步骤验收当前 Observable D3 接入
- 合作者在发现 D3 路线问题后，知道下一步应该如何继续开发

## 1. 先说清楚：当前 D3 到底支持到什么程度

如果这里不先说清楚，后面的验收很容易误判。

### 1.1 当前在 Observable 官方 D3 页面上正式能验收的 primitive

当前已经可以作为正式验收项的 primitive 有：

- `scatter.brushRegion`
- `scatter.zoomDomain`
- `scatter.identifyClusters`
- `scatter.showRegression`
- `bar.selectCategory`
- `bar.filterCategories`
- `bar.sortBars`
- `line.selectSeries`
- `line.selectXValue`
- `line.zoomXRegion`
- `line.focusLines`
- `line.highlightTrend`
- `line.showMovingAverage`
- `line.drillDownXAxis`
- `line.resetDrilldownXAxis`

调试/辅助入口：

- `window.__widgetVAObservableD3Debug`
- `window.__widgetVAObservableD3Probe`
- `window.__widgetVAObservableD3PreviewBrush`

也就是说，当前 Observable 官方 D3 页面这条路线，真正已经打通并且可以作为正式验收项写进文档的，是：

- 页面挂载
- 页面切换后重挂载
- scatter / bar / line surface 识别
- probe
- scatter interval selection / zoom
- scatter cluster annotate / regression annotate
- bar selection / filter / sort
- line series selection / x-slice selection
- line x-region zoom
- line focus / trend / moving-average annotate
- line drilldown / reset drilldown

### 1.2 什么东西“不是完全没有”，但还不能当正式已支持能力

D3 adapter 抽象层里已经预留或支持了一些 host hooks，例如：

- `setSelection(...)`
- `setBrush(...)`
- `setViewport(...)`
- `setDomain(...)`
- `setHighlights(...)`
- `setSort(...)`

但这不等于“Observable 官方 D3 页面上已经把这些能力都真正落地了”。

当前要严格区分两层：

1. 抽象层 / adapter contract 层
2. 官方 Observable notebook 页面接入层

现在真正薄弱的是第 2 层，不是说所有 D3 相关抽象都不存在。

## 2. 当前 D3 路线的真实状态

当前已经打通：

- Observable 官方 D3 notebook 页面识别
- worker iframe 查找
- 页面切换后的重新 bootstrap
- scatter surface 识别
- bar surface 识别
- line surface 识别
- scatter rows 读取
- bar rows 读取
- line rows 读取
- probe 覆盖
- scatter selection / brush 的可见反馈
- scatter viewport zoom 的可见反馈
- scatter cluster annotate / regression annotate 的可见反馈
- bar selection / filter / sort 的可见反馈
- line selection 的可见反馈
- line viewport zoom 的可见反馈
- line focus / annotate / drilldown 的可见反馈
- `WidgetInstance` 挂载到 D3 scatter page

当前还没有通用打通：

- 更高一层的复合语义能力
  - focus 之后自动比较和总结
  - annotate 之后自动验证和推理
  - drilldown 后多轮继续分析
- 多 widget / linked D3 official page 协同

所以这份文档会把“当前能验收什么”和“下一步该怎么扩展什么”明确分开。

## 3. 从零开始的操作步骤

这一节就是给协作者直接照做的，不放无关信息。

### 3.1 拉取仓库

先在本地选择一个工作目录：

```bash
export WIDGETVA_ROOT=~/workspace/agentic-visual-reframe
```

完整拉取仓库：

```bash
git clone <你的仓库地址> "$WIDGETVA_ROOT"
```

如果只拉验收所需内容，可以用 sparse checkout：

```bash
git clone --filter=blob:none --no-checkout <你的仓库地址> "$WIDGETVA_ROOT"
cd "$WIDGETVA_ROOT"
git sparse-checkout init --cone
git sparse-checkout set \
  apps/widgetva-system \
  widgetva-kit \
  development_docs_20260623_093901 \
  README.md \
  .gitignore
git checkout
```

### 3.2 安装依赖

```bash
cd "$WIDGETVA_ROOT/apps/widgetva-system"
npm install
```

### 3.3 构建 Chrome extension

```bash
cd "$WIDGETVA_ROOT/apps/widgetva-system"
npm run build:extension
```

### 3.4 在 Chrome 里加载 extension

1. 打开 `chrome://extensions`
2. 打开右上角 `开发者模式`
3. 点击 `加载已解压的扩展程序`
4. 选择下面这个目录：

```text
$WIDGETVA_ROOT/apps/widgetva-system/extension/dist
```

如果后续你改了代码并重新 build：

1. 回到 `chrome://extensions`
2. 找到这个扩展
3. 点击刷新按钮

### 3.5 打开验收页面

先打开任一验收页面：

- [https://observablehq.com/@d3/scatterplot](https://observablehq.com/@d3/scatterplot)
- [https://observablehq.com/@d3/bar-chart/2](https://observablehq.com/@d3/bar-chart/2)
- [https://observablehq.com/@d3/index-chart/2](https://observablehq.com/@d3/index-chart/2)

然后执行一次强刷：

- `Cmd + Shift + R`

### 3.6 打开浏览器控制台

在页面中打开：

- `DevTools -> Console`

后面的验收步骤都在这里执行。

### 3.7 先确认扩展已经挂上

先执行：

```js
window.__widgetVA
window.__widgetVAOfficialPageBootstrap
```

只有在这一步已经正常返回后，才继续下面的结构验收和 primitive 验收。

## 4. 相关代码入口

页面识别与 worker 查找：

- [widgetva-kit/src/integrations/officialPages/observableD3Pages.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/integrations/officialPages/observableD3Pages.js:1)

surface / plot region / rows 读取：

- [widgetva-kit/src/integrations/officialPages/observableD3Surface.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/integrations/officialPages/observableD3Surface.js:1)

official page scatter 接入：

- [widgetva-kit/src/integrations/officialPages/observableD3Examples.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/integrations/officialPages/observableD3Examples.js:1)

worker 内容脚本：

- [apps/widgetva-system/extension/src/content/observableD3WorkerContentScript.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/extension/src/content/observableD3WorkerContentScript.js:1)

页面 bootstrap / route watcher：

- [apps/widgetva-system/extension/src/page/observableD3Bootstrap.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/extension/src/page/observableD3Bootstrap.js:1)
- [apps/widgetva-system/extension/src/page/observableD3PageScript.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/extension/src/page/observableD3PageScript.js:1)

provider adapter 层：

- [widgetva-kit/src/adapters/D3WidgetAdapter.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/D3WidgetAdapter.js:1)
- [widgetva-kit/src/adapters/providerFamilyBehavior.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/providerFamilyBehavior.js:1)
- [widgetva-kit/src/adapters/widgetFamilies/index.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/widgetFamilies/index.js:1)

## 5. D3 页面级验收

### 4.1 基础挂载验收

适用页面：

- [https://observablehq.com/@d3/scatterplot](https://observablehq.com/@d3/scatterplot)
- [https://observablehq.com/@d3/bar-chart/2](https://observablehq.com/@d3/bar-chart/2)
- [https://observablehq.com/@d3/index-chart/2](https://observablehq.com/@d3/index-chart/2)

在页面 `DevTools -> Console` 执行：

```js
window.__widgetVA
window.__widgetVAOfficialPageBootstrap
```

验收标准：

- `window.__widgetVA` 不是 `undefined`
- `window.__widgetVAOfficialPageBootstrap.observableD3.status === "ready"`

然后继续执行：

```js
await window.__widgetVA.describeWorkspace()
await window.__widgetVA.describePagePort()
```

验收标准：

- workspace 中有一个 widget
- page port 可正常返回 provider / page 级描述

### 4.2 跨页面 bootstrap / route 切换验收

这部分不是检查某个 primitive，而是检查 Observable notebook 导航变化后 WidgetVA 是否能重新挂载。

先在 `scatterplot` 页执行：

```js
window.__widgetVAOfficialPageBootstrap.observableD3
```

记录：

- `pageUrl`
- `status`
- `workerFrame`

然后从 Observable 页面内部切换到另一个 `@d3/...` notebook，再切回：

- 例如从 `scatterplot` 切到其他 notebook
- 再切回 `scatterplot`

切回后再次执行：

```js
window.__widgetVA
window.__widgetVAOfficialPageBootstrap.observableD3
await window.__widgetVA.describeWorkspace()
```

验收标准：

- 切页后不会永久丢失 `window.__widgetVA`
- bootstrap state 会更新到新 URL
- 回到 `scatterplot` 后能重新进入 `ready`
- workspace 可重新读出 widget

如果切页后 `status === "error"`，优先排查：

- `observableD3PageScript.js`
- `observableD3Bootstrap.js`

## 6. D3 结构确认验收

在任一 D3 验收页面执行：

```js
await window.__widgetVAObservableD3Debug?.()
```

重点查看：

- `route`
- `surface.surfaceTag`
- `surface.inferredKind`
- `surface.plotRegion.source`
- `surfaceRect.width`
- `surfaceRect.height`
- `markCount`
- `rowSummary.count`

验收标准：

- `route === "worker"`
- `surface.inferredKind` 与当前页面类型一致
- 对 scatter 页面：`rowSummary.count > 0`
- 对 bar 页面：`barRows.length > 0`
- 对 line 页面：`lineRows.length > 0`

然后执行：

```js
await window.__widgetVAObservableD3Probe?.()
```

验收标准：

- 页面上出现红色虚线大边框
- 左上角出现 `WidgetVA Probe`
- 红框尽量准确覆盖当前用户看到的散点图 plot region

这一步不过，不要继续验收 primitive。

## 7. 当前已支持的 D3 primitive 验收

### 6.1 `scatter.brushRegion`

当前 Observable D3 official page 路线上，真正已经打通的 primitive 是 scatter 的 interval selection。

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_scatter_brush_1',
  name: 'scatter.brushRegion',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    xField: '__screenX',
    yField: '__screenY',
    xRange: [80, 260],
    yRange: [80, 220],
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 页面上出现明显的 brush 矩形
- brush 区域内的点明显高亮
- brush 区域外的点明显变淡

### 6.2 preview brush 辅助验收

执行：

```js
await window.__widgetVAObservableD3PreviewBrush?.()
```

验收标准：

- 返回结果里 `ok === true`
- 会自动给出一个位于当前点云中部的 interval selection
- 页面上能看到和 `scatter.brushRegion` 类似的视觉反馈

这一步的意义是：

- 它不依赖人工手写具体坐标
- 可以快速判断“selection materialization 这一层是否还活着”

### 6.3 `scatter.zoomDomain`

页面：

- [https://observablehq.com/@d3/scatterplot](https://observablehq.com/@d3/scatterplot)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_scatter_zoom_1',
  name: 'scatter.zoomDomain',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    xDomain: [80, 220],
    yDomain: [80, 220],
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 散点图明显进入局部区域
- 是视口变化，不是只改变透明度

### 6.4 `bar.selectCategory`

页面：

- [https://observablehq.com/@d3/bar-chart/2](https://observablehq.com/@d3/bar-chart/2)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_bar_select_1',
  name: 'bar.selectCategory',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    field: 'category',
    values: ['A'],
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 选中的 bar 明显保留
- 其他 bar 明显变淡

### 6.5 `bar.filterCategories`

页面：

- [https://observablehq.com/@d3/bar-chart/2](https://observablehq.com/@d3/bar-chart/2)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_bar_filter_1',
  name: 'bar.filterCategories',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    field: 'category',
    categories: ['A', 'C'],
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 页面上只保留请求的 bar
- 其他 bar 不再显示

### 6.6 `bar.sortBars`

页面：

- [https://observablehq.com/@d3/bar-chart/2](https://observablehq.com/@d3/bar-chart/2)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_bar_sort_1',
  name: 'bar.sortBars',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    channel: 'x',
    order: 'descending',
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- bar 顺序发生明显变化
- 是重排，不是过滤

### 6.7 `line.selectSeries`

页面：

- [https://observablehq.com/@d3/index-chart/2](https://observablehq.com/@d3/index-chart/2)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_line_series_1',
  name: 'line.selectSeries',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    field: 'series',
    values: ['A'],
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 选中的 line series 明显保留
- 其他 line series 明显变淡

### 6.8 `line.selectXValue`

页面：

- [https://observablehq.com/@d3/index-chart/2](https://observablehq.com/@d3/index-chart/2)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_line_xvalue_1',
  name: 'line.selectXValue',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    value: '2000',
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 该 x-value 对应的纵向 slice 有明显标记
- 这是 x-slice 选择，不是 series 选择

### 6.9 `scatter.identifyClusters`

页面：

- [https://observablehq.com/@d3/scatterplot](https://observablehq.com/@d3/scatterplot)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_scatter_cluster_1',
  name: 'scatter.identifyClusters',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    nClusters: 3,
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 散点被重新着色为多个 cluster
- 这是 annotate/重着色，不是 selection

### 6.10 `scatter.showRegression`

页面：

- [https://observablehq.com/@d3/scatterplot](https://observablehq.com/@d3/scatterplot)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_scatter_regression_1',
  name: 'scatter.showRegression',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    method: 'linear',
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 散点图上出现明显的回归辅助线
- 回归线是 overlay，不会替代原始点云

### 6.11 `line.zoomXRegion`

页面：

- [https://observablehq.com/@d3/index-chart/2](https://observablehq.com/@d3/index-chart/2)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_line_zoom_1',
  name: 'line.zoomXRegion',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    start: '2000',
    end: '2005',
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- line 图横轴明显缩放到局部 x 区间
- 这是 view/viewport 变化，不是 line 透明度变化

### 6.12 `line.focusLines`

页面：

- [https://observablehq.com/@d3/index-chart/2](https://observablehq.com/@d3/index-chart/2)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_line_focus_1',
  name: 'line.focusLines',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    lines: ['Apple'],
    lineField: 'series',
    dimOpacity: 0.08,
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 目标线条明显保留/加重
- 非目标线条明显变淡

### 6.13 `line.highlightTrend`

页面：

- [https://observablehq.com/@d3/index-chart/2](https://observablehq.com/@d3/index-chart/2)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_line_trend_1',
  name: 'line.highlightTrend',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    trendType: 'increasing',
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 图上出现额外的趋势辅助线
- 原始 line 仍然保留

### 6.14 `line.showMovingAverage`

页面：

- [https://observablehq.com/@d3/index-chart/2](https://observablehq.com/@d3/index-chart/2)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_line_ma_1',
  name: 'line.showMovingAverage',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    windowSize: 3,
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 图上出现额外的平滑辅助线
- 该辅助线和原始 line 有明显视觉区分

### 6.15 `line.drillDownXAxis`

页面：

- [https://observablehq.com/@d3/index-chart/2](https://observablehq.com/@d3/index-chart/2)

执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_line_drill_1',
  name: 'line.drillDownXAxis',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    level: 'year',
    value: 2000,
  },
})
```

验收标准：

- 返回结果里 `ok === true`
- 页面出现 drilldown 提示反馈
- line 图进入更细粒度的 x 轴分析状态

### 6.16 `line.resetDrilldownXAxis`

建议在执行过 `line.drillDownXAxis` 后立即执行：

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_observable_line_reset_drill_1',
  name: 'line.resetDrilldownXAxis',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {},
})
```

验收标准：

- 返回结果里 `ok === true`
- drilldown 提示反馈消失
- 图回到 drilldown 前的状态

## 8. 当前尚未作为正式验收项的 D3 primitive

下面这些能力在 WidgetVA 抽象层里是自然下一步，但当前还没有作为这份 official-page 验收文档中的正式项：

- 更复杂的 aggregate / resample 类 primitive
- 多步组合 primitive
- 多 widget 联动 primitive

原因不是这些 primitive 在抽象层不存在，而是当前 official Observable D3 page 接入还没有把更高层的复合行为全部 materialize 成稳定网页行为。

所以如果这些 action 现在在 D3 official page 上失败，不应直接记成 regression，更合理的标注是：

- 未实现
- 部分实现
- 尚未接入该 notebook family

## 9. D3 开发时如何新增一个 notebook 页面支持

### Step 1：先选一个具体页面

不要写“支持 D3 line”这种过大任务。
应该先选一个明确 URL，例如：

- `https://observablehq.com/@d3/index-chart/2`

### Step 2：先确认外层宿主结构还成立

先验证：

- 还是 Observable notebook 页面
- 还是通过 worker iframe 承载图
- route watcher 是否能感知 URL 变化

这一层如果变了，先修 page / worker 发现逻辑，不要急着写 line 或 bar 内部规则。

### Step 3：先做 surface / marks / plot region 识别

新增 notebook family 时，第一目标不是“马上支持 action”，而是先做到：

- `describeSurface`
- `renderDebugProbe`

也就是先让系统回答：

- 当前真正图在哪
- 边界框是什么
- 这是不是你想操作的那张图

### Step 4：再补 rows / series / categories 读取

不同 family 需要的读取对象不同：

- scatter：point rows
- line：series / points / x-value groups
- bar：category bars / rect marks

不要把 scatter 的 `point mark` 读取逻辑直接复用到 line。

### Step 5：最后再补 primitive materialization

按 family 逐个补：

- 先有 `setSelection`
- 再有 `setViewport`
- 再有更复杂的 `setSort` / `setReencode` / `setHighlightState`

这一步主要通过 D3 adapter 的 host hooks 落地：

- `setBrush(...)`
- `setSelection(...)`
- `setViewport(...)` / `setDomain(...)`
- `setHighlights(...)`
- `setSort(...)`

对应代码：

- [widgetva-kit/src/adapters/providerFamilyBehavior.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/providerFamilyBehavior.js:146)

## 10. D3 开发时如何判断问题在哪一层

### 9.1 连 `window.__widgetVA` 都没有

看 page bootstrap / extension 注入层。

### 9.2 `window.__widgetVA` 有，但 `surface.inferredKind` 不对

看 surface recognition 层。

### 9.3 `surface.inferredKind` 对，但 rows / series 读不出来

看 data extraction 层。

### 9.4 rows / series 能读出来，但 action 没视觉反馈

看 worker-side materialization 或 D3 adapter host hook。

### 9.5 图已经变了，但 `ok !== true`

看 verify / readback 层。

## 11. 建议的测试补法

如果你在 D3 路线上继续开发，优先补这些测试：

- `observableD3Surface.test.js`
- `observableD3Examples.test.js`
- `observableD3Pages.test.js`
- `providerRuntimeWidgetAdapters.test.js`

推荐顺序：

1. 先补 page / surface 识别测试
2. 再补 worker RPC 测试
3. 再补 primitive materialization 测试

不推荐：

- 直接在真实页面上手改到“看起来差不多”
- 没有测试就同时改 page script、worker script、adapter

## 12. 当前对协作者最重要的一条预期管理

如果协作者在 D3 页面上发现：

- scatter 能跑
- line / bar 不能跑

这在当前阶段是合理现象，不代表整体设计有问题。

当前真正该验收的是：

- 页面识别是否稳定
- 跨页面 bootstrap 是否稳定
- scatter 结构识别是否稳定
- scatter selection primitive 是否稳定

在这些稳定以后，再扩 line / bar primitive，才是正确顺序。
