export const sankeyActionLinks = Object.freeze({
  'sankey.focusFlow': Object.freeze([
    { sourceState: 'sankey.selection.flow', targetState: 'bar.transform', effect: 'Filter linked bar records to the selected flow.' },
    { sourceState: 'sankey.selection.flow', targetState: 'line.transform', effect: 'Filter linked line records to the selected flow.' },
    { sourceState: 'sankey.selection.flow', targetState: 'scatter.view.highlight', effect: 'Highlight the selected flow in the linked scatter view.' },
  ]),
  'sankey.selectAggregateNode': Object.freeze([
    { sourceState: 'sankey.selection.node', targetState: 'bar.transform', effect: 'Filter linked bar records to the selected node.' },
    { sourceState: 'sankey.selection.node', targetState: 'line.transform', effect: 'Filter linked line records to the selected node.' },
    { sourceState: 'sankey.selection.node', targetState: 'scatter.view.highlight', effect: 'Highlight the selected node in the linked scatter view.' },
  ]),
  'sankey.collapseNodes': Object.freeze([
    { sourceState: 'sankey.view.addRemove', targetState: 'bar.view.reencode', effect: 'Project the Sankey grouping into the linked bar encoding.' },
  ]),
})

export default sankeyActionLinks
