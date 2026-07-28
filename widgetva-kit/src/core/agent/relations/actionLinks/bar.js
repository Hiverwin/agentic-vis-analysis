const categorySelectionEffects = Object.freeze([
  { sourceState: 'bar.selection.category', targetState: 'scatter.transform', effect: 'Filter linked scatter records by the selected category.' },
  { sourceState: 'bar.selection.category', targetState: 'line.transform', effect: 'Filter linked line records by the selected category.' },
  { sourceState: 'bar.selection.category', targetState: 'heatmap.transform', effect: 'Filter linked heatmap records by the selected category.' },
  { sourceState: 'bar.selection.category', targetState: 'scatter.view.highlight', effect: 'Highlight the selected category in the linked scatter view.' },
  { sourceState: 'bar.selection.category', targetState: 'line.view.highlight', effect: 'Highlight the selected category in the linked line view.' },
  { sourceState: 'bar.selection.category', targetState: 'heatmap.view.highlight', effect: 'Highlight the selected category in the linked heatmap view.' },
  { sourceState: 'bar.selection.category', targetState: 'parallelCoordinates.view.highlight', effect: 'Highlight the selected category in the linked parallel-coordinates view.' },
  { sourceState: 'bar.selection.category', targetState: 'sankey.view.highlight', effect: 'Highlight the selected category in the linked Sankey view.' },
  { sourceState: 'bar.selection.category', targetState: 'scatter.view.reencode', effect: 'Emphasize the selected category in a linked scatter encoding.' },
  { sourceState: 'bar.selection.category', targetState: 'line.view.reencode', effect: 'Emphasize the selected category in a linked line encoding.' },
  { sourceState: 'bar.selection.category', targetState: 'heatmap.view.reencode', effect: 'Emphasize the selected category in a linked heatmap encoding.' },
])

export const barActionLinks = Object.freeze({
  'bar.clickCategory': categorySelectionEffects,
  'bar.selectCategory': categorySelectionEffects,
  'bar.sortBars': Object.freeze([
    { sourceState: 'bar.view.sort', targetState: 'heatmap.view.reencode', effect: 'Project the bar ordering into a linked heatmap encoding.' },
    { sourceState: 'bar.view.sort', targetState: 'scatter.view.reencode', effect: 'Project the bar ordering into a linked scatter encoding.' },
    { sourceState: 'bar.view.sort', targetState: 'line.view.reencode', effect: 'Project the bar ordering into a linked line encoding.' },
  ]),
})

export default barActionLinks
