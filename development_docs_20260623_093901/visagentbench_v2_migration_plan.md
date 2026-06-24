# VisAgentBench v2 迁移方案

目标：在**最低改动成本**下，把当前以 Vega 为中心的 `visagentbench` 迁移为：

- 保留现有 benchmark 语义资产
- 支持抽象 benchmark schema
- 允许同一 benchmark 在不同 renderer / materialization 环境中 materialize
- 支持后续做 cross-renderer 实验评估

本文不是“大重写方案”，而是**分层迁移方案**。

---

## 1. 当前资产判断

### 1.1 benchmark 规模

通过扫描 `visagentbench/`：

- `clear_single`: 716
- `clear_multi`: 679
- `vague_single`: 637
- `vague_multi`: 611

合计可解析 benchmark 约 **2643** 条。

### 1.2 图表类型覆盖

按文件名 / `task_id` 粗统计：

- `bar`: 556
- `sankey`: 480
- `scatter`: 424
- `heatmap`: 412
- `line`: 404
- `parallel`: 372

这说明 benchmark 的语义覆盖面已经够大，不适合推倒重来。

### 1.3 数据资产情况

扫描 `benchmark_annotation_system/backend/`：

- `specs/*.json`: 122
- 其中直接内嵌 `data.values` 的 spec: 102
- `data/*.json`: 120

结论：

1. 当前**不是没有数据**。
2. 当前最大问题不是数据缺失，而是：
   - benchmark schema 绑在 `vega_spec_path`
   - state/tool evaluation 偏 Vega 实现细节

---

## 2. 当前 schema 的问题

当前 benchmark 典型结构：

```json
{
  "task_type": "vague_multi",
  "task_id": "01_scatter_vm_01",
  "vega_spec_path": "benchmark_annotation_system/backend/specs/01_scatter_cars.json",
  "questions": [
    {
      "qid": "vm_02",
      "question": "...",
      "ground_truth": {
        "answer": { ... },
        "reasoning": [ ... ],
        "tool_eval": { ... },
        "state_eval": { ... }
      }
    }
  ]
}
```

核心问题有 3 个：

1. `vega_spec_path` 是主入口字段  
   这会把 benchmark 定义和 Vega 环境绑定在一起。

2. `tool_eval` 目前更像“当前系统工具调用检查”，不是 renderer-agnostic action contract  
   例如 `filter_categories`、`brush_region`、`toggle_stack_mode` 虽然已经有抽象味道，但还没被正式定义成环境无关 action。

3. `state_eval` 里混有很多 Vega 风格状态检查  
   例如：
   - `data_filtered`
   - `visible_domain`
   - `mark_mode.is_stacked`
   - `encoding.x/y/color`

这些字段的“语义”可以跨环境保留，但“内部实现表达”不能直接要求 D3 和 Vega 一一同构。

---

## 3. 迁移目标

v2 的目标不是把所有 benchmark 改写成 D3，也不是把所有 case 全量双份维护。

v2 的正确目标是：

1. benchmark 的**任务语义层**从 Vega 脱钩。
2. benchmark 可以通过不同 `renderer materialization` 落到不同环境。
3. agent 始终面向统一的：
   - `action`
   - `perception`
   - `canonical state`
4. 允许：
  - 全量保留 Vega-based corpus
  - 仅选一个子集做 cross-renderer evaluation

---

## 4. v2 总体结构

建议把 benchmark 拆成 3 层：

```text
benchmark semantic instance
  -> materialization spec
  -> runtime execution surface
```

具体对应：

### 4.1 Semantic Instance

定义“要测什么”：

- 任务类型
- 问题文本
- 正确答案
- 关键 reasoning
- 需要哪些 action/perception
- 需要检查哪些 canonical state

### 4.2 Materialization

定义“在什么环境下怎么落地”：

- `vega-lite`
- `vega`
- `d3`
- `echarts`
- `custom svg/canvas/dom hybrid widget`

### 4.3 Runtime Execution Surface

定义“agent 如何执行”：

- `executeAction`
- `queryPerception`
- `readState`
- `readTrace`

---

## 5. 最低改动的 v2 schema

建议新增一层 v2 schema，而不是直接破坏现有文件。

### 5.1 建议结构

```json
{
  "benchmark_id": "01_scatter_vm_01",
  "task_type": "vague_multi",
  "widget_kind": "scatter",
  "question_set": [
    {
      "qid": "vm_02",
      "question": "How do Japanese and American cars compare ...?",
      "ground_truth": {
        "answer": {
          "type": "categorical",
          "value": "...",
          "alternatives": []
        },
        "key_insights": [
          "Japan supplies more of the high-MPG points inside the horsepower window."
        ],
        "reasoning_trace": [
          {
            "iteration": 1,
            "action": "filter.categorical.exclude",
            "rationale": "Removes Europe so the comparison stays between Japan and the US."
          },
          {
            "iteration": 2,
            "action": "scatter.brushRegion",
            "rationale": "Selects the horsepower band where efficient cars concentrate."
          }
        ],
        "required_actions": [
          "filter.categorical.exclude",
          "scatter.brushRegion"
        ],
        "required_perceptions": [],
        "canonical_state_checks": {
          "activeFilters": [
            {
              "field": "Origin",
              "op": "notIn",
              "value": ["Europe"]
            }
          ],
          "view": {
            "xDomain": [40.16, 116.38]
          }
        }
      }
    }
  ],
  "data_source": {
    "kind": "inline_or_json",
    "dataset_id": "01_scatter_cars"
  },
  "materializations": {
    "vega": {
      "spec_path": "benchmark_annotation_system/backend/specs/01_scatter_cars.json"
    }
  }
}
```

### 5.2 为什么这样改

这样改以后：

- benchmark 核心层不再依赖 Vega
- `vega` 只是一种 materialization
- 后面加 `d3` 只是在 `materializations` 下新增分支

---

## 6. 哪些字段原样保留

这些字段应尽量直接保留：

- `task_type`
- `task_id`
- `question`
- `ground_truth.answer`
- `ground_truth.key_insights`
- `ground_truth.reasoning`

迁移时只是改字段名或做轻量规范化，不要重写内容。

建议映射：

- `task_id` -> `benchmark_id`
- `questions` -> `question_set`
- `ground_truth.reasoning` -> `ground_truth.reasoning_trace`

---

## 7. 哪些字段自动转换

### 7.1 `vega_spec_path`

从顶层字段迁到：

```json
"materializations": {
  "vega": {
    "spec_path": "..."
  }
}
```

### 7.2 `tool_eval`

当前 `tool_eval` 不要直接删掉，而是自动转换成：

- `required_actions`
- `action_param_checks`

例如：

```json
"tool_eval": {
  "tools": [
    {
      "tool": "brush_region",
      "param_eval": { ... }
    }
  ]
}
```

可先转成：

```json
"required_actions": ["scatter.brushRegion"],
"action_param_checks": [
  {
    "action": "scatter.brushRegion",
    "params": {
      "xRange": [40.16, 116.38]
    }
  }
]
```

注意：

- 这里需要做一张 `legacy tool name -> canonical action name` 的映射表
- 这张表是迁移的关键基础设施之一

### 7.3 `state_eval`

自动分两类：

1. 保留为 `canonical_state_checks`
2. 暂存为 `legacy_renderer_checks.vega`

例如：

- `encoding.x/y/color` -> 可以进入 canonical
- `visible_domain` -> 可以进入 canonical
- 复杂 Vega filter expression -> 先放进 `legacy_renderer_checks.vega`

---

## 8. 哪些 state 字段保留为 canonical

建议第一阶段只保留以下通用字段：

- `encodings`
  - `x`
  - `y`
  - `color`
  - `size`
- `activeFilters`
- `view`
  - `xDomain`
  - `yDomain`
  - `zoom`
- `selection`
  - `selectionKind`
  - `fields`
  - `predicates`
- `viewMode`
  - `stackMode`
  - `sortMode`
- `visibleDataSummary`
  - `visibleCount`
  - `selectedCount`

### 8.1 示例映射

当前：

```json
"state_eval": {
  "visible_domain": {
    "x": [40.16, 116.38]
  }
}
```

改成：

```json
"canonical_state_checks": {
  "view": {
    "xDomain": [40.16, 116.38]
  }
}
```

当前：

```json
"state_eval": {
  "mark_mode": {
    "is_stacked": false
  }
}
```

改成：

```json
"canonical_state_checks": {
  "viewMode": {
    "stackMode": "grouped"
  }
}
```

---

## 9. 哪些字段暂时保持 Vega-specific

这些内容第一阶段不强行抽象：

- Vega filter expression 字符串
- Vega signal 名
- Vega transform 细节
- Vega mark 内部配置细节
- 依赖 Vega 编译后状态才能读出的实现字段

建议统一放在：

```json
"legacy_renderer_checks": {
  "vega": { ... }
}
```

原因：

- 这些字段实验上不是完全没用
- 但它们不应该阻塞 v2 的 benchmark 抽象化

---

## 10. 数据层怎么处理

### 10.1 当前结论

当前数据不是硬障碍。

因为：

- 102/122 个 spec 已经直接内嵌 `data.values`
- `backend/data` 里还有 120 个数据文件

### 10.2 建议数据策略

为 v2 增加一个统一的 `dataset registry`：

```text
visagentbench_v2/
  datasets/
    01_scatter_cars.json
    49_coffee_sales_heatmap.json
  benchmarks/
    ...
```

每个 benchmark 不再直接依赖“只能从 Vega spec 里找数据”，而是指向：

```json
"data_source": {
  "dataset_id": "01_scatter_cars",
  "kind": "rows_json"
}
```

### 10.3 最低改动做法

第一阶段不需要人工清洗所有 dataset。

可以自动脚本做：

1. 优先读取 `spec.data.values`
2. 若 spec 无 `data.values`，再去 `backend/data/` 找同名文件
3. 统一导出到 `visagentbench_v2/datasets/`

---

## 11. 不要全量多环境化，先做 pilot 子集

这是迁移成本控制的关键。

### 11.1 不建议

不建议直接对 2643 条 benchmark 全量做：

- Vega/Vega-Lite materialization
- D3 materialization
- 其他 renderer materialization
- cross-renderer state checks

这会非常重。

### 11.2 建议

先做一个 **cross-renderer pilot subset**，建议规模：

- 总计 12 到 18 条 benchmark

按图表类型分布：

- `scatter`: 3
- `bar`: 3
- `line`: 2
- `heatmap`: 2
- `sankey`: 2
- `parallel`: 2

任务类型尽量覆盖：

- `clear_single`
- `clear_multi`
- `vague_single`
- `vague_multi`

### 11.3 选择标准

优先选择：

1. spec 里直接有 `data.values`
2. action 比较标准化
3. state_eval 不太依赖 Vega 私有字段
4. 图表语义清晰，便于至少两种 renderer 复现

---

## 12. 推荐的 pilot benchmark 选择原则

### 12.1 第一优先

- scatter: filter + brush + compare
- bar: filter + grouped/stacked mode
- line: zoom + compare trend
- heatmap: color scale + extremes

### 12.2 第二优先

- parallel: highlight + compare dimensions
- sankey: collapse/expand + path comparison

### 12.3 先避开

第一阶段先避开：

- 过于依赖 Vega transform 细节的 case
- 需要复杂动画/布局才能稳定复现的 case
- 数据定义和 spec 命名不一致严重的 case

---

## 13. 数据清理建议

### 13.1 当前数据规模分布

基于 `benchmark_annotation_system/backend/specs` 与 `backend/data` 的当前统计：

- 可解析数据集数：102
- 最小行数：5
- `p10`: 21
- `p25`: 180
- `median`: 727
- `p75`: 2845
- `p90`: 10781
- 最大行数：100000

### 13.2 明显偏小的数据集

当前 `< 20` 行的数据集有 7 个：

- `121_scatter_custom_focus_demo.json`：5
- `02_bar_sales.json`：8
- `56_sport_life_heatmap.json`：12
- `03_line_stocks.json`：12
- `64_US Christmas Tree Sales _heatmap.json`：14
- `21_Number of trees sold over Yea_line.json`：14
- `04_heatmap_temp.json`：18

建议：

1. `<= 8` 行：默认不进入正式 benchmark 主集，只保留为 demo / smoke test。
2. `9-20` 行：可保留为 very-clear benchmark 或教学样例，但不适合作为主要能力评测集。
3. 小样本的 `heatmap / line` 尤其容易变成“读图问答”，而不是 agentic VA benchmark。

### 13.3 明显偏大的数据集

当前 `> 2000` 行的数据集有 28 个，其中极端值包括：

- `56_Ecommerce_Delivery_Analytics_New_heatmap.json`：100000
- `55_Ecommerce_Delivery_Analytics_New_scatter.json`：100000
- `54_Ecommerce_Delivery_Analytics_New_bar.json`：100000
- `58_Train_parallel.json`：54995
- `35_bmw_parallel.json`：43124
- `114_sport_life_parallel.json`：36354
- `53_Housing_scatter.json`：21613
- `24_vitamin_deficiency_disease_dataset_20260123_parallel (3).json`：20000

建议：

1. `> 20000` 行：默认不进入 first-wave benchmark 主集，除非实验目标明确包含大数据稳定性。
2. `5000-20000` 行：保留，但建议单独标成 `large-scale subset`。
3. `2000-5000` 行：可以保留在主集，但要验证不同 renderer 下不会因采样、聚合、布局近似产生不可控偏差。

### 13.4 建议的主 benchmark 规模带

如果目标是“跨 renderer 的 agent benchmark”，优先选：

- `20-5000` 行的数据集

原因：

- `< 20` 行通常太简单
- `> 5000` 行更容易把 benchmark 变成性能/近似误差测试

### 13.5 数据集标签

建议给 dataset 加一个 `dataset_scale_tag`：

- `demo_tiny`: `< 20`
- `small`: `20-199`
- `medium`: `200-1999`
- `large`: `2000-4999`
- `xlarge`: `5000-19999`
- `stress`: `>= 20000`

这样后续很容易区分：

- 主 benchmark 集
- cross-renderer pilot 集
- stress-test 集

---

## 14. 迁移分三期

### Phase 1: Schema 升级，不动评测执行器

目标：

- 新增 `visagentbench_v2` schema
- 自动把旧 benchmark 转成 v2 JSON
- 保留 Vega materialization

交付物：

- 转换脚本
- v2 benchmark 样例
- action name mapping 表
- canonical state 字段定义

### Phase 2: 数据规范化 + pilot subset

目标：

- 抽取统一 dataset registry
- 选 12-18 条 pilot
- 为 pilot 补至少两种 renderer materialization

交付物：

- `datasets/`
- `materializations/vega/`
- `materializations/d3/`
- 预留其他 renderer 目录

### Phase 3: Cross-renderer evaluation

目标：

- 让同一 benchmark 在多个 renderer/materialization 上跑
- 比较：
  - action 可执行性
  - perception 一致性
  - canonical state 一致性
  - answer quality 一致性

交付物：

- cross-renderer evaluation report
- mismatch taxonomy

---

## 14. 具体实施建议

### 14.1 先做脚本，不先改人工数据

第一优先应该写：

1. `legacy_to_v2` 转换脚本
2. `extract_dataset_from_spec` 数据抽取脚本
3. `legacy_tool_name_map` 映射表
4. `canonical_state_mapper` 规则

### 14.2 先允许“部分抽象”

不要一开始追求所有字段都 environment-agnostic。

允许：

- 核心字段进入 `canonical_state_checks`
- 剩余字段挂在 `legacy_renderer_checks.vega`

这会大幅降低第一阶段成本。

### 14.3 先把 benchmark 分两类

建议在 v2 中明确区分：

1. `full_corpus_vega_backed`
   全量 benchmark，当前默认仍可依赖 Vega materialization。

2. `cross_renderer_subset`
   经过额外抽象和 adapter 验证、可在多个 renderer/materialization 上跑的子集。

这样论文和实验叙事会更清晰。

---

## 15. 最低改动成本的落地结论

这个迁移不应该被定义为：

- “把 2643 个 benchmark 全部手工改写成多个 renderer 版本”

而应该定义为：

- “保留现有 benchmark 语义资产”
- “加一层 v2 抽象 schema”
- “自动迁移旧 benchmark”
- “先做一个小规模 cross-renderer 子集”

### 15.1 最终建议

立刻做的事：

1. 冻结现有 `visagentbench` 为 legacy corpus
2. 新建 `visagentbench_v2/`
3. 写自动转换脚本
4. 定义 canonical action / canonical state
5. 选 12-18 条 pilot benchmark

不建议立刻做的事：

1. 全量手工重写所有 benchmark
2. 先补齐所有 D3 版本再谈 schema
3. 强行把所有 Vega state 字段一一映射到别的环境

---

## 16. 一句话版本

**v2 迁移的重点不是“重做 benchmark”，而是“把现有 Vega benchmark 语义资产抽象出来，并先选一个小子集做多 renderer 落地”。**
