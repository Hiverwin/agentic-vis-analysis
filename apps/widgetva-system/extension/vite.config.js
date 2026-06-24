import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const extensionRoot = resolve(__dirname)
const distDir = resolve(extensionRoot, 'dist')
const publicDir = resolve(extensionRoot, 'public')
const widgetvaPageIntegrationsPath = resolve(extensionRoot, '../../../widgetva-kit/src/pageIntegrations.js')

const ENTRY_CONFIG_BY_MODE = {
  'extension-early-capture': {
    entry: 'src/content/vegaExamplesEarlyCaptureContentScript.js',
    globalName: 'WidgetVAVegaExamplesEarlyCaptureContentScript',
    outputFile: 'vegaExamplesEarlyCaptureContentScript.js',
    format: 'iife',
    emptyOutDir: true,
    copyPublicDir: true,
  },
  'extension-content': {
    entry: 'src/content/vegaExamplesContentScript.js',
    globalName: 'WidgetVAVegaExamplesContentScript',
    outputFile: 'vegaExamplesContentScript.js',
    format: 'iife',
    emptyOutDir: false,
    copyPublicDir: false,
  },
  'extension-content-observable-d3': {
    entry: 'src/content/observableD3ContentScript.js',
    globalName: 'WidgetVAObservableD3ContentScript',
    outputFile: 'observableD3ContentScript.js',
    format: 'iife',
    emptyOutDir: false,
    copyPublicDir: false,
  },
  'extension-content-observable-d3-worker': {
    entry: 'src/content/observableD3WorkerContentScript.js',
    globalName: 'WidgetVAObservableD3WorkerContentScript',
    outputFile: 'observableD3WorkerContentScript.js',
    format: 'iife',
    emptyOutDir: false,
    copyPublicDir: false,
  },
  'extension-page': {
    entry: 'src/page/vegaExamplesPageScript.js',
    globalName: 'WidgetVAVegaExamplesPageScript',
    outputFile: 'vegaExamplesPageScript.js',
    format: 'iife',
    emptyOutDir: false,
    copyPublicDir: false,
  },
  'extension-page-observable-d3': {
    entry: 'src/page/observableD3PageScript.js',
    globalName: 'WidgetVAObservableD3PageScript',
    outputFile: 'observableD3PageScript.js',
    format: 'iife',
    emptyOutDir: false,
    copyPublicDir: false,
  },
  'extension-background': {
    entry: 'src/background/serviceWorker.js',
    outputFile: 'backgroundServiceWorker.js',
    format: 'es',
    emptyOutDir: false,
    copyPublicDir: false,
  },
}

export default defineConfig(({ mode }) => {
  const entryConfig = ENTRY_CONFIG_BY_MODE[mode]
  if (!entryConfig) {
    throw new Error(`Unsupported WidgetVA extension build mode: ${mode}`)
  }

  return {
    publicDir: entryConfig.copyPublicDir ? publicDir : false,
    resolve: {
      alias: {
        'widgetva-kit/page-integrations': widgetvaPageIntegrationsPath,
      },
    },
    build: {
      outDir: distDir,
      emptyOutDir: entryConfig.emptyOutDir,
      copyPublicDir: entryConfig.copyPublicDir,
      minify: false,
      sourcemap: false,
      lib: {
        entry: resolve(extensionRoot, entryConfig.entry),
        formats: [entryConfig.format || 'iife'],
        ...(entryConfig.globalName ? { name: entryConfig.globalName } : {}),
        fileName: () => entryConfig.outputFile,
      },
    },
  }
})
