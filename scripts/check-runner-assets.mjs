#!/usr/bin/env node

import { existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve, sep } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const maximumRasterBytes = 2 * 1024 * 1024
const maximumSheetSide = 4096
const errors = []
const imagePaths = [
  'src/assets/generated/wallstreet-surfers/runner-street.webp',
  'src/assets/generated/wallstreet-surfers/runner-avatar.png',
  'src/assets/generated/wallstreet-surfers/train.png',
  'src/assets/generated/wallstreet-surfers/barrier.png',
  'src/assets/generated/wallstreet-surfers/long-arrow.png',
  'src/assets/generated/wallstreet-surfers/short-arrow.png',
  'src/assets/generated/wallstreet-surfers/coin.png',
]
const spritesheetPath =
  'src/assets/generated/wallstreet-surfers/runner_run_f15_256x256_g4x4_fps16_loop.png'
const audioPaths = [
  'src/assets/audio/shared/arcade-loop.ogg',
  'src/assets/audio/shared/ui-confirm.ogg',
  'src/assets/audio/shared/market-success.ogg',
  'src/assets/audio/shared/market-failure.ogg',
  'src/assets/audio/wallstreet-surfers/coin-pickup.ogg',
  'src/assets/audio/wallstreet-surfers/collision.ogg',
]

function localFile(relativePath) {
  const absolutePath = resolve(root, relativePath)
  if (!absolutePath.startsWith(root + sep)) {
    errors.push(`${relativePath} resolves outside the repository`)
    return null
  }
  if (!existsSync(absolutePath)) {
    errors.push(`${relativePath} is missing`)
    return null
  }
  return absolutePath
}

for (const relativePath of [...imagePaths, spritesheetPath]) {
  const absolutePath = localFile(relativePath)
  if (absolutePath !== null && statSync(absolutePath).size > maximumRasterBytes) {
    errors.push(`${relativePath} exceeds the 2 MiB raster budget`)
  }
}

const sheet = localFile(spritesheetPath)
if (sheet !== null) {
  const header = readFileSync(sheet).subarray(0, 24)
  const pngSignature = '89504e470d0a1a0a'
  if (header.length < 24 || header.subarray(0, 8).toString('hex') !== pngSignature) {
    errors.push(`${spritesheetPath} is not a readable PNG`)
  } else {
    const width = header.readUInt32BE(16)
    const height = header.readUInt32BE(20)
    if (width > maximumSheetSide || height > maximumSheetSide) {
      errors.push(
        `${spritesheetPath} exceeds ${maximumSheetSide}px (${width}x${height})`,
      )
    }
  }
}

for (const relativePath of audioPaths) {
  const absolutePath = localFile(relativePath)
  if (absolutePath !== null && extname(absolutePath).toLowerCase() !== '.ogg') {
    errors.push(`${relativePath} must be a local OGG file`)
  }
}

const catalogPath = localFile('src/assets/catalog.ts')
if (catalogPath !== null) {
  const catalog = readFileSync(catalogPath, 'utf8')
  const staticUrlImports = catalog.match(/from ['"].+\.(?:png|webp|ogg)\?url['"]/g)
  if (staticUrlImports?.length !== 17) {
    errors.push(
      `asset catalog must contain 17 static ?url imports; found ${staticUrlImports?.length ?? 0}`,
    )
  }
}

if (errors.length > 0) {
  console.error('runner asset gate failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log('runner asset gate passed: 8 rasters, 6 audio files, 17 emitted imports')
}

