import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

test('lets the deployment-scoped start URL define the installed app identity', () => {
  const manifest = JSON.parse(
    readFileSync(resolve(repositoryRoot, 'public/manifest.webmanifest'), 'utf8'),
  )

  assert.equal(manifest.start_url, './#/')
  assert.equal(manifest.scope, './')
  assert.equal(manifest.id, undefined)
})

test('does not replace the controller underneath an already-open hashed bundle', () => {
  const serviceWorker = readFileSync(
    resolve(repositoryRoot, 'public/sw.js'),
    'utf8',
  )

  assert.doesNotMatch(serviceWorker, /\bskipWaiting\s*\(/u)
  assert.doesNotMatch(serviceWorker, /\bclients\.claim\s*\(/u)
})
