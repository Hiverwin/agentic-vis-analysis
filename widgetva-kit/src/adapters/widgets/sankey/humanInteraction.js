export function getSankeyHumanInteractionConfig() {
  return {
    mode: 'categoryClick',
    actionName: 'sankey.focusFlow',
    categoryFieldChannel: 'color',
    supportsDirectManipulation: true,
  }
}
