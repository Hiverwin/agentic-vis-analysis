export function buildWidgetViewPatch({ targetWidget, view }) {
  return {
    [targetWidget.ref]: {
      view: {
        ...(targetWidget?.view || {}),
        ...(view || {}),
      },
    },
  }
}
