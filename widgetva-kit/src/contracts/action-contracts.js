import { QUERY_SCOPE_SCHEMA } from '../schemas/query-scope.schema.js'

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value))
}

function withActionQueryScope(paramsSchema) {
  if (!paramsSchema || typeof paramsSchema !== 'object' || Array.isArray(paramsSchema)) {
    return {
      type: 'object',
      properties: {
        queryScope: QUERY_SCOPE_SCHEMA,
      },
    }
  }
  return {
    ...cloneValue(paramsSchema),
    properties: {
      ...(cloneValue(paramsSchema.properties) || {}),
      queryScope: QUERY_SCOPE_SCHEMA,
    },
  }
}

export function makeActionDescriptor(descriptor) {
  const paramsSchema = withActionQueryScope(descriptor?.paramsSchema)
  const name = String(descriptor?.name || '')
  const category = String(descriptor?.category || '')
  const inferredStatePaths = name.includes('zoom') || category === 'viewTransform'
    ? ['view.zoom']
    : name.includes('sort') || category === 'sorting'
      ? ['view.sort']
      : category === 'selection' || name.includes('brush') || name.includes('select')
        ? ['selections']
        : category === 'dataTransform' || name.includes('filter')
          ? ['transforms']
          : category === 'visualMapping' || name.includes('highlight') || name.includes('focus')
            ? ['view.highlight']
            : category === 'encoding' || name.includes('encoding')
              ? ['encodings']
              : ['view']
  const inferredEffect = category === 'selection' || name.includes('select') || name.includes('brush')
    ? { kind: 'updatesSelection', ref: null, description: 'Updates the active selection state.' }
    : category === 'dataTransform' || name.includes('filter')
      ? { kind: 'filtersWidget', ref: null, description: 'Updates the widget data transform state.' }
      : category === 'viewTransform' || name.includes('zoom')
        ? { kind: 'updatesViewDomain', ref: null, description: 'Updates the widget view state.' }
        : { kind: 'updatesView', ref: null, description: 'Updates the widget view state.' }
  return {
    scope: 'local',
    supportedWidgetKinds: null,
    affectedRefs: [],
    affectedStatePaths: descriptor?.affectedStatePaths?.length ? descriptor.affectedStatePaths : inferredStatePaths,
    effects: descriptor?.effects?.length ? descriptor.effects : [inferredEffect],
    reversible: false,
    preconditions: [],
    postconditions: [],
    examples: [],
    ...descriptor,
    paramsSchema,
  }
}

export function makeSelectionEffect(ref, description) {
  return {
    kind: 'updatesSelection',
    ref,
    description,
  }
}

export function makeFilterEffect(ref, description) {
  return {
    kind: 'filtersWidget',
    ref,
    description,
  }
}

export function makeDomainEffect(ref, description) {
  return {
    kind: 'updatesViewDomain',
    ref,
    description,
  }
}

export function makeEncodingEffect(ref, description) {
  return {
    kind: 'changesEncoding',
    ref,
    description,
  }
}

export function makeHighlightEffect(ref, description) {
  return {
    kind: 'highlightsItems',
    ref,
    description,
  }
}
