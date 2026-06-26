const PAGE_SCRIPT_ID = 'widgetva-vega-examples-page-script'
const PAGE_SCRIPT_PATH = 'vegaExamplesPageScript.js'

function injectPageScript() {
  if (document.getElementById(PAGE_SCRIPT_ID)) {
    return
  }

  const pageScriptUrl = globalThis.chrome?.runtime?.getURL?.(PAGE_SCRIPT_PATH)
  if (!pageScriptUrl) {
    console.error('[WidgetVA] Unable to resolve the Vega examples page-script URL from the extension runtime.')
    return
  }

  const script = document.createElement('script')
  script.id = PAGE_SCRIPT_ID
  script.src = pageScriptUrl
  script.async = false

  script.addEventListener('load', () => {
    script.remove()
  })

  const target = document.documentElement || document.head
  if (!target) {
    console.error('[WidgetVA] Unable to inject the Vega examples page script because no root element is available.')
    return
  }

  target.prepend(script)
}

injectPageScript()
