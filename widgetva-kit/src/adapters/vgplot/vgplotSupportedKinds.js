export const VGPLOT_SUPPORTED_WIDGET_KINDS = Object.freeze([
  'scatter',
  'bar',
  'line',
  'heatmap',
])

export function isVgplotSupportedWidgetKind(widgetKind) {
  return typeof widgetKind === 'string' && VGPLOT_SUPPORTED_WIDGET_KINDS.includes(widgetKind)
}
