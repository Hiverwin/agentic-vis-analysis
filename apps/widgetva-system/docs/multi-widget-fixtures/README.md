# Shared-source multi-widget fixtures

These three standalone Vega-Lite scripts all generate the same deterministic 192-row museum visitation dataset:

- `01_region_bar.vl.js`
- `02_monthly_line.vl.js`
- `03_spend_scatter.vl.js`

Use them in `widgetva-system` by pasting one whole file at a time into the visualization loader, clicking `Render chart`, then `Bind chart`. After binding all three, the workspace has three widgets backed by the same source schema:

- `date`, `year`, `month`, `quarter`
- `museum`, `region`, `museum_type`
- `visitors`, `marketing_spend`, `education_events`, `school_visits`, `ticket_revenue`, `satisfaction`

Suggested link experiments:

- Bar region selection -> filter line and scatter by `region`.
- Line month selection -> filter bar and scatter by `date` or derived month.
- Scatter brush on `marketing_spend` and `visitors` -> filter bar and line by numeric predicates.
