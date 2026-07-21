import { describe, expect, it } from 'vitest'
import type { StorageLike } from '../../../shared/persistence/gameStore'
import {
  RUNNER_SAVE_KEY,
  createRunnerSave,
  createRunnerStore,
  getRunnerProgressBadge,
  runnerSaveCodec,
} from './runnerSave'

function memoryStorage(initial: Record<string, string> = {}): StorageLike {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

describe('runnerSaveCodec', () => {
  it('round-trips a detached frozen version-one save', () => {
    const save = createRunnerSave('saved-run', 12_345, true)
    const encoded = runnerSaveCodec.encode(save)
    const decoded = runnerSaveCodec.decode(encoded)

    expect(decoded).toEqual({ ok: true, value: save })
    if (!decoded.ok) throw new Error(decoded.reason)
    expect(decoded.value).not.toBe(save)
    expect(Object.isFrozen(decoded.value)).toBe(true)
    expect(decoded.value).toEqual({
      schemaVersion: 1,
      rulesetVersion: 1,
      seed: 'saved-run',
      bestScore: 12_345,
      tutorialComplete: true,
    })
  })

  it.each([
    [null, 'corrupt'],
    [{}, 'corrupt'],
    [{ schemaVersion: 1, rulesetVersion: 1, seed: 'x', bestScore: -1, tutorialComplete: false }, 'corrupt'],
    [{ schemaVersion: 1, rulesetVersion: 1, seed: 'contains spaces', bestScore: 0, tutorialComplete: false }, 'corrupt'],
    [{ schemaVersion: 2, rulesetVersion: 1, seed: 'x', bestScore: 0, tutorialComplete: false }, 'incompatible'],
    [{ schemaVersion: 1, rulesetVersion: 2, seed: 'x', bestScore: 0, tutorialComplete: false }, 'incompatible'],
  ] as const)('rejects invalid save %# as %s', (candidate, reason) => {
    expect(runnerSaveCodec.decode(candidate)).toEqual({ ok: false, reason })
  })

  it('rejects inherited fields and unexpected keys', () => {
    const inherited = Object.create({
      schemaVersion: 1,
      rulesetVersion: 1,
      seed: 'prototype',
      bestScore: 0,
      tutorialComplete: false,
    })
    const extra = {
      ...createRunnerSave('extra', 0, false),
      injected: true,
    }

    expect(runnerSaveCodec.decode(inherited)).toEqual({
      ok: false,
      reason: 'corrupt',
    })
    expect(runnerSaveCodec.decode(extra)).toEqual({
      ok: false,
      reason: 'corrupt',
    })
  })
})

describe('runner store and progress badge', () => {
  it('loads empty, valid, corrupt, and incompatible stores distinctly', () => {
    const storage = memoryStorage()
    const store = createRunnerStore(storage)
    expect(store.load()).toEqual({ status: 'empty' })

    expect(store.save(createRunnerSave('persisted', 900, true), { seed: 'persisted' })).toEqual({ ok: true })
    expect(store.load()).toMatchObject({
      status: 'ready',
      seed: 'persisted',
      value: { seed: 'persisted', bestScore: 900, tutorialComplete: true },
    })

    const corrupt = createRunnerStore(
      memoryStorage({ [RUNNER_SAVE_KEY]: '{broken json' }),
    )
    expect(corrupt.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'corrupt',
    })

    const incompatible = createRunnerStore(
      memoryStorage({
        [RUNNER_SAVE_KEY]: JSON.stringify({
          version: 2,
          savedAt: '2026-07-21T00:00:00.000Z',
          seed: 'future',
          data: createRunnerSave('future', 1, false),
        }),
      }),
    )
    expect(incompatible.load()).toMatchObject({
      status: 'recovery-required',
      reason: 'incompatible',
    })
  })

  it('returns stable empty, best-score, and recovery badges', () => {
    const emptyStore = createRunnerStore(memoryStorage())
    expect(getRunnerProgressBadge(emptyStore)).toEqual({
      label: 'Best score',
      value: '0',
      tone: 'neutral',
    })

    const readyStore = createRunnerStore(memoryStorage())
    readyStore.save(createRunnerSave('badge', 12_345, true))
    expect(getRunnerProgressBadge(readyStore)).toEqual({
      label: 'Best score',
      value: '12,345',
      tone: 'positive',
    })

    const brokenStore = createRunnerStore(
      memoryStorage({ [RUNNER_SAVE_KEY]: 'not-json' }),
    )
    expect(getRunnerProgressBadge(brokenStore)).toEqual({
      label: 'Best score',
      value: 'Reset required',
      tone: 'warning',
    })
  })
})
