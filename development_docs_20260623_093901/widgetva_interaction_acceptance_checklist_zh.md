# 初始执行步骤

```bash
cd /Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system
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
/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/extension/dist
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

# Observable D3 结构确认方法

适用页面：  
[https://observablehq.com/@d3/scatterplot](https://observablehq.com/@d3/scatterplot)

先不要直接看 brush 是否成功，而是先确认 WidgetVA 当前抓到的是否就是用户眼前那张图。

在 `DevTools -> Console` 中执行：

```js
await window.__widgetVAObservableD3Debug?.()
```

需要重点查看：
- `route`
- `surface.surfaceTag`
- `surface.inferredKind`
- `surfaceRect.width`
- `surfaceRect.height`
- `markCount`
- `rowSummary.count`

然后执行：

```js
await window.__widgetVAObservableD3Probe?.()
```

验收标准：
- 页面上出现明显的红色虚线大边框
- 左上角出现 `WidgetVA Probe`
- 红框准确覆盖用户眼前那张散点图

只有在这一步通过后，才继续检查 brush / highlight / zoom 的视觉反馈。

这一步的原则是：
- 先确认“抓到的结构就是可见图层”
- 再确认“交互是否在这个图层上生效”

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
