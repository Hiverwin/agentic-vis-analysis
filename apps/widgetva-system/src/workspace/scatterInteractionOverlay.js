function clampRatio(value) {
  if (!Number.isFinite(value)) return 0
  return Math.min(Math.max(value, 0), 1)
}

function interpolate(domain = [0, 1], ratio = 0) {
  const [min, max] = Array.isArray(domain) && domain.length === 2 ? domain : [0, 1]
  return min + ((max - min) * clampRatio(ratio))
}

export function buildScatterBrushFromDrag({
  dragRect = null,
  bounds = null,
  xDomain = [0, 1],
  yDomain = [0, 1],
  minPixels = 6,
} = {}) {
  if (!dragRect || !bounds || bounds.width <= 0 || bounds.height <= 0) return null
  const width = Math.abs((dragRect.right ?? 0) - (dragRect.left ?? 0))
  const height = Math.abs((dragRect.bottom ?? 0) - (dragRect.top ?? 0))
  if (width < minPixels || height < minPixels) return null

  const leftRatio = clampRatio((Math.min(dragRect.left, dragRect.right) - bounds.left) / bounds.width)
  const rightRatio = clampRatio((Math.max(dragRect.left, dragRect.right) - bounds.left) / bounds.width)
  const topRatio = clampRatio((Math.min(dragRect.top, dragRect.bottom) - bounds.top) / bounds.height)
  const bottomRatio = clampRatio((Math.max(dragRect.top, dragRect.bottom) - bounds.top) / bounds.height)

  return {
    horsepower: [
      interpolate(xDomain, leftRatio),
      interpolate(xDomain, rightRatio),
    ],
    mpg: [
      interpolate(yDomain, 1 - bottomRatio),
      interpolate(yDomain, 1 - topRatio),
    ],
  }
}
