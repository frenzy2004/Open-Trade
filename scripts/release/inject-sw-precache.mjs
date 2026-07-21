#!/usr/bin/env node

import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const PATHS_MARKER = '/* __OPEN_TRADE_PRECACHE__ */ []'
const VERSION_MARKER = "'__OPEN_TRADE_CACHE_VERSION__'"
const EXPLICIT_SHELL_PATHS = Object.freeze([
  'index.html',
  'manifest.webmanifest',
  'icons/open-trade-192.png',
  'icons/open-trade-512.png',
])
const EXCLUDED_PATHS = new Set([
  '.vite/manifest.json',
  ...EXPLICIT_SHELL_PATHS,
  'sw.js',
])

function walkFiles(directory, root = directory) {
  const paths = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) paths.push(...walkFiles(absolutePath, root))
    else if (entry.isFile()) {
      paths.push(relative(root, absolutePath).replaceAll('\\', '/'))
    }
  }
  return paths
}

export function collectPrecachePaths(distributionDirectory) {
  return walkFiles(resolve(distributionDirectory))
    .filter((path) => !EXCLUDED_PATHS.has(path) && !path.endsWith('.map'))
    .sort()
}

export function createCacheVersion(distributionDirectory, paths) {
  const root = resolve(distributionDirectory)
  const hash = createHash('sha256')
  for (const path of paths) {
    hash.update(path)
    hash.update('\0')
    hash.update(readFileSync(resolve(root, path)))
    hash.update('\0')
  }
  return `v-${hash.digest('hex').slice(0, 16)}`
}

export function injectServiceWorkerPrecache(distributionDirectory) {
  const root = resolve(distributionDirectory)
  const serviceWorkerPath = resolve(root, 'sw.js')
  const paths = collectPrecachePaths(root)
  const cacheVersion = createCacheVersion(root, [
    ...EXPLICIT_SHELL_PATHS,
    ...paths,
  ])
  const source = readFileSync(serviceWorkerPath, 'utf8')
  if (!source.includes(PATHS_MARKER)) {
    throw new Error('Service worker precache marker was not found')
  }
  if (!source.includes(VERSION_MARKER)) {
    throw new Error('Service worker cache-version marker was not found')
  }
  const injected = source
    .replace(PATHS_MARKER, JSON.stringify(paths, null, 2))
    .replace(VERSION_MARKER, JSON.stringify(cacheVersion))
  writeFileSync(serviceWorkerPath, injected)
  return Object.freeze({ cacheVersion, paths: Object.freeze(paths) })
}

function run() {
  const distributionDirectory = process.argv[2] ?? 'dist'
  try {
    const result = injectServiceWorkerPrecache(distributionDirectory)
    console.log(
      `service worker precache injected: ${result.paths.length} files (${result.cacheVersion})`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`service worker precache injection failed: ${message}`)
    process.exitCode = 1
  }
}

if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run()
}
