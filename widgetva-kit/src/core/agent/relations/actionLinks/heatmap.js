const selectionEffects = (sourceState) => Object.freeze([
  { sourceState, targetState: 'bar.transform', effect: 'Filter linked bar records represented by the selected heatmap region.' },
  { sourceState, targetState: 'scatter.transform', effect: 'Filter linked scatter records represented by the selected heatmap region.' },
  { sourceState, targetState: 'line.transform', effect: 'Filter linked line records represented by the selected heatmap region.' },
  { sourceState, targetState: 'bar.view.highlight', effect: 'Highlight the selected heatmap region in the linked bar view.' },
  { sourceState, targetState: 'scatter.view.highlight', effect: 'Highlight the selected heatmap region in the linked scatter view.' },
  { sourceState, targetState: 'line.view.highlight', effect: 'Highlight the selected heatmap region in the linked line view.' },
  { sourceState, targetState: 'scatter.view.reencode', effect: 'Emphasize the selected heatmap region in a linked scatter encoding.' },
])

export const heatmapActionLinks = Object.freeze({
  'heatmap.selectCell': selectionEffects('heatmap.selection.cell'),
  'heatmap.selectSubmatrix': selectionEffects('heatmap.selection.submatrix'),
})

export default heatmapActionLinks
