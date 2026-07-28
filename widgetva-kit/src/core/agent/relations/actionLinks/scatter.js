const brushEffects = Object.freeze([
  { sourceState: 'scatter.selection.brush', targetState: 'bar.transform', effect: 'Filter linked bar records inside the brushed interval.' },
  { sourceState: 'scatter.selection.brush', targetState: 'line.transform', effect: 'Filter linked line records inside the brushed interval.' },
  { sourceState: 'scatter.selection.brush', targetState: 'heatmap.transform', effect: 'Filter linked heatmap records inside the brushed interval.' },
  { sourceState: 'scatter.selection.brush', targetState: 'bar.view.highlight', effect: 'Highlight matching records in the linked bar view.' },
  { sourceState: 'scatter.selection.brush', targetState: 'line.view.highlight', effect: 'Highlight matching records in the linked line view.' },
  { sourceState: 'scatter.selection.brush', targetState: 'heatmap.view.highlight', effect: 'Highlight matching records in the linked heatmap view.' },
  { sourceState: 'scatter.selection.brush', targetState: 'parallelCoordinates.view.highlight', effect: 'Highlight the brushed cohort in the linked parallel-coordinates view.' },
  { sourceState: 'scatter.selection.brush', targetState: 'sankey.view.highlight', effect: 'Highlight the brushed cohort in the linked Sankey view.' },
  { sourceState: 'scatter.selection.brush', targetState: 'bar.view.zoom', effect: 'Synchronize a linked bar domain when the fields match.' },
  { sourceState: 'scatter.selection.brush', targetState: 'line.view.zoom', effect: 'Synchronize a linked line domain when the fields match.' },
  { sourceState: 'scatter.selection.brush', targetState: 'heatmap.view.zoom', effect: 'Synchronize a linked heatmap domain when the fields match.' },
  { sourceState: 'scatter.selection.brush', targetState: 'bar.view.reencode', effect: 'Emphasize the brushed cohort in a linked bar encoding.' },
  { sourceState: 'scatter.selection.brush', targetState: 'line.view.reencode', effect: 'Emphasize the brushed cohort in a linked line encoding.' },
  { sourceState: 'scatter.selection.brush', targetState: 'heatmap.view.reencode', effect: 'Emphasize the brushed cohort in a linked heatmap encoding.' },
])

export const scatterActionLinks = Object.freeze({
  'scatter.brushRegion': brushEffects,
  'scatter.zoomDomain': Object.freeze([
    { sourceState: 'scatter.view.zoom', targetState: 'bar.transform', effect: 'Filter linked bar records inside the scatter domain.' },
    { sourceState: 'scatter.view.zoom', targetState: 'line.transform', effect: 'Filter linked line records inside the scatter domain.' },
    { sourceState: 'scatter.view.zoom', targetState: 'heatmap.transform', effect: 'Filter linked heatmap records inside the scatter domain.' },
    { sourceState: 'scatter.view.zoom', targetState: 'bar.view.zoom', effect: 'Synchronize the linked bar domain.' },
    { sourceState: 'scatter.view.zoom', targetState: 'line.view.zoom', effect: 'Synchronize the linked line domain.' },
    { sourceState: 'scatter.view.zoom', targetState: 'heatmap.view.zoom', effect: 'Synchronize the linked heatmap domain.' },
  ]),
})

export default scatterActionLinks
