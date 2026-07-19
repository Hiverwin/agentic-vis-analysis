import { resolve } from 'node:path'
import { defineConfig } from 'vite'

const extensionRoot = resolve(__dirname)
const distDir = resolve(extensionRoot, 'dist')
const publicDir = resolve(extensionRoot, 'public')

const ENTRY_CONFIG_BY_MODE = {
  'extension-early-capture': {
    entry: 'src/content/officialVegaLiteEarlyCaptureContentScript.js',
    globalName: 'WidgetVAOfficialVegaLiteEarlyCaptureContentScript',
    outputFile: 'officialVegaLiteEarlyCaptureContentScript.js',
    format: 'iife',
    emptyOutDir: true,
    copyPublicDir: true,
  },
  'extension-content': {
    entry: 'src/content/officialVegaLiteContentScript.js',
    globalName: 'WidgetVAOfficialVegaLiteContentScript',
    outputFile: 'officialVegaLiteContentScript.js',
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
    entry: 'src/page/officialVegaLitePageScript.js',
    globalName: 'WidgetVAOfficialVegaLitePageScript',
    outputFile: 'officialVegaLitePageScript.js',
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
