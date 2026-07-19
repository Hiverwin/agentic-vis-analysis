import { barPlaybook } from '../../../widgets/families/bar/index.js'
import { heatmapPlaybook } from '../../../widgets/families/heatmap/index.js'
import { linePlaybook } from '../../../widgets/families/line/index.js'
import { parallelCoordinatesPlaybook } from '../../../widgets/families/parallelCoordinates/index.js'
import { sankeyPlaybook } from '../../../widgets/families/sankey/index.js'
import { scatterPlaybook } from '../../../widgets/families/scatter/index.js'

export const WIDGET_ANALYSIS_PLAYBOOKS = Object.freeze({
  bar: barPlaybook,
  line: linePlaybook,
  scatter: scatterPlaybook,
  heatmap: heatmapPlaybook,
  parallelCoordinates: parallelCoordinatesPlaybook,
  sankey: sankeyPlaybook,
})

export function buildWidgetAnalysisPlaybooks(widgetKinds = []) {
  const resolvedKinds = Array.isArray(widgetKinds)
    ? widgetKinds.filter((kind, index, kinds) => typeof kind === 'string' && kind.length > 0 && kinds.indexOf(kind) === index)
    : []

  return Object.fromEntries(
    resolvedKinds
      .filter((kind) => Object.hasOwn(WIDGET_ANALYSIS_PLAYBOOKS, kind))
      .map((kind) => [kind, WIDGET_ANALYSIS_PLAYBOOKS[kind]]),
  )
}
