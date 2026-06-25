# External VA Demo (Isolated)

这个目录模拟“别人自己的 VA 系统”，通过 `import` 你仓库里的模块来分析他们的 `vega_spec`。

## What It Demonstrates

- 外部系统前端输入 `query + vega_spec`
- 外部系统后端调用：
  - `from packages.widget_sdk import create_custom_scatter_analyzer`
- 通过 MCP 工具执行分析并返回：
  - `answer`
  - `tool_calls`
- `mode` 固定为 `protocol`（复用完整 agent 能力）

示例请求：

```json
{
  "query": "What is the correlation trend in this scatter plot?",
  "vega_spec": { "...": "..." },
  "input_mode": "text_and_image",
  "max_iterations": 6
}
```

`model_name` can be omitted. Backend defaults to `gpt_protocol`.

## Run Backend

在仓库根目录运行：

```bash
uvicorn external_va_demo.backend:app --reload --port 9000
```

## Run Frontend (Next.js)

打开另一个终端，在仓库根目录运行：

```bash
cd external_va_demo/frontend_next
npm install
npm run dev
```

然后打开：

- http://127.0.0.1:9100

页面包含四区布局（A/B/C/D）并可切换多种图表 spec 进行 imported-agent 分析。

## Notes

- 该 demo 完全独立在 `external_va_demo/` 下，不会改动主工程结构或启动流程。
- 自定义模式只要求替换 `vega_spec`，不使用工具白名单。
