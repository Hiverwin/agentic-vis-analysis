import { barActionLinks } from './bar.js'
import { scatterActionLinks } from './scatter.js'
import { lineActionLinks } from './line.js'
import { heatmapActionLinks } from './heatmap.js'
import { parallelCoordinatesActionLinks } from './parallelCoordinates.js'
import { sankeyActionLinks } from './sankey.js'

export const actionLinks = Object.freeze({
  bar: barActionLinks,
  scatter: scatterActionLinks,
  line: lineActionLinks,
  heatmap: heatmapActionLinks,
  parallelCoordinates: parallelCoordinatesActionLinks,
  sankey: sankeyActionLinks,
})

export default actionLinks
