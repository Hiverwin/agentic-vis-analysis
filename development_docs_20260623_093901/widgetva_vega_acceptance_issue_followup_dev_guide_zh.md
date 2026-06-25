# WidgetVA Vega 验收失败后继续开发文档

本文档面向这样的场景：

- 合作者已经按照验收文档跑通了官方 Vega-Lite 页面接入流程
- 但在某个页面或某个 action 上发现了问题
- 需要继续开发、修复或补齐能力

这不是一份“重新介绍 WidgetVA”的文档，而是一份“出了问题后怎么继续往下做”的操作手册。

相关验收文档：

- [widgetva_interaction_acceptance_checklist_zh.md](/Users/chenyutong/Desktop/agentic-visual-reframe/development_docs_20260623_093901/widgetva_interaction_acceptance_checklist_zh.md:1)
- [official_vega_example_integration_usage.md](/Users/chenyutong/Desktop/agentic-visual-reframe/development_docs_20260623_093901/official_vega_example_integration_usage.md:1)

## 1. 先判断问题属于哪一层

遇到 Vega 验收失败时，不要先改 spec，不要先改 action，也不要先猜是 agent 的问题。先把问题归类。

### 1.1 页面接入层问题

典型表现：

- `window.__widgetVA === undefined`
- 扩展没有挂上
- `window.__widgetVAOfficialPageBootstrap` 状态不对
- 刷新页面后偶发成功、偶发失败

优先看：

- [apps/widgetva-system/extension/src/page/vegaExamplesPageScript.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/extension/src/page/vegaExamplesPageScript.js:1)
- `vegaExamplesBootstrap.js`
- `vegaExamplesEarlyCaptureContentScript.js`
- `vegaExamplesContentScript.js`

### 1.2 Vega embed capture / official page capture 问题

典型表现：

- `window.__widgetVA` 存在，但 workspace 为空
- 抓到的不是页面真正那张图
- action 执行后结果结构没问题，但图没变

优先看：

- `widgetva-kit/page-integrations` 下的 Vega official page integration
- [development_docs_20260623_093901/official_vega_example_integration_usage.md](/Users/chenyutong/Desktop/agentic-visual-reframe/development_docs_20260623_093901/official_vega_example_integration_usage.md:1)

### 1.3 widget family action 语义问题

典型表现：

- `bar.selectCategory` 返回 `ok === false`
- `scatter.zoomDomain` 返回成功但视图变化不符合预期
- `line.selectSeries` 结构化 action 可以发出去，但落到 runtime 的结果不稳定

优先看：

- `widgetva-kit/src/adapters/widgetFamilies/`
- `widgetva-kit/src/adapters/widgets/`
- `widgetva-kit/src/adapters/widgets/shared/`

### 1.4 verify / readback 问题

典型表现：

- 图已经变了，但 `executeVerifiedAction(...)` 还是报失败
- 读出来的 state 和视觉结果不一致
- `describeWorkspace()` 正常，但 `readView()` / 验证结果异常

优先看：

- `widgetva-kit/src/core/runtime/`
- `widgetva-kit/src/adapters/runtimeProviderWidgetAdapter.js`
- 各 family action descriptor 中的 verification hints

## 2. 建议的开发流程

### Step 1：固定一个失败样例，不要一上来做“通用修复”

先记录：

- 页面 URL
- 失败的 action 名称
- 实际看到的错误现象
- 期望的视觉结果

最低记录格式建议：

```text
page: https://vega.github.io/vega-lite/examples/point_2d.html
action: scatter.zoomDomain
observed: ok=true, but chart only changed opacity and did not zoom into local domain
expected: axes should move into the requested local domain
```

### Step 2：先复现验收路径，不要跳过 checklist

直接按下面顺序重跑：

1. 构建 extension
2. 刷新 `chrome://extensions`
3. 强刷目标 Vega 页面
4. 在 Console 里检查：

```js
window.__widgetVA
window.__widgetVAOfficialPageBootstrap
await window.__widgetVA.describeWorkspace()
await window.__widgetVA.describePagePort()
```

如果这一步都不稳定，不要继续看 action 层。

### Step 3：确认是“挂载到了正确视图”还是“挂到了错误视图”

如果页面本身有多个可视对象，先确认 WidgetVA 绑定的是哪一个。

建议读：

```js
await window.__widgetVA.describeWorkspace()
await window.__widgetVA.readView()
```

如果 workspace 中只有一个 widget，但你肉眼看到页面上不止一个可操作图，就要优先怀疑 capture 层。

### Step 4：把问题收敛到单个 family / primitive

不要写“Vega page support broken”这种过大的结论。

应该把问题写成下面这种粒度：

- `scatter.zoomDomain` 在官方 scatter 页面上只更新了 selection，没有更新 viewport
- `bar.filterCategories` 在官方 bar 页面上改变了数据可见性，但 verify 仍认为失败
- `line.selectSeries` 在官方 line 页面上选中值字段推断错了

### Step 5：先补测试，再补实现

优先补对应的集成测试或 family test，不要直接改大块逻辑。

优先找这些测试入口：

- `widgetva-kit/src/integrations/officialPages/*.test.js`
- `widgetva-kit/src/adapters/installWidgetView.test.js`
- `widgetva-kit/src/adapters/providerRuntimeWidgetAdapters.test.js`

如果是 official Vega page 问题，优先加到 official page integration test。
如果是 family action 语义问题，优先加到 widget family / runtime adapter test。

## 3. Vega 路线最常见的四类问题

### 3.1 页面没有挂上 WidgetVA

检查：

- extension 是否重新 build
- `manifest.json` 是否覆盖到目标 URL
- content script 和 page script 是否都成功注入

关键入口：

- [apps/widgetva-system/extension/public/manifest.json](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/extension/public/manifest.json:1)
- [apps/widgetva-system/package.json](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/package.json:1)

### 3.2 action 结构对了，但图没有按语义变化

这通常不是 agent 问题，而是 adapter materialization 问题。

重点检查：

- action 是否正确写入 widget state
- widget state 是否正确映射到 Vega-Lite signal / spec rematerialization
- verify 是否读的是 canonical state，而不是旧 signal

### 3.3 图视觉上对了，但 verify 不通过

这通常说明：

- “应用 state”的部分已经工作
- “读回 state / 读回验证证据”的部分还不完整

不要为了让 verify 通过而去弱化验收标准。
正确做法是补 readback，或者把 verification effect 写清楚。

### 3.4 同一个 family 在不同页面上行为不一致

例如：

- 一个 bar 页面能 `selectCategory`
- 另一个 bar 页面不能

这通常说明：

- 你的 family 抽象假设过强
- 某些字段推断逻辑依赖了具体页面

优先看字段推断，不要一开始就给这个页面加硬编码。

## 4. 推荐修改顺序

如果你准备真正改代码，推荐顺序如下：

1. 先补失败用例测试
2. 再改最靠近问题源头的一层
3. 不要跨层同时大改
4. 改完后只回归相关验收项
5. 最后再跑一轮完整 Vega checklist

不推荐的做法：

- 同时改 page capture、family action、verify 逻辑
- 为了让一个页面过验收，写页面特判覆盖 family 语义
- 在还没定位问题层级前就改 agent prompt 或 plan

## 5. 开发时重点参考的文件

页面接入：

- [apps/widgetva-system/extension/src/page/vegaExamplesPageScript.js](/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/extension/src/page/vegaExamplesPageScript.js:1)

官方页面集成说明：

- [development_docs_20260623_093901/official_vega_example_integration_usage.md](/Users/chenyutong/Desktop/agentic-visual-reframe/development_docs_20260623_093901/official_vega_example_integration_usage.md:1)

family adapter 入口：

- [widgetva-kit/src/adapters/widgetFamilies/index.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/widgetFamilies/index.js:1)

provider runtime 行为：

- [widgetva-kit/src/adapters/providerFamilyBehavior.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/providerFamilyBehavior.js:1)
- [widgetva-kit/src/adapters/runtimeProviderWidgetAdapter.js](/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/adapters/runtimeProviderWidgetAdapter.js:1)

primitive 规范：

- [widgetva_single_widget_selection_primitive_spec.md](/Users/chenyutong/Desktop/agentic-visual-reframe/development_docs_20260623_093901/widgetva_single_widget_selection_primitive_spec.md:1)
- [widgetva_single_widget_filter_primitive_spec.md](/Users/chenyutong/Desktop/agentic-visual-reframe/development_docs_20260623_093901/widgetva_single_widget_filter_primitive_spec.md:1)
- [widgetva_single_widget_zoom_primitive_spec.md](/Users/chenyutong/Desktop/agentic-visual-reframe/development_docs_20260623_093901/widgetva_single_widget_zoom_primitive_spec.md:1)
- [widgetva_single_widget_sort_primitive_spec.md](/Users/chenyutong/Desktop/agentic-visual-reframe/development_docs_20260623_093901/widgetva_single_widget_sort_primitive_spec.md:1)

## 6. 每次修复后的最小回归

每次修完，至少回归下面几项：

```js
window.__widgetVA
await window.__widgetVA.describeWorkspace()
await window.__widgetVA.describePagePort()
```

然后只重测你改到的 action：

- bar 问题就回归 `bar.selectCategory` / `bar.filterCategories` / `bar.sortBars`
- scatter 问题就回归 `scatter.brushRegion` / `scatter.zoomDomain`
- line 问题就回归 `line.selectSeries` / `line.selectXValue`

最后再跑一遍完整的 Vega 验收清单。

## 7. 一个重要边界

如果验收失败是因为“这个 primitive 本来还没在 Vega 路线上真正实现”，那不要把它包装成 bug。

应该明确标成：

- 未实现
- 部分实现
- 已实现但不稳定

这三种状态一定要分开写，不然后面 D3 / ECharts 对齐时会很混乱。
