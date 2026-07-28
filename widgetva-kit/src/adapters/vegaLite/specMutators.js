export function replaceTaggedLayer(layers, tag, nextLayer) {
  const safeLayers = Array.isArray(layers) ? layers : []
  const nextLayers = safeLayers.filter((layer) => layer?._widgetvaTag !== tag)
  return nextLayer ? [...nextLayers, nextLayer] : nextLayers
}

export function replaceTaggedTransform(transforms, tag, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => transform?._widgetvaTag !== tag)
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

export function replaceFilterTransformForField(transforms, field, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => {
    const filter = transform?.filter
    const filterField = filter?.field || filter?.not?.field || null
    return filterField !== field
  })
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}

export function replaceAggregateTransforms(transforms, nextTransform) {
  const safeTransforms = Array.isArray(transforms) ? transforms : []
  const nextTransforms = safeTransforms.filter((transform) => !Array.isArray(transform?.aggregate))
  return nextTransform ? [...nextTransforms, nextTransform] : nextTransforms
}
