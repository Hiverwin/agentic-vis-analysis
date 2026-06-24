export function buildSelectionActionResult({ ctx, nextState, selectedCount, verificationHints }) {
  const targetRef = ctx.readQueryScope?.()?.widgetRef || null
  const sourceWidgetRef = ctx.resolveTargetWidget({
    targetRef,
  })?.ref || null
  const selectionRef = ctx.resolveSelectionRef(nextState, {
    targetRef,
  })
  const rawPropagation = selectionRef ? ctx.propagate(selectionRef, { returnDetails: true, state: nextState }) : null
  const propagation = Array.isArray(rawPropagation)
    ? {
        refs: rawPropagation,
        links: [],
        effects: [],
        nextState: ctx.readCurrentState(),
      }
    : (rawPropagation || ctx.collectPropagation(selectionRef, { state: nextState }))
  const finalState = propagation.nextState || ctx.readCurrentState() || nextState
  return {
    nextState: finalState,
    updatedRefs: ctx.collectUpdatedRefs(
      finalState,
      [
        ...(sourceWidgetRef ? [sourceWidgetRef] : []),
        ...(selectionRef ? [selectionRef] : []),
        ...(Array.isArray(propagation.refs) ? propagation.refs : []),
      ],
    ),
    result: {
      selectedCount,
      propagated: propagation.links,
      propagationEffects: propagation.effects,
    },
    verificationHints,
  }
}
