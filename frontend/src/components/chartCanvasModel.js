export function resolveChartCanvasSpec({ spec, widgetState }) {
  if (spec && typeof spec === 'object') return spec
  if (widgetState?.rawSpec && typeof widgetState.rawSpec === 'object') return widgetState.rawSpec
  return null
}
