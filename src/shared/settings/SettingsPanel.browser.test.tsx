import { useState } from 'react'
import { expect, test } from 'vitest'
import { render } from 'vitest-browser-react'
import {
  createGameStore,
  type GameSaveCodec,
} from '../persistence/gameStore'
import { Button } from '../ui'
import {
  type AppSettings,
  DEFAULT_SETTINGS,
} from './settingsStore'
import {
  SettingsProvider,
  useSettings,
} from './SettingsContext'
import { SettingsPanel } from './SettingsPanel'

const testCodec: GameSaveCodec<AppSettings> = {
  key: 'open-trade:test-settings-browser',
  version: 1,
  encode: (value) => value,
  decode: (value) => {
    if (typeof value !== 'object' || value === null) {
      return { ok: false, reason: 'invalid settings' }
    }
    const record = value as Record<string, unknown>
    if (
      Object.hasOwn(record, 'muted') &&
      typeof record.muted === 'boolean' &&
      Object.hasOwn(record, 'reducedMotion') &&
      typeof record.reducedMotion === 'boolean'
    ) {
      return {
        ok: true,
        value: {
          muted: record.muted,
          reducedMotion: record.reducedMotion,
        },
      }
    }
    return { ok: false, reason: 'invalid settings' }
  },
}

function Harness() {
  const [open, setOpen] = useState(false)
  const { settings } = useSettings()

  return (
    <>
      <Button onClick={() => setOpen(true)}>Settings</Button>
      <output>
        {settings.muted ? 'Muted' : 'Sound on'} ·{' '}
        {settings.reducedMotion ? 'Reduced motion' : 'Standard motion'}
      </output>
      <SettingsPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}

test('updates and persists sound and reduced-motion settings', async () => {
  const store = createGameStore(testCodec, {
    storage: window.localStorage,
  })
  store.clear()

  const screen = await render(
    <SettingsProvider store={store} initialSettings={DEFAULT_SETTINGS}>
      <Harness />
    </SettingsProvider>,
  )

  await screen.getByRole('button', { name: 'Settings' }).click()
  await screen.getByRole('checkbox', { name: 'Sound' }).click()
  await screen.getByRole('checkbox', { name: 'Reduce motion' }).click()

  await expect.element(screen.getByText('Muted · Reduced motion')).toBeVisible()
  expect(store.load()).toMatchObject({
    status: 'ready',
    value: { muted: true, reducedMotion: true },
  })
})

test('removes the reduced-motion data attribute when the provider unmounts', async () => {
  const store = createGameStore(testCodec, { storage: window.localStorage })
  store.clear()
  const screen = await render(
    <SettingsProvider
      store={store}
      initialSettings={{ muted: false, reducedMotion: true }}
    >
      <Harness />
    </SettingsProvider>,
  )

  await expect.poll(() => document.documentElement.dataset.reducedMotion).toBe(
    'true',
  )
  screen.unmount()
  await expect.poll(() => document.documentElement.dataset.reducedMotion).toBe(
    undefined,
  )
})
