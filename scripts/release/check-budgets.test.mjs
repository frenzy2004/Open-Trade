import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import {
  analyzeRelease,
  collectStaticManifestFiles,
  DEFAULT_THRESHOLDS,
} from './check-budgets.mjs'

const temporaryRoot = mkdtempSync(join(tmpdir(), 'open-trade-budgets-'))
after(() => rmSync(temporaryRoot, { recursive: true, force: true }))

function createDistribution(name, manifest, files) {
  const distribution = join(temporaryRoot, name)
  mkdirSync(join(distribution, '.vite'), { recursive: true })
  writeFileSync(
    join(distribution, '.vite', 'manifest.json'),
    JSON.stringify(manifest),
  )
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = join(distribution, relativePath)
    mkdirSync(join(absolutePath, '..'), { recursive: true })
    writeFileSync(absolutePath, contents)
  }
  return distribution
}

test('collects static imports without pulling lazy routes into the initial graph', () => {
  const manifest = {
    'src/main.tsx': {
      file: 'assets/main.js',
      isEntry: true,
      imports: ['_shared.js'],
      dynamicImports: ['src/games/wallstreet-surfers/route.tsx'],
    },
    '_shared.js': { file: 'assets/shared.js' },
    'src/games/wallstreet-surfers/route.tsx': {
      file: 'assets/wallstreet-surfers.js',
      imports: ['_phaser-runtime.js'],
    },
    '_phaser-runtime.js': { file: 'assets/phaser-runtime.js' },
  }

  assert.deepEqual(
    [...collectStaticManifestFiles(manifest, ['src/main.tsx'])].sort(),
    ['assets/main.js', 'assets/shared.js'],
  )
})

test('measures the initial and lazy runner graphs independently', () => {
  const distribution = createDistribution('passing', {
    'src/main.tsx': {
      file: 'assets/main.js',
      isEntry: true,
      css: ['assets/main.css'],
    },
    'src/games/wallstreet-surfers/route.tsx': {
      file: 'assets/wallstreet-surfers.js',
      imports: ['_phaser-runtime.js'],
    },
    '_phaser-runtime.js': { file: 'assets/phaser-runtime.js' },
  }, {
    'index.html': '<!doctype html>',
    'assets/main.js': 'export const app = true',
    'assets/main.css': 'body{margin:0}',
    'assets/wallstreet-surfers.js': 'export const runner = true',
    'assets/phaser-runtime.js': 'export const phaser = true',
  })

  const report = analyzeRelease(distribution)
  assert.deepEqual(report.errors, [])
  assert.deepEqual(report.measures.runnerFiles, [
    'assets/phaser-runtime.js',
    'assets/wallstreet-surfers.js',
  ])
  assert.ok(report.measures.initialJavaScriptGzipBytes > 0)
  assert.ok(report.measures.lazyRunnerJavaScriptGzipBytes > 0)
})

test('rejects a file at the strict single-asset limit', () => {
  const distribution = createDistribution('oversized', {
    'src/main.tsx': { file: 'assets/main.js', isEntry: true },
    'src/games/wallstreet-surfers/route.tsx': {
      file: 'assets/wallstreet-surfers.js',
    },
  }, {
    'index.html': '<!doctype html>',
    'assets/main.js': 'export {}',
    'assets/wallstreet-surfers.js': 'export {}',
    'assets/large.bin': Buffer.alloc(16),
  })

  const report = analyzeRelease(distribution, {
    ...DEFAULT_THRESHOLDS,
    singleAssetBytes: 16,
  })
  assert.match(report.errors.join('\n'), /single-asset limit/)
})
