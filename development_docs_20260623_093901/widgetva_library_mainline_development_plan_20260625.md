# WidgetVA Library 主线开发计划（2026-06-25）

## 1. 文档目标

这份计划用于把后续开发重新拉回 `library-first` 主线。

当前仓库已经通过 Vega / D3 官方页面接入，证明了以下方向是成立的：

- widget abstraction 不是空设计
- agent -> widget -> provider 的结构化链路可以工作
- single-widget runtime、perception、verified action、multi-turn loop 都已经有真实接入验证

但接入验证也带来了明显副作用：

- 真实页面适配问题开始挤占主线开发
- integration bug 容易污染 core 设计
- 局部修补越来越多，library 边界开始变模糊

因此，接下来的目标不是继续扩 demo，也不是继续堆页面特判，而是：

**把 WidgetVA 收束成一个以 library/runtime 为核心的产品形态，并让 Vega / D3 / 其他环境接入继续作为从属验证层。**

---

## 2. 当前阶段结论

### 2.1 已经证明的内容

- `widget abstraction` 主方向正确
- `action / perception / state` 作为 agent-facing contract 是可落地的
- `observe-plan-act-verify-reason` 已经有真实多轮执行原型
- Vega 官方页和 Observable D3 页说明这套设计可以 retrofit 到现有可视化环境

### 2.2 还没有证明的内容

- WidgetVA 是否已经是一个边界清晰、稳定可复用的 library
- runtime 是否已经把生命周期、恢复、替换、托管这些复杂度收住
- provider adapter 和 integration wrapper 是否已经和 core 明确解耦

### 2.3 现在最容易偏主线的风险

- 为单个 Vega / D3 gallery example 写过多环境特判
- 把 adapter 问题直接塞进 core/runtime
- 因为真实接入报错而不断扩大系统设计范围
- 把“接入能跑”误当成“library 已成型”

---

## 3. 后续开发总原则

后续开发统一遵守下面这条判断规则：

> 每一个新改动，都先判断它是在增强 `core library` 的稳定边界，还是只是在补某个 integration 场景。

具体执行上分成三条：

### P1. 主线由 core 决定，不由 integration 决定

- core/runtime/contract 决定系统形态
- Vega / D3 / extension 只负责验证这套形态在真实环境里能否成立
- integration 不反向主导 abstraction

### P2. 环境问题优先留在 adapter / integration 层

如果某个问题只出现在：

- Vega 官方页
- Observable D3 页面
- 某个特定 content script / extension bridge

那默认应在对应 adapter / integration 层处理，而不是直接修改 core。

只有当同类问题在多个 provider 上重复出现，才允许上升为 core/runtime 能力缺口。

### P3. 不为填补空位而引入 mock 逻辑或额外 unit logic

后续主线开发应尽量复用仓库已有能力：

- `widgetva-kit` runtime
- workspace materialization
- action / perception registry
- official-page integration
- app runtime bridge

如果已有能力不合适，可以重构或替换，但不要仅为了把计划“补齐”而额外引入一套脱离真实运行链路的 mock 逻辑。

---

## 4. 最终目标形态

WidgetVA 的最终目标形态应是：

```text
core TypeScript library/runtime
  +
provider adapters
  +
optional integrations
```

而不是：

```text
某个官方页面 demo
或某个固定 app 前端
```

建议的产品分层如下。

### 4.1 Core Library

负责稳定抽象和运行时能力：

- widget model
- workspace / shared analytical state model
- action / perception / data-query contract
- runtime materialization
- agent-facing runtime surface
- runtime manager / lifecycle management

### 4.2 Provider Adapters

负责把 core contract 绑定到具体环境：

- Vega-Lite adapter
- D3 adapter
- ECharts adapter
- custom adapter

### 4.3 Integration Wrappers

负责具体接入形态，不定义 core：

- browser extension for third-party pages
- in-page script integration
- first-party app runtime integration

---

## 5. 需要冻结的一版边界

接下来开发前，先把这一版边界视为主干，不再一边实现一边改系统树形结构。

## 5.1 Core 必须包含

- widget abstraction
- workspace abstraction
- runtime store / state snapshot
- action executor
- perception / data-query execution
- verified execution path
- multi-turn agent loop contract
- runtime manager（托管生命周期，而不是对外暴露大量底层细节）

这里需要补一条更明确的约束：

- `multi-widget` 的主语应固定为 `workspace-level coordinated state evolution`
- `widget-to-widget propagation` 只是 workspace coordination 的一种机制，而不是 multi-widget 的完整定义
- shared state 不得只被收缩理解成 `global filters`；凡是会影响后续多-widget协同与后续分析语境的共享分析状态，都应进入 workspace abstraction 的正式建模范围

## 5.2 Adapter 必须包含

- provider-specific state reading
- provider-specific materialization
- provider-specific interaction lowering（统一 widget contract 到具体 provider 操作的翻译）
- provider-specific recovery hooks（如果真的需要）

## 5.3 Integration 必须包含

- official page bootstrap
- content/page/background bridge
- injected stable entry
- environment-specific recovery glue

这里的命名只用于当前仓库的工程归类，不作为后续对外主接口命名。
后续对外表达时，应优先使用：

- library integration
- page integration
- extension integration

而不是让 bootstrap / bridge / glue 成为主设计语言。

## 5.4 不应该再继续混淆的内容

- official-page reload/reconnect 逻辑不应定义 core action contract
- 某个 gallery example 的 DOM 结构不应影响 widget model
- bridge 生命周期不应泄露成 agent-facing 主接口

---

## 6. 接下来必须做的主线任务

以下任务按优先级排序。

## Phase 1：Library 边界与 Workspace 建模定版

### Task 1. 定版 core / adapter / integration 边界

**Description**

基于当前仓库已有实现，整理并固定 WidgetVA 的三层边界：

- core
- provider adapter
- integration wrapper

输出不是新设计，而是对现有代码的归类与约束。

**Acceptance criteria**

- [ ] 现有关键模块能够明确归入 `core / adapter / integration` 三层之一
- [ ] 明确写出哪些问题允许在 integration 层解决，哪些必须上升到 core
- [ ] 后续开发有统一判断标准，避免继续被 gallery 特例牵引

**Verification**

- [ ] 文档完成并与当前仓库目录对齐
- [ ] 文档中的模块命名与当前代码命名基本一致，不凭空引入新体系

**Dependencies:** None

**Likely touched**

- `development_docs_20260623_093901/`

---

### Task 2. 定版 workspace abstraction 的 multi-widget 归属

**Description**

正式固定 `multi-widget` 的承载者是 `workspace abstraction`，而不是把 multi-widget 简化成若干 pairwise links。

这里需要明确：

- widget-local state 和 workspace-shared state 的边界
- shared analytical state 的判定规则
- 哪些共享状态会影响后续 observe / plan / action execution
- coordination result 降级为 runtime 内部执行结构，而不是主要的 agent-facing 输出

shared analytical state 在当前阶段至少要覆盖一版正式分类：

- shared filters
- shared viewport context
- shared semantic focus
- shared structural context

**Acceptance criteria**

- [ ] `multi-widget` 被明确建模为 `workspace-level coordinated`，而不是只等于 widget-to-widget propagation
- [ ] `widget-local state` 与 `workspace-shared state` 的边界清楚
- [ ] `shared analytical state` 的分类和判定规则写清楚，避免后续遗漏 zoom / re-encode / drill-down 等上下文
- [ ] `coordination result` 被正式降级为 runtime internal structure

**Verification**

- [ ] 文档完成并与当前 workspace/runtime 代码能对应
- [ ] 后续 primitive 扩展时可以直接用这版边界判断归属

**Dependencies:** Task 1

---

### Task 3. 定版 runtime manager 的职责边界

**Description**

明确 runtime manager 是 core library 的一部分，但它的职责是内部托管，不是把实现细节直接暴露成用户接口。

这里要明确的是“系统内部必须托管什么”，而不是直接枚举很多对外 API。

最少应覆盖：

- active controller / runtime ownership
- current recoverable state
- controller replacement / re-attachment policy
- bridge / transport failure recovery policy
- request continuation boundary

**Acceptance criteria**

- [ ] runtime manager 的职责清晰写出
- [ ] 明确哪些属于内部托管能力，哪些属于对外稳定入口
- [ ] 不把低层恢复细节直接当成外部主 contract

**Verification**

- [ ] 文档完成
- [ ] 可直接作为后续实现的边界依据

**Dependencies:** Task 1, Task 2

---

## Phase 2：Agent-facing Runtime 收束

### Task 4. 收敛 session knowledge 和 turn observation

**Description**

继续沿用现有 multi-turn agent contract 方向，但进一步收敛字段，减少对 agent 没有真正帮助的冗余内容。

目标是：

- knowledge 稳定持有
- observation 每轮只提供动态上下文
- 视觉模态通过 snapshot reference 进入，但不把本地实现细节写死进 formal contract
- observation 只保留真正影响下一轮分析的动态信息，不重复塞入已稳定持有的 catalogs/knowledge

**Acceptance criteria**

- [ ] knowledge / observation 的边界固定
- [ ] per-turn 返回结构保持 `observe / plan / act / verify / reason`
- [ ] 返回字段不再无序扩张

**Verification**

- [ ] 对照当前 `widgetva_multi_turn_agent_module_contract_20260625.md`
- [ ] 确认与 `apps/widgetva-system/src/runtime/agentRuntime.js`、`widgetva-kit/src/core/runtime/pagePortAgentLoop.js` 可对齐

**Dependencies:** Task 2

---

### Task 5. 收敛 verification 的正式职责

**Description**

verification 不是简单的“动作执行成功了没有”，而是要明确由规则层负责哪些检查、给 agent 返回哪些真正有用的反馈。

当前阶段重点收敛：

- step choice / params 是否合理
- state 是否发生预期变化
- 是否存在下一轮可执行的明确修正方向

同时明确：

- verification 是 agent-facing feedback
- coordination result 不是 agent-facing 主输出
- provider materialization 缺陷不应长期借由 verification 文本来兜底

不要求在这一步把所有 provider 视觉验证都做到完全自动化，但要把 formal contract 先定清楚。

**Acceptance criteria**

- [ ] verification 的输入输出边界明确
- [ ] verify 返回对 agent 下一轮真正有帮助的信息，而不是空泛解释
- [ ] 不把 provider materialization 缺陷当成长期依赖的 verify 逻辑

**Verification**

- [ ] 文档与现有 agent runtime contract 一致

**Dependencies:** Task 4

---

## Phase 3：Runtime Manager 实现

### Task 6. 实现 library 内部的 runtime manager 主骨架

**Description**

在不重写现有 abstraction 的前提下，引入或收敛一层 runtime manager，使后续的恢复、替换、挂载管理不再分散在 Vega / D3 / app integration 各处。

这一层必须优先复用当前能力，而不是重新造一整套 runtime。

**Acceptance criteria**

- [ ] runtime manager 可以管理 active runtime/controller
- [ ] manager 能持有当前可恢复 state
- [ ] manager 作为后续恢复与替换逻辑的唯一入口

**Verification**

- [ ] 单元测试或现有 runtime tests 补充通过
- [ ] 不要求我在浏览器做端到端验收；实现完成后给出人工验收指令

**Dependencies:** Task 3

---

### Task 7. 在 official-page integration 上接入 manager，而不是继续散落修补

**Description**

把 Vega 官方页、Observable D3 官方页当前的恢复/替换问题，逐步收口到 manager 驱动的逻辑里，而不是继续在 page script / content script 分散添加临时补丁。

这里的目标不是一次性实现完美热替换，而是先让“接入层恢复逻辑由统一托管层负责”。

**Acceptance criteria**

- [ ] official-page loop 的恢复逻辑开始走统一托管路径
- [ ] page integration 不再直接主导恢复策略
- [ ] 出错后的恢复逻辑比当前更集中、更可维护

**Verification**

- [ ] 相关测试通过
- [ ] 提供人工验收指令，让使用者在 Vega 页面和 D3 页面验证

**Dependencies:** Task 6

---

## Phase 4：Adapter 路线继续前进，但不绑架主线

### Task 8. Vega / D3 后续只保留验证型开发

**Description**

后续 Vega / D3 的开发，只允许做两类事情：

1. 验证 core/runtime 设计是否成立
2. 补那些会直接反哺 provider adapter 边界的缺口

不再以“把 gallery 所有例子都修好”为近期目标。

**Acceptance criteria**

- [ ] 明确哪些 Vega / D3 后续任务继续做
- [ ] 明确哪些页面特判不再作为主线投入
- [ ] 把更多页面适配工作留给后续合作者时，有清晰交接边界

**Verification**

- [ ] 文档完成

**Dependencies:** Task 1

---

## Phase 5：继续结构化剩余 Primitive，但以 Workspace 边界为前提

### Task 9. 将剩余会影响共享分析语境的交互继续结构化进入主线

**Description**

在 workspace abstraction 和 shared analytical state 边界固定后，再继续把剩余 primitive 正式结构化进去。

当前重点不再是“多加几个动作名”，而是判断这些能力应进入：

- widget-local state
- workspace-shared state
- adapter materialization

优先关注后续会改变多-widget协同语境的能力，例如：

- re-encode
- drill-down / roll-up
- aggregate
- expand / collapse
- sort / reorder
- zoom / viewport coordination 的共享版本

**Acceptance criteria**

- [ ] 新 primitive 的归属清楚，不再一边实现一边改层次
- [ ] 会改变后续分析语境的交互被明确映射到 shared analytical state 或 local state
- [ ] agent 后续可以通过稳定 contract 调用这些能力，而不是重新走 provider 特判

**Verification**

- [ ] 文档或实现与既有 widget contract / workspace contract 对齐
- [ ] 提供人工验收指令，由使用者在 Vega / D3 页面验证已落地 primitive

**Dependencies:** Task 2, Task 4, Task 8

---

## 7. 暂缓事项

以下事项当前暂缓，不作为主线优先级：

- 继续大规模扩充 single-widget primitive 种类
- 为每个 D3 / Vega gallery example 单独完善接入
- 为了展示效果继续增加 demo 化前端包装
- 过早把 multi-widget 全部落到 provider integration 层
- 把 benchmark 迁移重新拉回当前阶段主线
- 在 workspace 边界未定前继续无序扩 primitive

这些方向不是不做，而是要等 core library 边界和 runtime manager 先稳定下来。

---

## 8. 当前阶段的阶段性验收标准

这一阶段的验收，不以“所有 gallery 页面完全无 bug”为标准，而以“library 主线是否继续收束”为标准。

### 必须满足

- [ ] WidgetVA 的 core / adapter / integration 边界更清楚，而不是更混乱
- [ ] multi-widget 的归属被固定到 workspace abstraction，而不是继续散落
- [ ] shared analytical state 的边界比当前清楚，而不是继续只用 global filters 粗糙代替
- [ ] runtime manager 成为明确的内部主线能力
- [ ] agent-facing observe / plan / act / verify / reason contract 更稳定、更简洁
- [ ] Vega 官方页上的 agent 能继续使用起来，作为人工测试入口

### 不要求

- [ ] 我在浏览器里替你完成所有端到端验收
- [ ] 为填补空位而额外写 mock/unit-only 逻辑
- [ ] 在当前阶段把所有官方页面和所有 primitive 全部打磨完

### 本阶段完成时的人工验收方式

开发完成后，我负责：

- 完成代码实现
- 跑本地测试
- 给出人工验收指令

人工验收由你执行，重点检查：

- Vega 官方页自然语言 agent loop 是否仍可工作
- observation / verification / final answer 是否符合 formal contract
- 恢复和替换逻辑是否比当前更稳

---

## 9. 一句话执行原则

后续每一个开发任务，都先问这一句：

> 这个改动是在增强 WidgetVA 作为一个 library/runtime 的稳定边界，还是只是在救某个接入场景？

如果是前者，优先推进。  
如果是后者，尽量把修改限制在 adapter / integration 层。  
如果两者都不是，当前阶段不做。
