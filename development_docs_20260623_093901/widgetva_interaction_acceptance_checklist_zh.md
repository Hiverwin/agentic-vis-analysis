# 验收前准备

本文档默认协作者已经具备以下环境：
- Git
- Node.js 20+
- npm
- Chrome

下面统一使用一个本地工作目录变量：

```bash
export WIDGETVA_ROOT=/path/to/agentic-visual-reframe
```

例如：

```bash
export WIDGETVA_ROOT=~/workspace/agentic-visual-reframe
```

# 拉取仓库

如果协作者需要完整拉取整个仓库，可执行：

```bash
git clone <你的仓库地址> "$WIDGETVA_ROOT"
```

如果协作者只需要本次 widget abstraction 验收所需内容，建议使用 sparse checkout，仅拉取验收相关目录：

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

说明：
- `apps/widgetva-system`：Chrome extension 与验收运行入口
- `widgetva-kit`：widget abstraction / integration 核心实现
- `development_docs_20260623_093901`：验收文档与开发文档

# 初始执行步骤

```bash
cd "$WIDGETVA_ROOT/apps/widgetva-system"
```

```bash
npm install
```

```bash
npm run build:extension
```

1. 打开 `chrome://extensions`
2. 打开 `开发者模式`
3. 首次加载时点击 `加载已解压的扩展程序`，选择：

```text
$WIDGETVA_ROOT/apps/widgetva-system/extension/dist
```

4. 后续代码更新后点击扩展卡片上的刷新按钮
5. 打开下面任一官网页面后执行一次强刷：`Cmd + Shift + R`
6. 打开页面 `DevTools -> Console`
7. 先执行：

```js
window.__widgetVA
```

验收标准：
- 返回不是 `undefined`



# `bar.selectCategory`

官网链接：  
[https://vega.github.io/vega-lite/examples/bar.html](https://vega.github.io/vega-lite/examples/bar.html)

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_bar_select_1',
  name: 'bar.selectCategory',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    field: 'a',
    values: ['A', 'B'],
  },
})
```

验收标准：
- 返回结果里 `ok === true`
- `A`、`B` 两个 bar 明显保留
- 其他 bar 明显变淡

# `bar.filterCategories`

官网链接：  
[https://vega.github.io/vega-lite/examples/bar.html](https://vega.github.io/vega-lite/examples/bar.html)

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_bar_filter_1',
  name: 'bar.filterCategories',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    field: 'a',
    categories: ['A', 'B', 'C'],
  },
})
```

验收标准：
- 返回结果里 `ok === true`
- 页面上只剩 `A`、`B`、`C` 三个 bar
- 其他 bar 不再显示

# `bar.sortBars`

官网链接：  
[https://vega.github.io/vega-lite/examples/bar.html](https://vega.github.io/vega-lite/examples/bar.html)

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_bar_sort_1',
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
- 是排序变化，不是 bar 数量减少

# `scatter.brushRegion`

官网链接：  
[https://vega.github.io/vega-lite/examples/point_2d.html](https://vega.github.io/vega-lite/examples/point_2d.html)

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_scatter_brush_1',
  name: 'scatter.brushRegion',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    xField: 'Horsepower',
    yField: 'Miles_per_Gallon',
    xRange: [60, 120],
    yRange: [20, 35],
  },
})
```

验收标准：
- 返回结果里 `ok === true`
- 选中区域内的点明显保留
- 区域外的点明显变淡

# `scatter.zoomDomain`

官网链接：  
[https://vega.github.io/vega-lite/examples/point_2d.html](https://vega.github.io/vega-lite/examples/point_2d.html)

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_scatter_zoom_1',
  name: 'scatter.zoomDomain',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    xDomain: [60, 160],
    yDomain: [10, 35],
  },
})
```

验收标准：
- 返回结果里 `ok === true`
- 散点图坐标域明显缩到局部
- 是视口进入局部，不是只变透明度

# `line.selectSeries`

官网链接：  
[https://vega.github.io/vega-lite/examples/line_color.html](https://vega.github.io/vega-lite/examples/line_color.html)

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref
const sample = await window.__widgetVA.queryData({
  query: {
    kind: 'sampleRows',
    spec: {
      queryScope: { widgetRef },
      limit: 20,
    },
  },
})
const rows = Array.isArray(sample?.result) ? sample.result : []
const exampleRow = rows.find((row) => row && typeof row === 'object')
const field = ['symbol', 'series', 'category', 'group'].find((key) => rows.some((row) => row?.[key] != null))
const value = field ? exampleRow?.[field] : null

if (!field || value == null) {
  throw new Error('当前 line 示例里没有找到可用于 selectSeries 的分组字段。')
}

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_line_select_series_1',
  name: 'line.selectSeries',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    field,
    values: [value],
  },
})
```

验收标准：
- 返回结果里 `ok === true`
- 选中的线明显保留
- 其他线明显变淡

# `line.selectXValue`

官网链接：  
[https://vega.github.io/vega-lite/examples/line.html](https://vega.github.io/vega-lite/examples/line.html)

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref
const sample = await window.__widgetVA.queryData({
  query: {
    kind: 'sampleRows',
    spec: {
      queryScope: { widgetRef },
      limit: 20,
    },
  },
})
const rows = Array.isArray(sample?.result) ? sample.result : []
const field = ['date', 'x', 'year', 'month'].find((key) => rows.some((row) => row?.[key] != null))
const value = field ? rows.find((row) => row?.[field] != null)?.[field] : null

if (!field || value == null) {
  throw new Error('当前 line 示例里没有找到可用于 selectXValue 的 x 字段。')
}

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_line_select_x_1',
  name: 'line.selectXValue',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    field,
    value,
  },
})
```

验收标准：
- 返回结果里 `ok === true`
- 被选中的 x 位置对应数据明显保留
- 其他位置对应数据明显变淡

# `heatmap.selectCell`

官网链接：  
[https://vega.github.io/vega-lite/examples/rect_heatmap.html](https://vega.github.io/vega-lite/examples/rect_heatmap.html)

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref
const sample = await window.__widgetVA.queryData({
  query: {
    kind: 'sampleRows',
    spec: {
      queryScope: { widgetRef },
      limit: 20,
    },
  },
})
const rows = Array.isArray(sample?.result) ? sample.result : []
const exampleRow = rows.find((row) => row && typeof row === 'object')
const xField = ['x', 'variety', 'category', 'column'].find((key) => rows.some((row) => row?.[key] != null))
const yField = ['y', 'year', 'row'].find((key) => rows.some((row) => row?.[key] != null))
const xValue = xField ? exampleRow?.[xField] : null
const yValue = yField ? exampleRow?.[yField] : null

if (!xField || !yField || xValue == null || yValue == null) {
  throw new Error('当前 heatmap 示例里没有找到可用于 selectCell 的 x/y 字段。')
}

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_heatmap_cell_1',
  name: 'heatmap.selectCell',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    xField,
    yField,
    xValue,
    yValue,
  },
})
```

验收标准：
- 返回结果里 `ok === true`
- 目标 cell 明显保留
- 其他 cell 明显变淡

# `heatmap.selectSubmatrix`

官网链接：  
[https://vega.github.io/vega-lite/examples/rect_heatmap.html](https://vega.github.io/vega-lite/examples/rect_heatmap.html)

```js
const workspace = await window.__widgetVA.describeWorkspace()
const widgetRef = workspace.widgets[0].ref
const sample = await window.__widgetVA.queryData({
  query: {
    kind: 'sampleRows',
    spec: {
      queryScope: { widgetRef },
      limit: 50,
    },
  },
})
const rows = Array.isArray(sample?.result) ? sample.result : []
const xField = ['x', 'variety', 'category', 'column'].find((key) => rows.some((row) => row?.[key] != null))
const yField = ['y', 'year', 'row'].find((key) => rows.some((row) => row?.[key] != null))
const xValues = xField ? [...new Set(rows.map((row) => row?.[xField]).filter((value) => value != null))].slice(0, 2) : []
const yValues = yField ? [...new Set(rows.map((row) => row?.[yField]).filter((value) => value != null))].slice(0, 1) : []

if (!xField || !yField || xValues.length === 0 || yValues.length === 0) {
  throw new Error('当前 heatmap 示例里没有找到可用于 selectSubmatrix 的 x/y 字段。')
}

await window.__widgetVA.executeVerifiedAction({
  callId: 'accept_heatmap_submatrix_1',
  name: 'heatmap.selectSubmatrix',
  actor: 'agent',
  queryScope: { widgetRef },
  params: {
    xValues,
    yValues,
  },
})
```

验收标准：
- 返回结果里 `ok === true`
- 指定子矩阵区域明显保留
- 其他 cell 明显变淡
