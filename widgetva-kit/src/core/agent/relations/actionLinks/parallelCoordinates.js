export const parallelCoordinatesActionLinks = Object.freeze({
  'parallelCoordinates.selectCohort': Object.freeze([
    { sourceState: 'parallelCoordinates.selection.cohort', targetState: 'scatter.transform', effect: 'Filter linked scatter records to the selected multidimensional cohort.' },
    { sourceState: 'parallelCoordinates.selection.cohort', targetState: 'bar.view.highlight', effect: 'Highlight the selected multidimensional cohort in the linked bar view.' },
  ]),
  'parallelCoordinates.selectRecord': Object.freeze([
    { sourceState: 'parallelCoordinates.selection.record', targetState: 'scatter.transform', effect: 'Filter linked scatter records to the selected record.' },
    { sourceState: 'parallelCoordinates.selection.record', targetState: 'bar.view.highlight', effect: 'Highlight the selected record in the linked bar view.' },
    { sourceState: 'parallelCoordinates.selection.record', targetState: 'scatter.view.highlight', effect: 'Highlight the selected record in the linked scatter view.' },
  ]),
})

export default parallelCoordinatesActionLinks
