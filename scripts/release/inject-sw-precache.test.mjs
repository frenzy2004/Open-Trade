import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after, test } from 'node:test'
import {
  collectPrecachePaths,
  injectServiceWorkerPrecache,
} from './inject-sw-precache.mjs'

const temporaryRoot = mkdtempSync(join(tmpdir(), 'open-trade-precache-'))
after(() => rmSync(temporaryRoot, { recursive: true, force: true }))

function write(relativePath, contents) {
  const absolutePath = join(temporaryRoot, relativePath)
  mkdirSync(dirname(absolutePath), { recursive: true })
  writeFileSync(absolutePath, contents)
}

test('collects deployable runtime files and excludes maps and explicit shell URLs', () => {
  write('index.html', '<!doctype html>')
  write('manifest.webmanifest', '{}')
  write('icons/open-trade-192.png', 'icon')
  write('icons/open-trade-512.png', 'large icon')
  write('.vite/manifest.json', '{}')
  write('assets/app.js', 'export {}')
  write('assets/app.js.map', '{}')
  write('assets/cover.webp', 'image')
  write('sw.js', 'worker')

  assert.deepEqual(collectPrecachePaths(temporaryRoot), [
    'assets/app.js',
    'assets/cover.webp',
  ])
})

test('injects a content-addressed cache version and deterministic file list', () => {
  write('sw.js', [
    "const version = '__OPEN_TRADE_CACHE_VERSION__'",
    'const files = /* __OPEN_TRADE_PRECACHE__ */ []',
  ].join('\n'))

  const result = injectServiceWorkerPrecache(temporaryRoot)
  const injected = readFileSync(join(temporaryRoot, 'sw.js'), 'utf8')
  assert.match(result.cacheVersion, /^v-[a-f0-9]{16}$/)
  assert.match(injected, new RegExp(result.cacheVersion))
  assert.match(injected, /"assets\/app\.js"/)
  assert.doesNotMatch(injected, /__OPEN_TRADE_PRECACHE__/)
  assert.doesNotMatch(injected, /__OPEN_TRADE_CACHE_VERSION__/)
})
