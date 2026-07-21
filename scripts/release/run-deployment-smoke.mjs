#!/usr/bin/env node

import { spawnSync } from 'node:child_process'

const portBase = Number.parseInt(
  process.env.DEPLOYMENT_SMOKE_PORT_BASE ?? '4310',
  10,
)
if (!Number.isSafeInteger(portBase) || portBase < 1024 || portBase > 65000) {
  throw new RangeError('DEPLOYMENT_SMOKE_PORT_BASE must be a safe local port')
}

const deployments = [
  {
    name: 'GitHub Pages',
    basePath: '/Open-Trade/',
    buildCommand: 'npm run build:pages',
  },
  {
    name: 'Vercel root',
    basePath: '/',
    buildCommand: 'npm run build:vercel',
  },
  {
    name: 'portable relative build',
    basePath: '/',
    buildCommand: 'npm run build:higgsfield',
  },
]

const npmCli = process.env.npm_execpath
if (npmCli === undefined || npmCli.length === 0) {
  throw new Error('Run deployment smoke through npm so npm_execpath is defined')
}
for (const [index, deployment] of deployments.entries()) {
  const port = String(portBase + index)
  console.log(
    `deployment smoke: ${deployment.name} (${deployment.basePath}, port ${port})`,
  )
  const result = spawnSync(
    process.execPath,
    [
      npmCli,
      'run',
      'test:e2e',
      '--',
      'tests/e2e/offline.spec.ts',
      '--project',
      'chromium-desktop',
    ],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_PATH: deployment.basePath,
        PLAYWRIGHT_BUILD_COMMAND: deployment.buildCommand,
        PLAYWRIGHT_PORT: port,
      },
      stdio: 'inherit',
    },
  )
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1
    break
  }
}
