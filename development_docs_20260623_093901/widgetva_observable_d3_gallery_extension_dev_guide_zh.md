# WidgetVA Observable D3 Gallery 扩展开发文档

本文档面向继续扩展 Observable D3 gallery 接入的合作者。
当前已经落成并跑通的是 `scatter` 这一条链路。
后续如果要继续支持 `line`、`bar` 等其他 D3 gallery 图，建议严格复用本文档中的查找路径和开发工作流，不要重新走“全页面盲猜图表”的路线。

---

## 1. 当前目标

当前这套实现的目标不是：

- 做一个通用的、一次性覆盖所有 D3 gallery 的黑盒识别器

当前这套实现的目标是：

- 在 Observable 官方 D3 notebook 页面中
- 先找到稳定宿主结构
- 再从宿主结构中定位当前真正的图表 surface
- 然后按 widget kind 分流做接入

已经验证通过的部分：

- Observable D3 `scatter` 页面可以挂载
- 页面切换后会重新 bootstrap
- worker iframe 路线已经打通
- probe 可以显示，并且边界不再直接依赖整块大 `svg`

---

## 2. 核心设计原则

### 2.1 先找宿主，再找图

不要直接在整个页面里：

- 找最大 `svg`
- 猜哪个是图
- 再从图形特征倒推

正确路径是：

1. 先确认这是 Observable D3 notebook 页面
2. 先找到当前页面真正运行图表的 worker iframe
3. 再在 worker iframe 内部找当前 chart surface
4. 再在 surface 内部找 marks / mark container / plot region

### 2.2 外层结构复用，内层按 widget kind 分流

Observable D3 gallery 的外层壳子通常类似：

- notebook page
- worker iframe
- output surface

但图表内部结构不一样：

- scatter：点 marks
- line：path / series
- bar：rect marks

因此后续扩展不能把 scatter 逻辑直接拿去兼容 line。
正确做法是：

- 共用外层宿主查找
- 在内部按 kind 分流

### 2.3 不盲猜，允许有兜底 fallback，但 fallback 必须层级清楚

当前 scatter 的内部查找层级是：

1. `surface`
2. `mark container`
3. `mark bounds`
4. 最后才退回整块 `surface`

这类 fallback 可以保留，但必须是结构化 fallback，不是随意 heuristics 叠加。

---

## 3. 相关代码入口

### 3.1 页面识别与 worker 查找

文件：

- `/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/integrations/officialPages/observableD3Pages.js`

职责：

- 判断是不是 Observable D3 notebook 页面
- 解析 notebook identity
- 查找 worker iframe
- 返回页面层面的 page shape

关键函数：

- `isObservableD3NotebookPage(pageUrl)`
- `parseObservableNotebookIdentity(pageUrl)`
- `findObservableWorkerFrame(root)`
- `waitForObservableWorkerFrame({ root, timeoutMs, pollMs })`
- `describeObservableD3PageShape(root)`

### 3.2 图表 surface / plot region 查找

文件：

- `/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/integrations/officialPages/observableD3Surface.js`

职责：

- 在 worker 内部定位当前 chart surface
- 读取 scatter marks
- 定位真实 plot region
- 输出 surface 描述

关键函数：

- `findPrimaryObservableD3Surface(root)`
- `findObservableD3PointMarks(root)`
- `findObservableD3MarkContainer(root)`
- `findObservableD3PlotRegion(root)`
- `readObservableD3ScatterRows(root)`
- `describeObservableD3Surface(root, { notebook })`

### 3.3 scatter 官方页接入

文件：

- `/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/integrations/officialPages/observableD3Examples.js`

职责：

- 等待 Observable D3 scatter surface ready
- 建立 WidgetVA widget instance
- 提供 debug / probe / preview brush

关键函数：

- `attachWidgetVAToObservableD3ScatterPage(...)`
- `bootstrapObservableD3ScatterPage(...)`
- `createObservableScatterSurfaceWrapper(...)`

### 3.4 worker 内容脚本

文件：

- `/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/extension/src/content/observableD3WorkerContentScript.js`

职责：

- 在 worker 内处理 page script 发来的 RPC
- 返回 surface 描述
- 返回 scatter rows
- 应用 scatter selection
- 返回 debug snapshot
- 渲染 probe

当前已支持的方法：

- `describeSurface`
- `readScatterRows`
- `applyScatterSelection`
- `readDebugSnapshot`
- `renderDebugProbe`

### 3.5 页面 bootstrap 与切页重挂

文件：

- `/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/extension/src/page/observableD3Bootstrap.js`
- `/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/extension/src/page/observableD3PageScript.js`

职责：

- 页面初次加载时 bootstrap
- URL 变化时 dispose 旧 controller 并重新 bootstrap
- 把 debug / probe / preview 入口挂到 `window`

当前挂出的入口：

- `window.__widgetVA`
- `window.__widgetVAObservableD3Debug`
- `window.__widgetVAObservableD3Probe`
- `window.__widgetVAObservableD3PreviewBrush`

---

## 4. 当前 scatter 的结构查找流程

### 4.1 外层流程

当前 Observable D3 scatter 的查找链路是：

1. `observableD3PageScript.js` 注入 page script
2. `ensureObservableD3PageBootstrap(...)` 启动 bootstrap
3. 先用 `waitForObservableWorkerFrame(...)` 找到当前可用 worker iframe
4. 再在 worker 内部用 `describeSurface + readScatterRows` 等待 scatter 真正 ready
5. 只有在以下条件同时满足时才挂载：
   - `inferredKind === "scatter"`
   - `rows.length > 0`

这一点很重要：

- 不要在 `surface` 一出现时就挂载
- Observable 页面经常会先出现中间态
- 中间态会导致 `custom` 或空 rows

### 4.2 内层流程

在 worker 内部，scatter 的 plot region 定位路径是：

1. 找 `surface`
2. 找 point marks
3. 尝试找所有 marks 的最深公共祖先 `mark container`
4. 如果有 `mark container`，优先用它作为 `plot region`
5. 如果没有，再用所有 marks 的 union bounds
6. 如果连 marks 都读不出，再退回整块 `surface`

当前 `plotRegion.source` 可能是：

- `mark-container`
- `mark-bounds`
- `surface`

这套流程的目的不是“一次性识别所有图”，而是：

- 先把结构边界定清楚
- 让 probe 和后续 interaction materialization 有稳定参考系

---

## 5. 当前 scatter 的工作能力边界

当前已经适配的是：

- Observable D3 `scatter` 页面
- 基于点 marks 的读取、probe、selection 可见反馈

当前还没有适配的是：

- `line`
- `bar`
- 其他依赖 path / rect / series group 的 notebook

因此如果一个合作者把 `scatter` 页面跑通后，换成 `line` 页面发现失败，这是预期现象，不是系统坏掉。

原因是：

- 现在的读取逻辑是 `point mark` 导向
- `waitForObservableWorkerScatterSurface(...)` 明确要求 scatter ready
- line 页面没有 scatter rows，这条路线不会自动成功

---

## 6. 后续扩展其他 D3 图的标准开发路径

后续无论做 `line`、`bar` 还是其他图，都建议走同一个工作流。

### Step 1：先选一个具体的 gallery example

不要一开始就说“支持所有 line chart”。
先选一个明确页面，例如：

- 一个具体 line example
- 一个具体 bar example

目标是：

- 先让一个具体页面可挂载
- 再总结这个 kind 的共性

### Step 2：先确认外层宿主是否已复用成功

先执行：

```js
window.__widgetVA
```

再执行：

```js
await window.__widgetVAObservableD3Debug?.()
```

先确认：

- 页面切换后的 bootstrap 是否成功
- 当前 worker 是否重新绑定

如果这一步不通，不要往下开发 widget-specific 逻辑。

### Step 3：不要直接写 interaction，先做 probe

对于新 kind，第一步不是写 action。
第一步应该是：

- 找到当前图表的真实 plot region
- 让 probe 画准

也就是说，新 kind 的第一验收标准是：

- `await window.__widgetVAObservableD3Probe?.()` 画出的边界要基本贴住真实图表区域

### Step 4：写该 kind 自己的 mark 查找逻辑

示例：

- scatter：点 marks
- line：line path / series group
- bar：rect marks

建议不要把所有逻辑堆进一个函数里。
应该新增该 kind 自己的辅助函数，例如：

- `findObservableD3LineMarks(...)`
- `findObservableD3LineContainer(...)`
- `findObservableD3BarMarks(...)`

这些函数可以继续放在：

- `observableD3Surface.js`

但要保持命名和层级清楚。

### Step 5：先做 debug snapshot，再做 action

对于新 kind，先保证能返回稳定 debug snapshot，例如：

- 当前 kind
- 主 marks 数量
- plot region
- 主要 series 数量

只有 debug snapshot 清楚了，才继续往下做 action materialization。

### Step 6：最后再写 widget-specific attach / wrapper

不要把 line 直接塞进 scatter attach。

更合理的做法是：

- 新增 line-specific attach
- 新增 line-specific wrapper
- 再在更高一层做 kind dispatch

---

## 7. 推荐的代码组织方式

### 7.1 当前可保留的共用层

以下层应尽量共用：

- 页面识别
- worker iframe 查找
- bootstrap
- 切页重挂
- extension bridge 安装
- 调试入口挂载

### 7.2 后续应按 kind 分流的层

以下层不要强行共用：

- marks 查找
- row / series 读取
- plot region 精确解释
- action materialization
- debug snapshot 的 kind-specific 部分

### 7.3 建议的后续命名

如果继续做 line / bar，建议命名保持一致：

- `findObservableD3LineMarks`
- `findObservableD3LinePlotRegion`
- `readObservableD3LineSeries`
- `attachWidgetVAToObservableD3LinePage`
- `bootstrapObservableD3LinePage`

不要出现过于泛化但实际只支持某一个 kind 的命名。

---

## 8. 合作者开发时的验收工作流

### 8.1 本地构建

```bash
cd /Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system
npm run build:extension
```

Chrome 中：

1. 打开 `chrome://extensions`
2. 刷新 WidgetVA 扩展
3. 回到目标 Observable D3 页面
4. 强刷：`Cmd + Shift + R`

### 8.2 调试顺序

顺序必须是：

1. `window.__widgetVA`
2. `await window.__widgetVAObservableD3Debug?.()`
3. `await window.__widgetVAObservableD3Probe?.()`
4. 只有 probe 准了，才继续写或测 interaction

### 8.3 对新 kind 的最低验收标准

一个新的 D3 kind 至少要满足：

1. 页面切换后能重新挂载
2. debug snapshot 能返回合理结构
3. probe 能基本框住真正图表区域
4. 至少有一个可见的 primitive/action 能在页面上生效

如果这四步没满足，不要急着继续加更多动作。

---

## 9. 当前 scatter 路线给后续开发者的参考意义

scatter 这条线已经提供了三类可复用经验：

### 9.1 宿主查找经验

先找 Observable worker，再进 worker 内找图。

### 9.2 中间态等待经验

不要一看到 surface 就挂载。
必须等到：

- kind 正确
- 数据/marks 已经可读

### 9.3 可见反馈经验

probe 和 selection 都不要直接绑定“整块大 surface”。
应该尽量绑定到真实 plot region。

---

## 10. 当前不建议做的事情

以下做法暂时不建议：

- 重新写一套完全独立的 D3 页面接入框架
- 跳过 worker 直接在整个 Observable 页面全局猜图
- 把 scatter 的 point 读取逻辑硬塞给 line
- 一开始就做“支持所有 D3 gallery line/bar/scatter”
- 用大量没有层级的 heuristic 叠加来掩盖结构没有找准的问题

---

## 11. 合作者下一步最推荐的任务

如果由新的合作者继续开发，推荐顺序是：

1. 先完整读懂当前 scatter 路线
2. 选一个具体 Observable D3 line example
3. 先做 line 的 debug snapshot 和 probe
4. 再做 line 的第一个可见 primitive
5. 最后再考虑更一般化的 kind dispatch

不要反过来做。

---

## 12. 当前 scatter 相关测试文件

建议开发前先看这些测试文件，理解现有实现边界：

- `/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/integrations/officialPages/observableD3Pages.test.js`
- `/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/integrations/officialPages/observableD3Surface.test.js`
- `/Users/chenyutong/Desktop/agentic-visual-reframe/widgetva-kit/src/integrations/officialPages/observableD3Examples.test.js`
- `/Users/chenyutong/Desktop/agentic-visual-reframe/apps/widgetva-system/extension/src/page/observableD3Bootstrap.test.js`

这些测试分别覆盖：

- 页面识别与 worker 查找
- surface / plot region 查找
- scatter attach 与 selection
- 页面切换后的重新挂载

---

## 13. 文档使用方式

这份文档不是给最终用户看的，而是给继续开发 Observable D3 gallery 扩展的合作者看的。

实际使用方式建议是：

1. 先照着本文档跑通现有 scatter
2. 确认自己知道每层代码入口在哪里
3. 选一个新 example
4. 严格按本文档工作流推进
5. 每次只扩一个 kind，不要并行改多个 kind

这样最容易把结构做稳，也最方便后续论文展示和团队协作。
