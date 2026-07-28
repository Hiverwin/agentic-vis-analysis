const selectionEffects = (sourceState) => Object.freeze([
  { sourceState, targetState: 'bar.transform', effect: 'Filter linked bar records by the selected line value.' },
  { sourceState, targetState: 'scatter.transform', effect: 'Filter linked scatter records by the selected line value.' },
  { sourceState, targetState: 'heatmap.transform', effect: 'Filter linked heatmap records by the selected line value.' },
  { sourceState, targetState: 'bar.view.highlight', effect: 'Highlight matching records in the linked bar view.' },
  { sourceState, targetState: 'scatter.view.highlight', effect: 'Highlight matching records in the linked scatter view.' },
  { sourceState, targetState: 'heatmap.view.highlight', effect: 'Highlight matching records in the linked heatmap view.' },
  { sourceState, targetState: 'bar.view.reencode', effect: 'Emphasize the selected line value in a linked bar encoding.' },
  { sourceState, targetState: 'scatter.view.reencode', effect: 'Emphasize the selected line value in a linked scatter encoding.' },
  { sourceState, targetState: 'heatmap.view.reencode', effect: 'Emphasize the selected line value in a linked heatmap encoding.' },
])

export const lineActionLinks = Object.freeze({
  'line.selectSeries': selectionEffects('line.selection.series'),
  'line.selectXValue': selectionEffects('line.selection.xValue'),
  'line.zoomXRegion': Object.freeze([
    { sourceState: 'line.view.zoom', targetState: 'bar.transform', effect: 'Filter linked bar records inside the selected x-domain.' },
    { sourceState: 'line.view.zoom', targetState: 'scatter.transform', effect: 'Filter linked scatter records inside the selected x-domain.' },
    { sourceState: 'line.view.zoom', targetState: 'heatmap.transform', effect: 'Filter linked heatmap records inside the selected x-domain.' },
    { sourceState: 'line.view.zoom', targetState: 'bar.view.zoom', effect: 'Synchronize the linked bar domain.' },
    { sourceState: 'line.view.zoom', targetState: 'scatter.view.zoom', effect: 'Synchronize the linked scatter domain.' },
    { sourceState: 'line.view.zoom', targetState: 'heatmap.view.zoom', effect: 'Synchronize the linked heatmap domain.' },
    { sourceState: 'line.view.zoom', targetState: 'line.view.zoom', effect: 'Synchronize another linked line domain.' },
  ]),
})

export default lineActionLinks
