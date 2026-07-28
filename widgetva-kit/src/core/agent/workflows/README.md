# Planner workflows

This directory is the flat registry for three planner-facing groups:

- `single.js`: single-widget workflow catalog grouped by widget family.
- `multi.js`: cross-widget workflow catalog grouped by `2V`/`3V` view count.
- `analysisToAction.js`: analysis-intent handbook grouped by widget family.

`index.js` is the only lookup surface benchmark/planner code needs.
There are no nested workflow catalogs: every planner-facing multi-widget workflow lives in `multi.js`.

Formal workflow IDs use `WF-{view-count}-{semantic-name}-{sequence}`, for
example `WF-1V-SUBGROUP-RELATIONSHIP-MEASUREMENT-01`. Normalized workflow
objects are stored directly in the catalog files; there is no runtime
normalization layer. Single and multi-widget entries share the same fields;
`families` contains one family for single-widget workflows and multiple
families for cross-widget workflows. `slug` stores the human-readable
`<family>.<name>` form, while `id` remains the stable benchmark reference.

Analysis-to-action handbook entries use the parallel `AT-1V-{semantic}-{sequence}`
format and can be retrieved with `getAnalysisToAction(id)`.
