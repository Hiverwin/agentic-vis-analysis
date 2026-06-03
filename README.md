# Agentic Visual Reframe

An agentic visualization project with:

- a FastAPI + React demo application
- an MCP chart tool server
- reusable Python SDK and React UI packages




## Quick Start

### 1. Configure environment

Ensure a local `.env` exists at the repository root and includes `OPENROUTER_API_KEY`.

### 2. Start the backend

```bash
conda activate [your_env]
pip install -r requirements.txt
python web_server.py
```

### 3. Start the frontend

```bash
conda activate [your_env]
cd frontend
npm install
npm run dev
```

### MCP Tool Server

```bash
conda activate [your_env]
python chart_tools_mcp_server.py
```

Optional local CLI debugging entrypoint:

- `main.py`

## Recommended Starting Points

If you are extending long-sequence or multi-widget features, start from:

- `core/session_manager.py`
- `web_server.py`
- `chart_tools_mcp_server.py`
- `packages/widget_sdk/`
- `packages/agent_kernel/`
