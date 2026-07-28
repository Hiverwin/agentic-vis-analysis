import {
  updateRepresentativeSpec,
} from '../specTree.js'
import { ensureObjectSpec, readMarkType } from '../specModel.js'
import {
  replaceFilterTransformForField,
} from '../specMutators.js'
import { datumRef, expressionEqualsAny } from './specActionShared.js'

function isHeatmapFamilySpec(spec) {
  return readMarkType(spec?.mark) === 'rect'
    && spec?.encoding
    && typeof spec.encoding === 'object'
    && !Array.isArray(spec.encoding)
}

function updateHeatmap(spec, updater) {
  return updateRepresentativeSpec(
    spec,
    isHeatmapFamilySpec,
    updater,
    'No representative heatmap subview could be found in the active spec.',
  )
}

function resolveHeatmapAxisFieldAlias(spec, requestedField, axis) {
  if (typeof requestedField !== 'string' || requestedField.length === 0) return null
  const encodingField = typeof spec?.encoding?.[axis]?.field === 'string' ? spec.encoding[axis].field : null
  if (!encodingField) return requestedField
  if (requestedField === axis || requestedField === encodingField) return encodingField
  return requestedField
}

function readAxisFields(heatmapSpec) {
  return {
    xField: heatmapSpec?.encoding?.x?.field || null,
    yField: heatmapSpec?.encoding?.y?.field || null,
    colorField: heatmapSpec?.encoding?.color?.field || null,
  }
}

export function executeVegaLiteHeatmapFilterCells(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for heatmap filtering.')
  return updateHeatmap(spec, (heatmapSpec) => {
    const axisFields = readAxisFields(heatmapSpec)
    const xField = resolveHeatmapAxisFieldAlias(heatmapSpec, params.xField || axisFields.xField, 'x')
    const yField = resolveHeatmapAxisFieldAlias(heatmapSpec, params.yField || axisFields.yField, 'y')
    const xValues = Array.isArray(params.xValues) ? params.xValues.filter((value) => value != null) : []
    const yValues = Array.isArray(params.yValues) ? params.yValues.filter((value) => value != null) : []
    const transforms = Array.isArray(heatmapSpec.transform) ? heatmapSpec.transform : []
    const nextTransforms = transforms.filter((transform) => transform?._widgetvaTag !== 'heatmap.filterCells')
    if (xField && xValues.length > 0) {
      nextTransforms.push({ filter: { field: xField, oneOf: xValues }, _widgetvaTag: 'heatmap.filterCells' })
    }
    if (yField && yValues.length > 0) {
      nextTransforms.push({ filter: { field: yField, oneOf: yValues }, _widgetvaTag: 'heatmap.filterCells' })
    }
    return { ...heatmapSpec, transform: nextTransforms }
  })
}

export function executeVegaLiteHeatmapDrilldownAxis(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for heatmap drill-down.')
  return updateHeatmap(spec, (heatmapSpec) => {
    const axis = params.axis === 'y' ? 'y' : 'x'
    const field = resolveHeatmapAxisFieldAlias(heatmapSpec, params.field || axis, axis)
    const value = params.value
    if (!field || value == null) throw new Error('heatmap.drilldownAxis requires field/axis and value.')
    return {
      ...heatmapSpec,
      transform: replaceFilterTransformForField(heatmapSpec.transform, field, {
        filter: { field, oneOf: [value] },
        _widgetvaTag: 'heatmap.drilldownAxis',
      }),
      _heatmap_drilldown_state: { axis, field, value },
    }
  })
}

export function executeVegaLiteHeatmapResetDrilldown(spec) {
  ensureObjectSpec(spec, 'No active base spec is available for resetting heatmap drill-down.')
  return updateHeatmap(spec, (heatmapSpec) => {
    const state = heatmapSpec._heatmap_drilldown_state
    const field = state?.field || heatmapSpec.encoding?.x?.field || heatmapSpec.encoding?.y?.field
    const { _heatmap_drilldown_state: _removed, ...rest } = heatmapSpec
    return {
      ...rest,
      transform: field ? replaceFilterTransformForField(heatmapSpec.transform, field, null) : heatmapSpec.transform,
    }
  })
}

export function executeVegaLiteHeatmapAddMarginalBars(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for heatmap marginal bars.')
  return updateHeatmap(spec, (heatmapSpec) => {
    const { xField, yField, colorField } = readAxisFields(heatmapSpec)
    if (!xField || !yField || !colorField) throw new Error('heatmap.addMarginalBars requires x, y, and color fields.')
    const op = params.op || params.aggregate || 'sum'
    const barSize = Number.isFinite(params.barSize) ? params.barSize : 70
    const barColor = params.barColor || '#666666'
    const showTop = params.showTop !== false
    const showRight = params.showRight !== false
    const baseHeatmap = {
      ...(heatmapSpec.data ? { data: heatmapSpec.data } : {}),
      mark: heatmapSpec.mark || 'rect',
      encoding: heatmapSpec.encoding,
      ...(Array.isArray(heatmapSpec.transform) ? { transform: heatmapSpec.transform } : {}),
      ...(heatmapSpec.width ? { width: heatmapSpec.width } : {}),
      ...(heatmapSpec.height ? { height: heatmapSpec.height } : {}),
    }
    const topBar = {
      _widgetvaTag: 'heatmap.addMarginalBars.top',
      ...(heatmapSpec.data ? { data: heatmapSpec.data } : {}),
      mark: { type: 'bar', color: barColor },
      height: barSize,
      encoding: {
        x: { ...(heatmapSpec.encoding?.x || {}), axis: null },
        y: { aggregate: op, field: colorField, type: 'quantitative', title: `${op} of ${colorField}` },
      },
    }
    const rightBar = {
      _widgetvaTag: 'heatmap.addMarginalBars.right',
      ...(heatmapSpec.data ? { data: heatmapSpec.data } : {}),
      mark: { type: 'bar', color: barColor },
      width: barSize,
      encoding: {
        y: { ...(heatmapSpec.encoding?.y || {}), axis: null },
        x: { aggregate: op, field: colorField, type: 'quantitative', title: `${op} of ${colorField}` },
      },
    }
    const body = showRight ? { hconcat: [baseHeatmap, rightBar], spacing: 8 } : baseHeatmap
    const composed = showTop ? { vconcat: [topBar, body], spacing: 8 } : body
    return {
      ...composed,
      ...(heatmapSpec.$schema ? { $schema: heatmapSpec.$schema } : {}),
      ...(heatmapSpec.title ? { title: heatmapSpec.title } : {}),
      _heatmap_marginal_state: { showTop, showRight, op },
    }
  })
}

export function executeVegaLiteHeatmapHighlightRegion(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for heatmap region highlighting.')
  return updateHeatmap(spec, (heatmapSpec) => {
    const { xField, yField } = readAxisFields(heatmapSpec)
    const xValues = Array.isArray(params.xValues) ? params.xValues.filter((value) => value != null) : []
    const yValues = Array.isArray(params.yValues) ? params.yValues.filter((value) => value != null) : []
    const tests = []
    if (xField && xValues.length > 0) tests.push(expressionEqualsAny(xField, xValues))
    if (yField && yValues.length > 0) tests.push(expressionEqualsAny(yField, yValues))
    if (tests.length === 0) throw new Error('heatmap.highlightRegion requires xValues or yValues.')
    return {
      ...heatmapSpec,
      encoding: {
        ...(heatmapSpec.encoding || {}),
        opacity: {
          condition: { test: tests.join(' && '), value: 1 },
          value: 0.2,
        },
      },
      _heatmap_highlight_state: { xValues, yValues },
    }
  })
}

export function executeVegaLiteHeatmapAdjustColorScale(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for heatmap color scale updates.')
  const domain = Array.isArray(params.domain) ? params.domain : [params.min, params.max].filter((value) => value != null)
  return updateHeatmap(spec, (heatmapSpec) => ({
    ...heatmapSpec,
    encoding: {
      ...(heatmapSpec.encoding || {}),
      color: {
        ...(heatmapSpec.encoding?.color || {}),
        scale: {
          ...(heatmapSpec.encoding?.color?.scale || {}),
          ...(domain.length === 2 ? { domain } : {}),
          ...(params.scheme ? { scheme: params.scheme } : {}),
        },
      },
    },
  }))
}

export function executeVegaLiteHeatmapThresholdMask(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for heatmap threshold mask.')
  return updateHeatmap(spec, (heatmapSpec) => {
    const { colorField } = readAxisFields(heatmapSpec)
    const hasMin = params.minValue != null && params.minValue !== ''
    const hasMax = params.maxValue != null && params.maxValue !== ''
    const minValue = hasMin ? Number(params.minValue) : null
    const maxValue = hasMax ? Number(params.maxValue) : null
    if (colorField && ((hasMin && Number.isFinite(minValue)) || (hasMax && Number.isFinite(maxValue)))) {
      const tests = [
        ...(Number.isFinite(minValue) ? [`${datumRef(colorField)} >= ${minValue}`] : []),
        ...(Number.isFinite(maxValue) ? [`${datumRef(colorField)} <= ${maxValue}`] : []),
      ]
      return {
        ...heatmapSpec,
        encoding: {
          ...(heatmapSpec.encoding || {}),
          opacity: {
            condition: { test: tests.join(' && '), value: 1 },
            value: Number.isFinite(params.outsideOpacity) ? params.outsideOpacity : 0.1,
          },
        },
        _heatmap_threshold_state: { colorField, minValue, maxValue, mode: 'range' },
      }
    }

    const threshold = Number(params.threshold)
    if (!colorField || !Number.isFinite(threshold)) throw new Error('heatmap.thresholdMask requires threshold/range and color field.')
    const op = params.mode === 'below' ? '>=' : '<='
    return {
      ...heatmapSpec,
      transform: replaceFilterTransformForField(heatmapSpec.transform, colorField, {
        filter: `datum[${JSON.stringify(colorField)}] ${op} ${threshold}`,
        _widgetvaTag: 'heatmap.thresholdMask',
      }),
      _heatmap_threshold_state: { colorField, threshold, mode: params.mode || 'above' },
    }
  })
}

export function executeVegaLiteHeatmapFilterCellsByRegion(spec, params = {}) {
  return executeVegaLiteHeatmapFilterCells(spec, {
    xValues: params.xValues || params.columns || params.x,
    yValues: params.yValues || params.rows || params.y,
  })
}

export function executeVegaLiteHeatmapHighlightRegionByValue(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for heatmap value highlighting.')
  return updateHeatmap(spec, (heatmapSpec) => {
    const { colorField } = readAxisFields(heatmapSpec)
    const hasMin = params.minValue != null && params.minValue !== ''
    const hasMax = params.maxValue != null && params.maxValue !== ''
    const minValue = hasMin ? Number(params.minValue) : null
    const maxValue = hasMax ? Number(params.maxValue) : null
    if (!colorField || (hasMin && !Number.isFinite(minValue)) || (hasMax && !Number.isFinite(maxValue)) || (!hasMin && !hasMax)) {
      throw new Error('heatmap.highlightRegionByValue requires minValue and/or maxValue plus a color field.')
    }
    const tests = [
      ...(Number.isFinite(minValue) ? [`${datumRef(colorField)} >= ${minValue}`] : []),
      ...(Number.isFinite(maxValue) ? [`${datumRef(colorField)} <= ${maxValue}`] : []),
    ]
    return {
      ...heatmapSpec,
      encoding: {
        ...(heatmapSpec.encoding || {}),
        opacity: {
          condition: { test: tests.join(' && '), value: 1 },
          value: Number.isFinite(params.outsideOpacity) ? params.outsideOpacity : 0.12,
        },
      },
      _heatmap_value_highlight_state: { colorField, minValue, maxValue },
    }
  })
}

export function executeVegaLiteHeatmapClusterRowsCols(spec, params = {}) {
  ensureObjectSpec(spec, 'No active base spec is available for heatmap clustering.')
  return updateHeatmap(spec, (heatmapSpec) => ({
    ...heatmapSpec,
    encoding: {
      ...(heatmapSpec.encoding || {}),
      x: { ...(heatmapSpec.encoding?.x || {}), sort: params.xOrder || params.columnOrder || undefined },
      y: { ...(heatmapSpec.encoding?.y || {}), sort: params.yOrder || params.rowOrder || undefined },
    },
    _heatmap_cluster_state: {
      xOrder: params.xOrder || params.columnOrder || null,
      yOrder: params.yOrder || params.rowOrder || null,
    },
  }))
}

export function executeVegaLiteHeatmapTranspose(spec) {
  ensureObjectSpec(spec, 'No active base spec is available for heatmap transpose.')
  return updateHeatmap(spec, (heatmapSpec) => ({
    ...heatmapSpec,
    encoding: {
      ...(heatmapSpec.encoding || {}),
      x: heatmapSpec.encoding?.y,
      y: heatmapSpec.encoding?.x,
    },
    _heatmap_transpose_state: { transposed: !heatmapSpec._heatmap_transpose_state?.transposed },
  }))
}
