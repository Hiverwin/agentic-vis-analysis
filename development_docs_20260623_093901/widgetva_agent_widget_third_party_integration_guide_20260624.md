# WidgetVA 第三方 Agent / 第三方 VA 接入指南

> 目标：给未来合作者一个清晰、可执行、不过度包装的接入路径。  
> 本文回答三个问题：
>
> 1. 如果别人想把“自己的 agent”接到 WidgetVA 上，应该接什么接口？
> 2. 如果别人想把“自己的可视分析系统 / 自己的 Vega/D3/ECharts 页面”接到 WidgetVA 上，应该补什么层？
> 3. 当前剩余不稳定的 primitive，主要属于哪一层的问题？

---

## 1. 一句话结论

WidgetVA 的接入边界现在已经可以表述为：

```text
Agent
  -> WidgetVA agent-facing runtime contract
  -> WidgetVA runtime / page port
  -> provider adapter / materializer
  -> Vega / D3 / ECharts / custom VA
```

也就是说：

- `agent` 不直接操作像素，不直接改 Vega spec，不直接操作 D3 DOM。
- `agent` 只需要：
  - 读取当前 workspace / widget / state
  - 决定下一步语义操作
  - 发送结构化 widget action
- `WidgetVA runtime` 负责：
  - 校验这个 action 是否合法
  - 执行 canonical widget action
  - 更新共享状态、trace、verification
- `provider adapter` 负责：
  - 把 canonical widget action 落到真实 provider 中
  - 让最终视图真的变化

---

## 2. 当前已经被证明成立的部分

目前已经有真实路径证明以下链路成立：

### 2.1 Agent -> WidgetVA

已经打通：

- 自然语言输入
- VLM / planner
- 结构化 operation
- page port / runtime contract
- `executeVerifiedAction`

这说明 `agent -> widget` 的核心 contract 已经形成。

### 2.2 WidgetVA -> 真实 provider

已经在真实官方页面上验证：

- Vega-Lite 官方 examples 页面
- Observable D3 官方页面

这说明 `widget -> provider` 不是纸面设计，而是已经存在真实 materialization 路径。

### 2.3 现在已经能成立的数据流

```text
自然语言
  -> planner
  -> structured widget operation
  -> WidgetVA runtime/page port
  -> adapter/materializer
  -> 真实视图变化
```

---

## 3. 两类接入方要分开理解

未来使用者通常分成两类：

### 3.1 接入“自己的 agent”

这种使用者已经有：

- 自己的 LLM / VLM
- 自己的 planner
- 自己的 memory / orchestration

他们不需要重写 WidgetVA runtime。  
他们只需要调用 WidgetVA 的 agent-facing contract。

### 3.2 接入“自己的 VA / 自己的 provider 页面”

这种使用者已经有：

- 自己的 Vega 页面
- 自己的 D3 notebook
- 自己的 ECharts dashboard
- 自己的 custom SVG / Canvas / DOM VA

他们不需要重写 agent。  
他们需要补的是 WidgetVA 到自己 provider 的 adapter / materialization。

---

## 4. 第三方 Agent 接入：一步步怎么做

这一节假设：

- 对方已经有自己的 agent
- 对方希望让自己的 agent 操作 WidgetVA
- 对方不想使用你现在的官方页面自然语言入口，也不想复用你的 VLM planner

### Step 1: 连接到 WidgetVA page port / runtime contract

Agent 首先要拿到一个 WidgetVA runtime surface。  
这个 surface 当前可以来自：

- `window.__widgetVA`
- browser extension transport
- Playwright transport
- WebSocket transport
- 未来的其他 transport

对 agent 来说，本质上它拿到的是一组稳定方法。

### Step 2: 先做 observe，而不是直接 act

Agent 第一轮应该先读这些接口：

- `describeWorkspace()`
- `describeAgentLoop()`
- `readObservation()`

这一步的目的：

- 知道当前有哪些 widget
- 知道 widget kind / ref / title
- 知道当前可用 actions / perceptions / data queries
- 知道当前 state / focus / shared selection

### Step 3: 如果要执行 action，先查 action usage

在执行某个 action 之前，建议先读：

- `describeActionUsage({ targetRef, actionName })`

这一步的目的：

- 知道这个 action 必须传哪些参数
- 知道作用目标 widget 是谁
- 知道 queryScope 应该怎么填

这一步非常重要，因为它让 agent 不需要猜参数格式。

### Step 4: 让 agent 输出结构化 operation / action call

agent 最终不应该输出：

- “帮我把图放大”
- “点击这里”
- “修改这段 spec”

而应该输出：

```js
{
  callId: "agent_action_1",
  actor: "agent",
  name: "scatter.brushRegion",
  queryScope: {
    widgetRef: "w://..."
  },
  params: {
    xField: "Horsepower",
    yField: "Miles_per_Gallon",
    xRange: [80, 140],
    yRange: [18, 30]
  }
}
```

### Step 5: 通过 runtime 执行，而不是自己改 provider

真正执行时，agent 调：

- `executeVerifiedAction(call)`

如果只是读信息，不改变视图，则调用：

- `queryPerception(call)`

如果要走数据层，则调用：

- `runDataQuery(call)`

### Step 6: 做 verify

执行完成后，agent 不应直接假设成功。  
它应继续读：

- action 返回值中的 `verification`
- 或者再次调用 `readObservation()`
- 或者调用 `queryPerception(...)`

这样才能形成真正的：

```text
observe -> plan -> act -> verify -> continue
```

### Step 7: 多轮继续

后续每一步都重复上面的流程：

1. 读当前 workspace / observation
2. 决定下一步 operation
3. 调 runtime 执行
4. 读 verification / 新状态

---

## 5. 第三方 Agent 最少必须依赖哪些接口

如果只列“必须有”的最小集合，可以写成：

### 5.1 观察接口

- `describeWorkspace()`
- `describeAgentLoop()`
- `readObservation()`

### 5.2 动作帮助接口

- `describeActionUsage({ targetRef, actionName })`

### 5.3 执行接口

- `executeVerifiedAction(call)`

### 5.4 查询接口

- `queryPerception(call)`
- `runDataQuery(call)`

如果一个第三方 agent 能读写上面这些接口，它就已经可以接入 WidgetVA。

---

## 6. 第三方 VA / Provider 页面接入：一步步怎么做

这一节假设：

- 对方已经有自己的 Vega / D3 / ECharts / custom VA
- 他们希望让 WidgetVA 操作它
- 重点不是换 agent，而是把这个页面纳入 WidgetVA runtime

### Step 1: 先找到真实 chart surface

不要先猜 mark 的分布，也不要先凭点数推断。  
合理路径是：

1. 先找到页面中“图表真正渲染出来”的 surface
2. 再判断这个 surface 对应哪个 widget kind
3. 再为它建立 WidgetVA adapter

这个原则在 D3 页面上尤其重要。

### Step 2: 确定 widget kind

找到真实 surface 后，要回答：

- 这是 scatter？
- bar？
- line？
- heatmap？
- sankey？

这一步决定接下来应该挂接哪套 canonical widget semantics。

### Step 3: 读取 provider 侧必要状态

adapter 至少要能读到：

- 当前渲染 surface
- 当前数据或数据投影
- 当前 selection / highlight / viewport
- 当前可能需要恢复的渲染上下文

### Step 4: 把它包成 WidgetVA widget adapter

adapter 需要做两类事：

1. human / runtime 侧 binding
2. state apply / materialization

也就是说：

- human 在页面上 brush / click 时，adapter 要把它翻译成 WidgetVA selection/action
- agent 发来 `scatter.brushRegion` 时，adapter 要把它翻译成 provider 内部更新

### Step 5: 安装 page port

把这个接好的 widget / workspace runtime 安装成 page port，对外暴露：

- `describeWorkspace`
- `readObservation`
- `describeActionUsage`
- `executeVerifiedAction`
- `queryPerception`
- `runDataQuery`

这一步完成后，agent 就不需要知道对面是 Vega、D3、ECharts 还是 custom 页面。

### Step 6: 用结构化 action 做人工验收

页面接好后，不要一开始就上自然语言。  
先用结构化 action 验收：

- `zoom`
- `brush`
- `filter`
- `highlight`
- `sort`

确认 canonical action 确实能让真实视图变化。

### Step 7: 再接自然语言 / planner

只有 page port 和 action 路径稳定之后，才接自然语言 planner。  
否则你会分不清问题是：

- agent plan 错了
- action 参数错了
- 还是 provider materialization 错了

---

## 7. 现在第三方接入时，谁负责什么

这部分最容易混，所以直接锁边界。

### 7.1 Agent 层负责

- 理解自然语言
- 读取 workspace / observation
- 决定下一步 operation
- 选择 action / perception / data_query
- 提交结构化调用

### 7.2 WidgetVA runtime 负责

- 暴露统一 contract
- 校验 structured call
- 执行 canonical action
- 维护 selection / filter / focus / viewport 的共享状态
- 返回 verification / trace / state

### 7.3 Provider adapter 负责

- 找到真实图表 surface
- 读取 provider 当前状态
- 把 canonical action 落到 provider
- 把 provider 的 human interaction 翻译回 WidgetVA runtime
- 保证视图真的变化

---

## 8. 当前不稳定的 primitive，主要属于哪一层

简短答案：

**大多数“已经定义了语义，但在真实页面上还不稳定”的 primitive，主要属于 `widget -> provider adapter / materialization` 这一层的问题。**

但要分两种情况。

### 8.1 如果 primitive 的语义已经清楚

例如：

- `scatter.brushRegion`
- `scatter.zoomDomain`
- `bar.selectCategory`
- `bar.sortBars`

如果这些 action 的：

- 名称
- 参数
- queryScope
- 预期效果

都已经定义清楚，那么后续不稳定通常不是 agent-facing contract 的问题，而是：

- provider adapter 没正确 apply
- 页面 surface 没找准
- materialization 不完整
- provider 内部状态读写不稳定

这类问题主要属于：

```text
widget abstraction 已有
runtime action contract 已有
provider adapter / materializer 还要继续补
```

### 8.2 如果 primitive 本身语义还没定清楚

例如某个新 primitive 你还没明确：

- 它到底算 selection / filter / viewport / re-encoding 中哪类
- 它的参数最小集合是什么
- 它的验证条件是什么

那这还不是 provider 层的问题，而是：

- widget semantics 还没定义完成
- primitive contract 本身还没锁定

这类问题属于：

```text
widget semantic layer / action descriptor layer
```

### 8.3 所以怎么判断一个问题归哪层

可以用一个非常简单的判断标准：

#### A. 如果结构化 call 已经长这样了：

```js
{
  name: "...",
  queryScope: { widgetRef: "..." },
  params: { ... }
}
```

并且你已经知道“它应该导致什么视图变化”，  
那剩下的问题大概率属于 `provider adapter`。

#### B. 如果你连这个 action 应该叫什么、该收哪些 params 都还不确定，  
那问题还在 `widget semantic contract`。

---

## 9. 当前系统是否已经满足完整数据传输流

现在可以这样判断。

### 9.1 对 Vega / D3 已验证路径

可以认为已经满足：

```text
agent
  -> widget layer
  -> provider
```

因为已经有真实官方页面验收。

### 9.2 对未来第三方 VA

可以认为“架构上满足，工程上还需要补 adapter”。

也就是说：

- `agent -> widget runtime contract` 已成立
- `widget runtime -> provider adapter` 的通路已成立
- 但每个新 provider / 新页面仍然需要自己的接入工作

这不是 contract 缺失，而是 adapter 工作量。

---

## 10. 给第三方合作者的最小接入工作流

如果要让一个新合作者快速上手，可以直接让他按下面做。

### 路线 A：接“自己的 agent”

1. 拿到 `window.__widgetVA` 或其他 transport client
2. 调 `describeWorkspace()`
3. 调 `readObservation()`
4. 根据任务选 action
5. 调 `describeActionUsage(...)`
6. 构造 structured call
7. 调 `executeVerifiedAction(call)`
8. 读 verification / observation
9. 继续下一轮

### 路线 B：接“自己的页面 / 自己的 VA”

1. 找到真实 chart surface
2. 判断 widget kind
3. 读取 provider 侧状态
4. 写 adapter / materialization
5. 安装 WidgetVA page port
6. 用结构化 action 验收
7. 再接自然语言 agent

---

## 11. 推荐对外说明

如果要给老师、合作者、未来用户一句最准确的描述，可以直接说：

> WidgetVA 不是让 agent 直接操作 Vega / D3 / ECharts。  
> Agent 只需要通过 WidgetVA contract 读取 workspace 并发送结构化 widget action；WidgetVA runtime 再把这些 canonical action 落到具体 provider 中。

再进一步一点：

> 因此，接入新的 agent，主要是接 WidgetVA 的 runtime contract；接入新的可视化系统，主要是补 WidgetVA 到该 provider 的 adapter / materialization。

---

## 12. 当前阶段最重要的工程判断

当前阶段应坚持：

- 不要把 provider 细节泄露到 agent-facing contract
- 不要让 agent 直接写 Vega spec / 直接改 D3 DOM
- 不要把“primitive 还没定义清楚”和“provider 还没 materialize 好”混成一类问题

更具体地说：

- `agent -> widget` 这层现在已经基本成立
- 后续大量工作会集中在 `widget -> provider`
- 但新增 primitive 时，仍然要先锁 semantic contract，再去做 provider 侧实现

---

## 13. 目前最适合继续推进的两条线

### 13.1 主线

继续把更多 provider/page 上的 canonical primitive 打通。

这是让系统真正可复用的关键。

### 13.2 并行线

继续把“第三方 agent 如何接入”整理成更稳定的示例和 usage 文档。

这是让别人真的能复现你的论文系统的关键。

---

## 14. 文档结论

当前可以明确给出结论：

1. `agent -> widget` 的接口已经形成，并且已经被真实页面验证。
2. 第三方 agent 接入时，对接的是 `WidgetVA runtime contract`，不是具体 provider。
3. 第三方 VA 接入时，主要补的是 `provider adapter / materialization`。
4. 当前剩余的大部分“不稳定 primitive”问题，主要属于 `widget -> provider` 层，而不是 `agent -> widget` 层。
5. 只有在 primitive 语义本身还没锁定时，问题才属于 widget semantic modeling 层。

