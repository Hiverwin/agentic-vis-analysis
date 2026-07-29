import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./App.jsx', import.meta.url), 'utf8')

test('the Vite entry delegates to the appRuntime/features mainline', () => {
  assert.match(source, /export \{ default \} from ['"]\.\/app\/App\.jsx['"];?\s*$/)
  assert.doesNotMatch(source, /from ['"]\.\/layout\/SystemShell\.jsx['"];/)
})
