import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..')
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('ships matching install colors without public production source maps', () => {
  const manifest = JSON.parse(read('public/manifest.webmanifest'))
  const index = read('index.html')
  const viteConfig = read('vite.config.ts')

  assert.equal(manifest.theme_color, '#f2c94c')
  assert.equal(manifest.background_color, '#171512')
  assert.match(index, /name="theme-color" content="#f2c94c"/u)
  assert.match(viteConfig, /sourcemap:\s*false/u)
})

test('keeps Vercel linkage local and sends a restrictive browser policy', () => {
  assert.match(read('.gitignore'), /^\.vercel\/$/mu)
  const config = JSON.parse(read('vercel.json'))
  const globalRule = config.headers.find(({ source }) => source === '/(.*)')
  assert.ok(globalRule)
  const headers = new Map(
    globalRule.headers.map(({ key, value }) => [key.toLowerCase(), value]),
  )

  assert.match(headers.get('content-security-policy'), /object-src 'none'/u)
  assert.equal(headers.get('x-content-type-options'), 'nosniff')
  assert.equal(
    headers.get('referrer-policy'),
    'strict-origin-when-cross-origin',
  )
  assert.match(headers.get('permissions-policy'), /camera=\(\)/u)
})

test('the ordinary quality gate includes media and release budgets', () => {
  const packageJson = JSON.parse(read('package.json'))
  assert.match(packageJson.scripts.check, /check:assets/u)
  assert.match(packageJson.scripts.check, /check:audio/u)
  assert.match(packageJson.scripts.check, /check:release/u)
  assert.match(packageJson.scripts['build:vercel'], /check-budgets\.mjs/u)
  assert.match(
    packageJson.scripts['test:deployment-smoke'],
    /run-deployment-smoke\.mjs/u,
  )
})
