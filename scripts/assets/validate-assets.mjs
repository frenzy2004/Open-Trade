#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(process.env.OPEN_TRADE_ASSET_ROOT ?? resolve(import.meta.dirname, '..', '..'));
const fromRoot = (relativePath) => resolve(root, relativePath);
const errors = [];

function requireFile(relativePath, label = relativePath) {
  const absolutePath = fromRoot(relativePath);
  if (!existsSync(absolutePath)) {
    errors.push(`missing ${label}`);
    return null;
  }
  return absolutePath;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((field) => field !== '')) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (value || row.length) rows.push([...row, value]);
  const [header, ...body] = rows;
  return body.map((fields) => Object.fromEntries(header.map((name, index) => [name, fields[index] ?? ''])));
}

function inspectImage(relativePath) {
  const imagePath = fromRoot(relativePath);
  try {
    const output = execFileSync(
      'python',
      ['-c', "import json,sys; from PIL import Image; im=Image.open(sys.argv[1]); alpha='A' in im.getbands(); extrema=im.getchannel('A').getextrema() if alpha else None; print(json.dumps({'width':im.width,'height':im.height,'alpha':alpha,'transparentPixel':bool(alpha and extrema[0] < 255)}))", imagePath],
      { encoding: 'utf8' },
    );
    return JSON.parse(output);
  } catch (error) {
    errors.push(`could not inspect image ${relativePath}: ${error.message}`);
    return null;
  }
}

function checkImage(spec) {
  const imagePath = requireFile(spec.output, `${spec.id} output (${spec.output})`);
  if (!imagePath) return;
  const inspected = inspectImage(spec.output);
  if (!inspected) return;
  if (inspected.width !== spec.width || inspected.height !== spec.height) {
    errors.push(`${spec.id} dimensions must be ${spec.width}x${spec.height}; found ${inspected.width}x${inspected.height}`);
  }
  if (Boolean(inspected.alpha) !== Boolean(spec.transparent)) {
    errors.push(`${spec.id} alpha must be ${Boolean(spec.transparent)}`);
  }
  if (spec.transparent && !inspected.transparentPixel) {
    errors.push(`${spec.id} must contain at least one transparent pixel`);
  }
  const maximumBytes = spec.id === 'ws-run-loop'
    ? 2 * 1024 * 1024
    : spec.kind === 'background'
      ? 400 * 1024
      : spec.width === 512
        ? 350 * 1024
        : 160 * 1024;
  if (statSync(imagePath).size > maximumBytes) {
    errors.push(`${spec.id} exceeds its ${maximumBytes} byte image budget`);
  }
}

const manifestPath = requireFile('design/assets.csv', 'asset manifest');
const generationPlanPath = requireFile('design/higgsfield/generation-plan.json', 'generation plan');
const audioPlanPath = requireFile('design/higgsfield/audio-plan.json', 'audio plan');
const thresholdsPath = requireFile('design/thresholds.md', 'asset thresholds');
let manifest = [];
let generationPlan = { assets: [] };
let audioPlan = { assets: [] };

if (manifestPath) {
  manifest = parseCsv(readFileSync(manifestPath, 'utf8'));
  const uniqueIds = new Set(manifest.map(({ id }) => id));
  if (manifest.length !== 16) errors.push(`manifest must contain 16 IDs; found ${manifest.length}`);
  if (uniqueIds.size !== manifest.length) errors.push('manifest IDs must be unique');
}
if (generationPlanPath) generationPlan = JSON.parse(readFileSync(generationPlanPath, 'utf8'));
if (audioPlanPath) audioPlan = JSON.parse(readFileSync(audioPlanPath, 'utf8'));
if (thresholdsPath) {
  const thresholds = readFileSync(thresholdsPath, 'utf8');
  for (const expectedThreshold of ['400 KiB', '350 KiB', '160 KiB', '2 MiB']) {
    if (!thresholds.includes(expectedThreshold)) errors.push(`thresholds missing ${expectedThreshold} image gate`);
  }
}

if (generationPlan.assets.length !== 9) errors.push(`generation plan must contain nine static assets; found ${generationPlan.assets.length}`);
if (audioPlan.assets.length !== 6) errors.push(`audio plan must contain six assets; found ${audioPlan.assets.length}`);

const runSheet = {
  id: 'ws-run-loop',
  kind: 'spritesheet',
  width: 1024,
  height: 1024,
  transparent: true,
  output: 'src/assets/generated/wallstreet-surfers/runner_run_f15_256x256_g4x4_fps16_loop.png',
};
for (const image of [...generationPlan.assets, runSheet]) checkImage(image);

for (const audio of audioPlan.assets) {
  const audioPath = requireFile(audio.output, `${audio.id} audio (${audio.output})`);
  if (audioPath && statSync(audioPath).size >= 25 * 1024 * 1024) errors.push(`${audio.id} is not below the 25 MiB file limit`);
}

const expectedIds = new Set([...generationPlan.assets, runSheet, ...audioPlan.assets].map(({ id }) => id));
if (expectedIds.size !== 16) errors.push(`planned output IDs must total 16; found ${expectedIds.size}`);
if (manifest.length && (manifest.some(({ id }) => !expectedIds.has(id)) || [...expectedIds].some((id) => !manifest.some((row) => row.id === id)))) {
  errors.push('manifest IDs do not agree with the output plans');
}

for (const id of [...generationPlan.assets, ...audioPlan.assets].map(({ id }) => id)) {
  requireFile(`design/higgsfield/jobs/${id}-request.json`, `${id} request provenance`);
  requireFile(`design/higgsfield/jobs/${id}-complete.json`, `${id} completion provenance`);
}

const transparentStaticIds = generationPlan.assets.filter(({ transparent }) => transparent).map(({ id }) => id);
if (transparentStaticIds.length !== 6) errors.push(`generation plan must contain six transparent static assets; found ${transparentStaticIds.length}`);
for (const id of transparentStaticIds) {
  requireFile(`design/higgsfield/jobs/${id}-remove-bg-a1-request.json`, `${id} background-removal request provenance`);
  requireFile(`design/higgsfield/jobs/${id}-remove-bg-a1-complete.json`, `${id} background-removal completion provenance`);
}
for (const stage of ['ws-run-loop-key-pose', 'ws-run-loop-video']) {
  requireFile(`design/higgsfield/jobs/${stage}-request.json`, `${stage} request provenance`);
  requireFile(`design/higgsfield/jobs/${stage}-complete.json`, `${stage} completion provenance`);
}
for (let index = 0; index < 16; index += 1) {
  const frame = String(index).padStart(4, '0');
  requireFile(`design/higgsfield/jobs/ws-run-loop-frame-${frame}-remove-bg-a1-request.json`, `ws-run-loop frame ${frame} background-removal request provenance`);
  requireFile(`design/higgsfield/jobs/ws-run-loop-frame-${frame}-remove-bg-a1-complete.json`, `ws-run-loop frame ${frame} background-removal completion provenance`);
}
requireFile('design/higgsfield/jobs/ws-run-loop-assembly.json', 'ws-run-loop assembly metadata');

const reviewPath = requireFile('design/higgsfield/review.csv', 'review ledger');
if (reviewPath) {
  const accepted = new Set(parseCsv(readFileSync(reviewPath, 'utf8')).filter((row) => row.accepted === 'true').map(({ id }) => id));
  for (const id of expectedIds) if (!accepted.has(id)) errors.push(`missing accepted review row for ${id}`);
}

const catalogPath = requireFile('src/assets/catalog.ts', 'asset catalog');
if (catalogPath) {
  const catalog = readFileSync(catalogPath, 'utf8');
  const match = catalog.match(/export\s+const\s+ASSET_CATALOG_IDS\s*=\s*\[([\s\S]*?)\]\s*as\s+const\s*;/);
  if (!match) {
    errors.push('asset catalog must export ASSET_CATALOG_IDS as a const string array');
  } else {
    const catalogIds = [...match[1].matchAll(/(['"])([a-z0-9-]+)\1/g)].map((entry) => entry[2]);
    const catalogSet = new Set(catalogIds);
    if (catalogSet.size !== catalogIds.length) errors.push('asset catalog IDs must be unique');
    const missing = [...expectedIds].filter((id) => !catalogSet.has(id));
    const extra = [...catalogSet].filter((id) => !expectedIds.has(id));
    if (missing.length) errors.push(`asset catalog IDs missing: ${missing.join(', ')}`);
    if (extra.length) errors.push(`asset catalog IDs extra: ${extra.join(', ')}`);
  }
}

if (errors.length) {
  console.error('asset validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exitCode = 1;
} else {
  console.log('asset validation passed: 16/16');
}
