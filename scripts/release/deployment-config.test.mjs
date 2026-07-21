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

test('allows Phaser to decode same-origin textures through object URLs', () => {
  const index = read('index.html')
  const config = JSON.parse(read('vercel.json'))
  const globalRule = config.headers.find(({ source }) => source === '/(.*)')
  const vercelPolicy = globalRule.headers.find(
    ({ key }) => key.toLowerCase() === 'content-security-policy',
  ).value

  assert.match(index, /img-src 'self' data: blob:/u)
  assert.match(vercelPolicy, /img-src 'self' data: blob:/u)
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

test('deployment smoke proves the portable build below a nested mount', () => {
  const smokeRunner = read('scripts/release/run-deployment-smoke.mjs')

  assert.match(
    smokeRunner,
    /name:\s*'portable relative build',[\s\S]*?basePath:\s*'\/portable\/Open-Trade\/'/u,
  )
})

test('offline verification rejects failed media requests explicitly', () => {
  const offlineSpec = read('tests/e2e/offline.spec.ts')

  assert.match(offlineSpec, /expect\(failedRequests\)\.toEqual\(\[\]\)/u)
})

test('CI enforces the deployment matrix and provisions audio verification', () => {
  const ci = read('.github/workflows/ci.yml')
  const pages = read('.github/workflows/pages.yml')

  assert.match(ci, /actions\/setup-python@v6/u)
  assert.match(
    ci,
    /python -m pip install --requirement requirements-assets\.txt/u,
  )
  assert.match(
    pages,
    /python -m pip install --requirement requirements-assets\.txt/u,
  )
  assert.match(ci, /npm run test:deployment-smoke/u)
  assert.match(ci, /(?:apt-get install[^\n]*ffmpeg|command -v ffprobe)/u)
})

test('Pages verification and deployment use separate least-privilege jobs', () => {
  const pages = read('.github/workflows/pages.yml')

  assert.match(pages, /\n {2}verify:\n/u)
  assert.match(pages, /\n {2}deploy:\n/u)
  assert.match(pages, /needs:\s*verify/u)
  assert.match(pages, /id:\s*deployment/u)
  assert.match(pages, /url:\s*\$\{\{ steps\.deployment\.outputs\.page_url \}\}/u)
})
