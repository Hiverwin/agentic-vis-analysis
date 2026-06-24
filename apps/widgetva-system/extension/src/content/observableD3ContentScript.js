const PAGE_SCRIPT_ID = 'widgetva-observable-d3-page-script'
const PAGE_SCRIPT_PATH = 'observableD3PageScript.js'
let hasInjected = false

function injectPageScript() {
  if (hasInjected) {
    return
  }
  if (document.getElementById(PAGE_SCRIPT_ID)) {
    hasInjected = true
    return
  }

  const pageScriptUrl = globalThis.chrome?.runtime?.getURL?.(PAGE_SCRIPT_PATH)
  if (!pageScriptUrl) {
    console.error('[WidgetVA] Unable to resolve the Observable D3 page-script URL from the extension runtime.')
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
    return
  }

  target.prepend(script)
  hasInjected = true
}

injectPageScript()

if (!hasInjected) {
  const retry = () => {
    injectPageScript()
    if (hasInjected) {
      document.removeEventListener('readystatechange', retry)
      document.removeEventListener('DOMContentLoaded', retry)
    }
  }

  document.addEventListener('readystatechange', retry)
  document.addEventListener('DOMContentLoaded', retry)
}
