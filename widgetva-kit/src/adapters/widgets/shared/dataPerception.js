export function runDataPerceptionQuery({ ctx, dataQueryExecutor, targetWidget, kind, spec }) {
  const { dataRef } = ctx.resolveRowsForWidget(targetWidget, spec || {})
  const queryResult = dataQueryExecutor.run({
    dataRef,
    query: {
      kind,
      spec: spec || {},
    },
  })
  return {
    dataRef,
    ok: queryResult?.ok === true,
    result: queryResult?.result || null,
    error: queryResult?.error || null,
  }
}

export function buildPerceptionDataResult({ dataQueryResult, fallbackDataRef = null }) {
  return {
    dataRef: dataQueryResult?.dataRef || fallbackDataRef || null,
    ...(dataQueryResult?.result || {}),
  }
}
