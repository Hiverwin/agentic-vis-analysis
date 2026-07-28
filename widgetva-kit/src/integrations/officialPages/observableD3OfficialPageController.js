async function syncObservableD3ControllerState({ widget, wrapper } = {}) {
  const widgetState = typeof widget?.readState === 'function' ? widget.readState() : null
  if (widgetState && typeof wrapper?.renderFromState === 'function') {
    await wrapper.renderFromState(widgetState)
    return
  }
  await wrapper?.syncCurrentSpec?.()
}

export async function syncObservableD3ScatterControllerState(args = {}) {
  await syncObservableD3ControllerState(args)
}

export async function syncObservableD3BarControllerState(args = {}) {
  await syncObservableD3ControllerState(args)
}

export async function syncObservableD3LineControllerState(args = {}) {
  await syncObservableD3ControllerState(args)
}
