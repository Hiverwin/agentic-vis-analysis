import {
  makeActionDescriptor,
  makeDomainEffect,
  makeFilterEffect,
  makeHighlightEffect,
  makeSelectionEffect,
} from '../../../contracts/action-contracts.js'

function makeScatterActionDescriptor(descriptor) {
  return makeActionDescriptor(descriptor)
}

function readMarkType(mark) {
  return typeof mark === 'string' ? mark : mark?.type || null
}

function isScatterFamilyMark(mark) {
  const markType = readMarkType(mark)
  return markType === 'point' || markType === 'circle' || markType === 'square'
}

function collectNestedScatterSpecs(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return []
  const nested = []
  for (const key of ['layer', 'vconcat', 'hconcat', 'concat']) {
    if (Array.isArray(spec?.[key])) {
      nested.push(...spec[key].filter((entry) => entry && typeof entry === 'object'))
    }
  }
  if (spec?.spec && typeof spec.spec === 'object' && !Array.isArray(spec.spec)) {
    nested.push(spec.spec)
  }
  return nested
}

function findRepresentativeScatterSpec(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) return null
  if (isScatterFamilyMark(spec?.mark) && spec?.encoding && typeof spec.encoding === 'object') {
    return spec
  }
  if (Array.isArray(spec?.layer)) {
    const layeredMatch = spec.layer.find((entry) => (
      entry && typeof entry === 'object' && isScatterFamilyMark(entry?.mark) && entry?.encoding && typeof entry.encoding === 'object'
    ))
    if (layeredMatch) return layeredMatch
  }
  for (const child of collectNestedScatterSpecs(spec)) {
    const match = findRepresentativeScatterSpec(child)
    if (match) return match
  }
  return null
}

function resolveScatterRootEncoding(spec) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
    return {}
  }

  if (spec.layer?.[0]?.encoding && typeof spec.layer[0].encoding === 'object' && !Array.isArray(spec.layer[0].encoding)) {
    return spec.layer[0].encoding
  }

  if (spec.encoding && typeof spec.encoding === 'object' && !Array.isArray(spec.encoding)) {
    return spec.encoding
  }

  return {}
}

export function buildScatterActionDescriptors({ widgetSpec = null } = {}) {
  const descriptors = [
    makeScatterActionDescriptor({
      name: 'scatter.brushRegion',
      title: 'Brush region',
      category: 'selection',
      description: 'Select points inside a data-space rectangle on the scatterplot.',
      effects: [makeSelectionEffect(null, 'Updates the active scatter selection.')],
      paramsSchema: {
        type: 'object',
        properties: {
          xField: { type: 'string' },
          yField: { type: 'string' },
          xRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          yRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
        },
        required: ['xField', 'yField', 'xRange', 'yRange'],
      },
      examples: [
        {
          userGoal: 'Brush a region of interest in the scatterplot.',
          params: {
            xField: 'Horsepower',
            yField: 'Miles_per_Gallon',
            xRange: [80, 160],
            yRange: [20, 35],
          },
        },
      ],
    }),
    makeScatterActionDescriptor({
      name: 'scatter.selectRegion',
      title: 'Select region',
      category: 'selection',
      description: 'Select points inside a data-space rectangle on the scatterplot and keep the region as the active interval selection.',
      effects: [makeSelectionEffect(null, 'Keeps the brushed region as the active scatter selection.')],
      paramsSchema: {
        type: 'object',
        properties: {
          xField: { type: 'string' },
          yField: { type: 'string' },
          xRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
          yRange: { type: 'array', items: { type: 'number' }, minItems: 2, maxItems: 2 },
        },
        required: ['xField', 'yField', 'xRange', 'yRange'],
      },
      examples: [
        {
          userGoal: 'Select a dense rectangle in the scatterplot for downstream inspection.',
          params: {
            xField: 'Horsepower',
            yField: 'Miles_per_Gallon',
            xRange: [80, 160],
            yRange: [20, 35],
          },
        },
      ],
    }),
    makeScatterActionDescriptor({
      name: 'scatter.zoomDomain',
      title: 'Zoom domain',
      category: 'viewTransform',
      description: 'Zoom the scatterplot to a specific x and/or y domain. Use null for an open lower or upper bound when only one side of the domain is known.',
      effects: [makeDomainEffect(null, 'Updates the scatterplot view domain.')],
      paramsSchema: {
        type: 'object',
        properties: {
          xDomain: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: {
              anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }],
            },
          },
          yDomain: {
            type: 'array',
            minItems: 2,
            maxItems: 2,
            items: {
              anyOf: [{ type: 'number' }, { type: 'string' }, { type: 'null' }],
            },
          },
        },
        anyOf: [{ required: ['xDomain'] }, { required: ['yDomain'] }],
      },
      examples: [
        {
          userGoal: 'Zoom into the high-risk cluster region of the scatterplot.',
          params: {
            xDomain: [80, 160],
            yDomain: [20, 35],
          },
        },
        {
          userGoal: 'Zoom to all points with marketing spend above 3000 while leaving the upper x bound open.',
          params: {
            xDomain: [3000, null],
          },
        },
      ],
    }),
    makeScatterActionDescriptor({
      name: 'scatter.filterCategorical',
      title: 'Filter categories',
      category: 'dataTransform',
      description: 'Remove one or more categories from the current scatterplot by inserting a categorical exclusion transform.',
      effects: [makeFilterEffect(null, 'Filters categories from the scatterplot data view.')],
      paramsSchema: {
        type: 'object',
        properties: {
          categoriesToRemove: {
            type: 'array',
            items: {
              anyOf: [{ type: 'string' }, { type: 'number' }],
            },
          },
          field: { type: 'string' },
        },
        required: ['categoriesToRemove', 'field'],
      },
      examples: [
        {
          userGoal: 'Exclude one origin category from the scatterplot.',
          params: {
            field: 'Origin',
            categoriesToRemove: ['USA'],
          },
        },
      ],
    }),
    makeScatterActionDescriptor({
      name: 'scatter.identifyClusters',
      title: 'Identify clusters',
      category: 'visualMapping',
      description: 'Cluster visible scatter points in the frontend and recolor the scatterplot by the derived cluster labels.',
      effects: [makeHighlightEffect(null, 'Highlights or recolors visible clusters in the scatterplot.')],
      paramsSchema: {
        type: 'object',
        properties: {
          nClusters: { type: 'integer', minimum: 2, maximum: 50, default: 3 },
          method: { type: 'string', enum: ['kmeans'], default: 'kmeans' },
          xField: { type: 'string', minLength: 1 },
          yField: { type: 'string', minLength: 1 },
        },
        required: ['xField', 'yField'],
      },
      examples: [
        {
          userGoal: 'Color the visible scatter points by their inferred clusters.',
          params: { nClusters: 3, method: 'kmeans', xField: 'Horsepower', yField: 'Miles_per_Gallon' },
        },
      ],
    }),
    makeScatterActionDescriptor({
      name: 'scatter.showRegression',
      title: 'Show regression',
      category: 'visualMapping',
      description: 'Add or replace a regression-line overlay on the current scatterplot using the active x/y encodings.',
      effects: [makeHighlightEffect(null, 'Adds or replaces a regression overlay on the scatterplot.')],
      paramsSchema: {
        type: 'object',
        properties: {
          method: { type: 'string', enum: ['linear'], default: 'linear' },
          xField: { type: 'string', minLength: 1 },
          yField: { type: 'string', minLength: 1 },
        },
        required: ['xField', 'yField'],
      },
      examples: [
        {
          userGoal: 'Overlay a regression line on the scatterplot to inspect the overall trend.',
          params: { method: 'linear', xField: 'Horsepower', yField: 'Miles_per_Gallon' },
        },
      ],
    }),
  ]

  if (!widgetSpec) {
    return descriptors
  }

  const representativeSpec = findRepresentativeScatterSpec(widgetSpec)
  const rootEncoding = resolveScatterRootEncoding(representativeSpec)
  const xType = rootEncoding?.x?.type || null
  const yType = rootEncoding?.y?.type || null
  const hasQuantitativeXY = xType === 'quantitative' && yType === 'quantitative'

  return descriptors.filter((descriptor) => {
    if (!descriptor?.name) return true
    if (
      descriptor.name === 'scatter.brushRegion'
      || descriptor.name === 'scatter.selectRegion'
      || descriptor.name === 'scatter.identifyClusters'
      || descriptor.name === 'scatter.showRegression'
    ) {
      return hasQuantitativeXY
    }
    return true
  })
}
