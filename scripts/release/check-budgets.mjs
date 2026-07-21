#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { extname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { gzipSync } from 'node:zlib'

export const DEFAULT_THRESHOLDS = Object.freeze({
  initialJavaScriptGzipBytes: 350 * 1024,
  lazyRunnerJavaScriptGzipBytes: 1.2 * 1024 * 1024,
  distributionBytes: 20 * 1024 * 1024,
  singleAssetBytes: 25 * 1024 * 1024,
})

const JAVASCRIPT_EXTENSION = /\.(?:js|mjs)$/i
const STYLESHEET_EXTENSION = /\.css$/i
const RUNNER_CHUNK = /wallstreet[-_/\\]surfers|phaser-runtime/i

function walkFiles(directory, root = directory) {
  const files = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(absolutePath, root))
    else if (entry.isFile()) files.push({
      absolutePath,
      relativePath: relative(root, absolutePath).replaceAll('\\', '/'),
      bytes: statSync(absolutePath).size,
    })
  }
  return files
}

function manifestReferences(record) {
  return Array.isArray(record.imports) ? record.imports : []
}

export function collectStaticManifestFiles(manifest, startKeys) {
  const visitedKeys = new Set()
  const files = new Set()
  const visit = (key) => {
    if (visitedKeys.has(key)) return
    visitedKeys.add(key)
    const record = manifest[key]
    if (record === undefined || record === null || typeof record !== 'object') return
    if (typeof record.file === 'string') files.add(record.file)
    if (Array.isArray(record.css)) {
      for (const cssFile of record.css) {
        if (typeof cssFile === 'string') files.add(cssFile)
      }
    }
    for (const importedKey of manifestReferences(record)) visit(importedKey)
  }
  for (const key of startKeys) visit(key)
  return files
}

function gzipBytes(files, distributionDirectory, pattern) {
  let bytes = 0
  for (const file of files) {
    if (!pattern.test(extname(file))) continue
    bytes += gzipSync(readFileSync(resolve(distributionDirectory, file))).byteLength
  }
  return bytes
}

function parseManifest(distributionDirectory) {
  const manifestPath = resolve(distributionDirectory, '.vite', 'manifest.json')
  const parsed = JSON.parse(readFileSync(manifestPath, 'utf8'))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new TypeError('Vite manifest must be an object')
  }
  return parsed
}

export function analyzeRelease(
  distributionDirectory,
  thresholds = DEFAULT_THRESHOLDS,
) {
  const resolvedDistribution = resolve(distributionDirectory)
  const manifest = parseManifest(resolvedDistribution)
  const allFiles = walkFiles(resolvedDistribution)
  const entryKeys = Object.entries(manifest)
    .filter(([, record]) => record?.isEntry === true)
    .map(([key]) => key)
  const runnerKeys = Object.entries(manifest)
    .filter(([key, record]) => RUNNER_CHUNK.test([
      key,
      record?.name,
      record?.file,
      record?.src,
    ].filter(Boolean).join(' ')))
    .map(([key]) => key)

  const initialFiles = collectStaticManifestFiles(manifest, entryKeys)
  const runnerFiles = collectStaticManifestFiles(manifest, runnerKeys)
  for (const initialFile of initialFiles) runnerFiles.delete(initialFile)

  const initialJavaScriptGzipBytes = gzipBytes(
    initialFiles,
    resolvedDistribution,
    JAVASCRIPT_EXTENSION,
  )
  const initialStylesheetGzipBytes = gzipBytes(
    initialFiles,
    resolvedDistribution,
    STYLESHEET_EXTENSION,
  )
  const lazyRunnerJavaScriptGzipBytes = gzipBytes(
    runnerFiles,
    resolvedDistribution,
    JAVASCRIPT_EXTENSION,
  )
  const distributionBytes = allFiles.reduce((sum, file) => sum + file.bytes, 0)
  const errors = []

  if (entryKeys.length === 0) errors.push('Vite manifest has no application entry')
  if (runnerKeys.length === 0) errors.push('Vite manifest has no lazy runner chunk')
  if (initialJavaScriptGzipBytes > thresholds.initialJavaScriptGzipBytes) {
    errors.push('initial application JavaScript exceeds 350 KiB gzip')
  }
  if (lazyRunnerJavaScriptGzipBytes > thresholds.lazyRunnerJavaScriptGzipBytes) {
    errors.push('lazy runner JavaScript exceeds 1.2 MiB gzip')
  }
  if (distributionBytes > thresholds.distributionBytes) {
    errors.push('complete production distribution exceeds 20 MiB')
  }
  for (const file of allFiles) {
    if (file.bytes >= thresholds.singleAssetBytes) {
      errors.push(`${file.relativePath} is not below the 25 MiB single-asset limit`)
    }
  }

  return Object.freeze({
    errors: Object.freeze(errors),
    measures: Object.freeze({
      distributionBytes,
      initialJavaScriptGzipBytes,
      initialStylesheetGzipBytes,
      lazyRunnerJavaScriptGzipBytes,
      initialFiles: Object.freeze([...initialFiles].sort()),
      runnerFiles: Object.freeze([...runnerFiles].sort()),
    }),
  })
}

function formatSize(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`
}

function run() {
  const distributionDirectory = process.argv[2] ?? 'dist'
  let report
  try {
    report = analyzeRelease(distributionDirectory)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`release budget check failed: ${message}`)
    process.exitCode = 1
    return
  }

  console.log(`initial JavaScript gzip: ${formatSize(report.measures.initialJavaScriptGzipBytes)}`)
  console.log(`initial CSS gzip: ${formatSize(report.measures.initialStylesheetGzipBytes)}`)
  console.log(`lazy runner JavaScript gzip: ${formatSize(report.measures.lazyRunnerJavaScriptGzipBytes)}`)
  console.log(`production dist: ${formatSize(report.measures.distributionBytes)}`)
  if (report.errors.length > 0) {
    for (const error of report.errors) console.error(`- ${error}`)
    process.exitCode = 1
    return
  }
  console.log('release budgets passed')
}

if (process.argv[1] !== undefined && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  run()
}
