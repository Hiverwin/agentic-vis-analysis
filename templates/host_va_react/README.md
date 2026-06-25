# Host VA React Template

This template shows how a host VA project embeds the Agent Widget package.
It is intended for internal integration testing, not mandatory partner delivery.

## Quick start

```bash
npm install
npm run dev
```

Note: this template currently references the local workspace package:
`file:../../packages/agent_widget_ui`.
For external partners, replace it with the published npm version.
For local linked-package development, `vite.config.ts` dedupes `react/react-dom`
to avoid multi-react runtime crashes.

Set environment variables:

- `VITE_AGENT_API_BASE_URL`: API base url, example `http://127.0.0.1:9000`

## Integration checklist

- Replace `exampleSpec` with your live widget state mapping (`vega_spec`).
- Keep your own chart rendering in the host panel.
- Place `<AgentWidget />` in your analysis panel or side drawer.
- Add `getAuthToken` in `AgentWidget` props when your API requires auth.

