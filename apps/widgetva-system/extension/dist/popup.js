const LOAD_MESSAGE_TYPE = 'widgetva:load-official-vega-lite-page'
const VEGA_LITE_EXAMPLE_URL = /^https:\/\/vega\.github\.io\/vega-lite\/examples\//

const loadButton = document.getElementById('load')
const statusLine = document.getElementById('status')

function setStatus(text, className = '') {
  statusLine.textContent = text
  statusLine.className = `status${className ? ` ${className}` : ''}`
}

function readRuntimeError() {
  return chrome.runtime.lastError?.message || null
}

async function readActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
  return tabs[0] || null
}

function sendLoadMessage(tabId) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, {
      type: LOAD_MESSAGE_TYPE,
      autoBind: true,
    }, (response) => {
      const runtimeError = readRuntimeError()
      if (runtimeError) {
        reject(new Error(runtimeError))
        return
      }
      if (response?.ok !== true) {
        reject(new Error(response?.error?.message || 'WidgetVA could not be loaded on this page.'))
        return
      }
      resolve(response.result || null)
    })
  })
}

async function loadWidgetVA() {
  loadButton.disabled = true
  setStatus('Loading WidgetVA...')

  try {
    const tab = await readActiveTab()
    if (!tab?.id) {
      throw new Error('No active tab is available.')
    }
    if (!VEGA_LITE_EXAMPLE_URL.test(tab.url || '')) {
      throw new Error('Open a Vega-Lite example page first.')
    }

    const result = await sendLoadMessage(tab.id)
    setStatus(result?.bound === false ? 'Dock loaded. Bind is still running in the page.' : 'WidgetVA loaded.', 'ready')
  } catch (error) {
    setStatus(error?.message || 'WidgetVA failed to load.', 'error')
  } finally {
    loadButton.disabled = false
  }
}

loadButton.addEventListener('click', () => {
  void loadWidgetVA()
})
