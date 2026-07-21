import {
  type ComponentProps,
  type PropsWithChildren,
  useMemo,
} from 'react'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioProvider } from '../../../shared/audio/AudioContext'
import {
  AudioManager,
  type PlayableAudio,
} from '../../../shared/audio/AudioManager'
import { createSettingsStore } from '../../../shared/settings/settingsStore'
import {
  SettingsProvider as BaseSettingsProvider,
  useSettings,
} from '../../../shared/settings/SettingsContext'
import type { GameStore } from '../../../shared/persistence/gameStore'
import {
  WallstreetSurfersRoute,
  type WallstreetSurfersRouteProps,
} from '../WallstreetSurfersRoute'
import { createRunnerState } from '../engine/createRunnerState'
import { createRunnerSave, createRunnerStore } from '../persistence/runnerSave'
import {
  createRunnerGame,
  type RunnerGameFactory,
  type RunnerGameHandle,
} from './createRunnerGame'
import type { RunnerScene } from './RunnerScene'

vi.mock('phaser', () => {
  class Scene {
    readonly key = 'mock-scene'
  }
  return {
    default: {
      AUTO: 'AUTO',
      Scale: { FIT: 'FIT', CENTER_BOTH: 'CENTER_BOTH' },
      Scene,
      Game: class {
        readonly config = null
      },
    },
  }
})

function silentAudio(): PlayableAudio {
  const audio = {
    currentTime: 0,
    loop: false,
    volume: 1,
    play: async () => undefined,
    pause: () => undefined,
    addEventListener: () => undefined,
  }
  return audio
}

function SettingsProvider({
  children,
  ...props
}: PropsWithChildren<ComponentProps<typeof BaseSettingsProvider>>) {
  const audioManager = useMemo(() => new AudioManager(silentAudio), [])
  return (
    <BaseSettingsProvider {...props}>
      <AudioProvider manager={audioManager}>{children}</AudioProvider>
    </BaseSettingsProvider>
  )
}

function createMemoryStorage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('createRunnerGame', () => {
  it('configures one transparent FIT game and advances through capped fixed steps', () => {
    const parent = document.createElement('div')
    const destroy = vi.fn()
    const gameFactory = vi.fn<RunnerGameFactory>(() => ({ destroy }))
    const snapshots = vi.fn()

    const handle = createRunnerGame(parent, {
      seed: 'phaser-loop',
      reducedMotion: false,
      bestScore: 40,
      dprCap: 1.5,
      gameFactory,
      onSnapshot: snapshots,
    })

    expect(gameFactory).toHaveBeenCalledTimes(1)
    const config = gameFactory.mock.calls[0]?.[0]
    expect(config).toMatchObject({
      parent,
      width: 1280,
      height: 720,
      transparent: true,
      scale: { mode: 'FIT', autoCenter: 'CENTER_BOTH', autoRound: true },
    })
    expect(config?.resolution).toBeLessThanOrEqual(1.5)

    const scene = config?.scene as RunnerScene
    scene.update(0, 1_000)
    expect(handle.snapshot().elapsedMs).toBeCloseTo((5 * 1000) / 60, 8)
    expect(handle.diagnostics().droppedFrameMs).toBeCloseTo(
      1_000 - (5 * 1000) / 60,
      8,
    )
    expect(snapshots).toHaveBeenCalled()
    expect(Object.isFrozen(handle.snapshot())).toBe(true)

    handle.destroy()
    handle.destroy()
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(destroy).toHaveBeenCalledWith(true)
  })

  it('queues commands and auto-pauses only for document visibility', () => {
    let hidden = false
    vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden)
    const gameFactory = vi.fn<RunnerGameFactory>(() => ({ destroy: vi.fn() }))
    const handle = createRunnerGame(document.createElement('div'), {
      seed: 'visibility',
      reducedMotion: false,
      gameFactory,
    })
    const config = gameFactory.mock.calls[0]?.[0]
    const scene = config?.scene as RunnerScene

    handle.dispatch('MOVE_RIGHT')
    scene.update(0, 1000 / 60)
    expect(handle.snapshot().lane).toBe(1)

    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    const pausedAt = handle.snapshot().elapsedMs
    scene.update(0, 100)
    expect(handle.snapshot().phase).toBe('paused')
    expect(handle.snapshot().elapsedMs).toBe(pausedAt)

    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    expect(handle.snapshot().phase).toBe('running')

    handle.dispatch('PAUSE')
    scene.update(0, 1000 / 60)
    hidden = true
    document.dispatchEvent(new Event('visibilitychange'))
    hidden = false
    document.dispatchEvent(new Event('visibilitychange'))
    expect(handle.snapshot().phase).toBe('paused')
    handle.destroy()
  })

  it('runs at most five catch-up steps and records deterministic dropped time', () => {
    const gameFactory = vi.fn<RunnerGameFactory>(() => ({ destroy: vi.fn() }))
    const handle = createRunnerGame(document.createElement('div'), {
      seed: 'bounded-catch-up',
      reducedMotion: false,
      gameFactory,
    })
    const [creationCall] = gameFactory.mock.calls
    if (creationCall === undefined) throw new Error('Expected game creation')
    const scene = creationCall[0].scene

    scene.update(0, 250)

    expect(handle.snapshot().tick).toBe(5)
    expect(handle.diagnostics()).toMatchObject({
      droppedFrameMs: expect.closeTo(250 - (5 * 1000) / 60, 8),
      catchUpLimit: 5,
    })
    handle.destroy()
  })

  it('defaults the DPR request to 1.5 and throttles semantic snapshots', () => {
    vi.spyOn(window, 'devicePixelRatio', 'get').mockReturnValue(3)
    const gameFactory = vi.fn<RunnerGameFactory>(() => ({ destroy: vi.fn() }))
    const onSnapshot = vi.fn()
    const handle = createRunnerGame(document.createElement('div'), {
      seed: 'bounded-publish',
      reducedMotion: false,
      gameFactory,
      onSnapshot,
    })
    const [creationCall] = gameFactory.mock.calls
    if (creationCall === undefined) throw new Error('Expected game creation')
    const config = creationCall[0]
    const scene = config.scene

    for (let frame = 0; frame < 60; frame += 1) {
      scene.update(frame * (1000 / 60), 1000 / 60)
    }

    expect(config.resolution).toBe(1.5)
    expect(onSnapshot.mock.calls.length).toBeGreaterThanOrEqual(9)
    expect(onSnapshot.mock.calls.length).toBeLessThanOrEqual(12)
    handle.destroy()
  })

  it('updates reduced-motion rendering state without resetting the run', () => {
    const gameFactory = vi.fn<RunnerGameFactory>(() => ({ destroy: vi.fn() }))
    const handle = createRunnerGame(document.createElement('div'), {
      seed: 'motion-update',
      reducedMotion: false,
      gameFactory,
    })
    const [creationCall] = gameFactory.mock.calls
    if (creationCall === undefined) throw new Error('Expected game creation')
    const scene = creationCall[0].scene
    scene.update(0, 1000 / 60)
    const elapsedBefore = handle.snapshot().elapsedMs

    handle.setReducedMotion(true)

    expect(handle.snapshot()).toMatchObject({
      reducedMotion: true,
      elapsedMs: elapsedBefore,
      seed: 'motion-update',
    })
    handle.destroy()
  })

  it('bounds and coalesces hostile command bursts without warm-frame drains', () => {
    const gameFactory = vi.fn<RunnerGameFactory>(() => ({ destroy: vi.fn() }))
    const handle = createRunnerGame(document.createElement('div'), {
      seed: 'bounded-commands',
      reducedMotion: false,
      gameFactory,
    })
    const [creationCall] = gameFactory.mock.calls
    if (creationCall === undefined) throw new Error('Expected game creation')
    const scene = creationCall[0].scene
    for (let frame = 0; frame < 10; frame += 1) scene.update(0, 1000 / 60)
    expect(handle.diagnostics()).toMatchObject({
      commandDrainCount: 0,
      pendingCommands: 0,
    })

    for (let index = 0; index < 100; index += 1) {
      handle.dispatch(index % 2 === 0 ? 'MOVE_LEFT' : 'MOVE_RIGHT')
    }
    expect(handle.diagnostics().pendingCommands).toBeLessThanOrEqual(8)
    expect(handle.diagnostics().droppedCommands).toBeGreaterThan(0)
    scene.update(0, 1000 / 60)
    expect(handle.diagnostics()).toMatchObject({
      commandDrainCount: 1,
      pendingCommands: 0,
    })
    handle.destroy()
  })

  it('records a bounded 600-step CPU release sample', () => {
    const gameFactory = vi.fn<RunnerGameFactory>(() => ({ destroy: vi.fn() }))
    const handle = createRunnerGame(document.createElement('div'), {
      seed: 'e2e-6',
      reducedMotion: false,
      gameFactory,
    })
    const [creationCall] = gameFactory.mock.calls
    if (creationCall === undefined) throw new Error('Expected game creation')
    for (let frame = 0; frame < 700; frame += 1) {
      creationCall[0].scene.update(frame * (1000 / 60), 1000 / 60)
    }

    expect(handle.diagnostics()).toMatchObject({
      sampledSimulationSteps: 600,
      maxSimulationStepMs: expect.any(Number),
    })
    expect(handle.diagnostics().maxSimulationStepMs).toBeGreaterThanOrEqual(0)
    handle.destroy()
  })

  it('pauses world progression for an incomplete tutorial and starts in place', () => {
    const gameFactory = vi.fn<RunnerGameFactory>(() => ({ destroy: vi.fn() }))
    const handle = createRunnerGame(document.createElement('div'), {
      seed: 'tutorial-run',
      reducedMotion: false,
      tutorialComplete: false,
      gameFactory,
    })
    const [creationCall] = gameFactory.mock.calls
    if (creationCall === undefined) throw new Error('Expected game creation')
    const scene = creationCall[0].scene
    scene.update(0, 100)
    expect(handle.snapshot()).toMatchObject({ phase: 'tutorial', tick: 0 })

    handle.dispatch('MOVE_RIGHT')
    expect(handle.snapshot()).toMatchObject({ phase: 'tutorial', lane: 1 })
    handle.completeTutorial()
    scene.update(0, 1000 / 60)
    expect(handle.snapshot()).toMatchObject({ phase: 'running', tick: 1, lane: 0 })
    handle.destroy()
  })
})

function MotionToggle() {
  const { settings, updateSettings } = useSettings()
  return (
    <button
      type="button"
      onClick={() => updateSettings({ reducedMotion: !settings.reducedMotion })}
    >
      Toggle motion
    </button>
  )
}

describe('WallstreetSurfersRoute lifecycle', () => {
  it('creates once across rerenders, restores save data, and destroys on unmount', async () => {
    const storage = createMemoryStorage()
    const store = createRunnerStore(storage)
    store.save(createRunnerSave('saved-seed', 777, true), { seed: 'saved-seed' })
    const destroy = vi.fn()
    const snapshot = vi.fn(() => ({
      seed: 'saved-seed',
      bestScore: 888,
      score: 888,
    }))
    const handle = { destroy, dispatch: vi.fn(), snapshot } as unknown as RunnerGameHandle
    const createGame = vi.fn<NonNullable<WallstreetSurfersRouteProps['createGame']>>(
      () => handle,
    )
    const settingsStore = createSettingsStore(createMemoryStorage())

    const view = render(
      <MemoryRouter initialEntries={['/wallstreet-surfers']}>
        <SettingsProvider store={settingsStore}>
          <WallstreetSurfersRoute createGame={createGame} store={store} />
        </SettingsProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(createGame).toHaveBeenCalledTimes(1))
    expect(createGame.mock.calls[0]?.[1]).toMatchObject({
      seed: 'saved-seed',
      bestScore: 777,
      tutorialComplete: true,
    })

    view.rerender(
      <MemoryRouter initialEntries={['/wallstreet-surfers']}>
        <SettingsProvider store={settingsStore}>
          <WallstreetSurfersRoute createGame={createGame} store={store} />
        </SettingsProvider>
      </MemoryRouter>,
    )
    expect(createGame).toHaveBeenCalledTimes(1)

    view.unmount()
    expect(destroy).toHaveBeenCalledTimes(1)
    expect(store.load()).toMatchObject({
      status: 'ready',
      value: { bestScore: 888 },
    })
  })

  it('gives a compatible challenge seed priority over the stored seed', async () => {
    const storage = createMemoryStorage()
    const store = createRunnerStore(storage)
    store.save(createRunnerSave('stored', 55, true), { seed: 'stored' })
    const createGame = vi.fn<NonNullable<WallstreetSurfersRouteProps['createGame']>>(
      () => ({
        destroy: vi.fn(),
        dispatch: vi.fn(),
        snapshot: () => ({ seed: 'challenge', bestScore: 55, score: 0 }),
      }) as unknown as RunnerGameHandle,
    )

    render(
      <MemoryRouter initialEntries={['/wallstreet-surfers?seed=challenge&rules=1']}>
        <SettingsProvider store={createSettingsStore(createMemoryStorage())}>
          <WallstreetSurfersRoute createGame={createGame} store={store} />
        </SettingsProvider>
      </MemoryRouter>,
    )

    await waitFor(() => expect(createGame).toHaveBeenCalledTimes(1))
    expect(createGame.mock.calls[0]?.[1]).toMatchObject({
      seed: 'challenge',
      bestScore: 55,
    })
  })

  it('does not recreate the game for a snapshot-driven React update', async () => {
    let publish: ((handle: RunnerGameHandle) => void) | undefined
    const handle = {
      destroy: vi.fn(),
      dispatch: vi.fn(),
      snapshot: vi.fn(() => createRunnerState({
        seed: 'react-update',
        reducedMotion: false,
      })),
    } as unknown as RunnerGameHandle
    const createGame = vi.fn<NonNullable<WallstreetSurfersRouteProps['createGame']>>((_parent, options) => {
      publish = () => options.onSnapshot?.(handle.snapshot())
      return handle
    })

    render(
      <MemoryRouter initialEntries={['/wallstreet-surfers?seed=react-update&rules=1']}>
        <SettingsProvider store={createSettingsStore(createMemoryStorage())}>
          <WallstreetSurfersRoute
            createGame={createGame}
            store={createRunnerStore(createMemoryStorage())}
          />
        </SettingsProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(createGame).toHaveBeenCalledTimes(1))

    act(() => publish?.(handle))
    expect(createGame).toHaveBeenCalledTimes(1)
  })

  it('updates reduced motion in place instead of recreating an active run', async () => {
    const handle = {
      destroy: vi.fn(),
      dispatch: vi.fn(),
      snapshot: vi.fn(() => createRunnerState({
        seed: 'route-motion',
        reducedMotion: false,
      })),
      setReducedMotion: vi.fn(),
      diagnostics: vi.fn(),
    } as unknown as RunnerGameHandle
    const createGame = vi.fn<NonNullable<WallstreetSurfersRouteProps['createGame']>>(
      () => handle,
    )

    render(
      <MemoryRouter initialEntries={['/wallstreet-surfers?seed=route-motion&rules=1']}>
        <SettingsProvider store={createSettingsStore(createMemoryStorage())}>
          <MotionToggle />
          <WallstreetSurfersRoute
            createGame={createGame}
            store={createRunnerStore(createMemoryStorage())}
          />
        </SettingsProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(createGame).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: 'Toggle motion' }))

    expect(createGame).toHaveBeenCalledTimes(1)
    expect(handle.setReducedMotion).toHaveBeenLastCalledWith(true)
  })

  it('pauses only for the lifetime of an open modal dialog', async () => {
    const state = createRunnerState({
      seed: 'modal-pause',
      reducedMotion: false,
    })
    const dispatch = vi.fn((command: string) => {
      if (command === 'PAUSE') {
        state.phase = state.phase === 'running' ? 'paused' : 'running'
      }
    })
    const handle = {
      destroy: vi.fn(),
      dispatch,
      snapshot: () => state,
      setReducedMotion: vi.fn(),
      diagnostics: vi.fn(),
    } as unknown as RunnerGameHandle

    render(
      <MemoryRouter initialEntries={['/wallstreet-surfers?seed=modal-pause&rules=1']}>
        <SettingsProvider store={createSettingsStore(createMemoryStorage())}>
          <WallstreetSurfersRoute
            createGame={() => handle}
            store={createRunnerStore(createMemoryStorage())}
          />
        </SettingsProvider>
      </MemoryRouter>,
    )
    const dialog = document.createElement('dialog')
    dialog.setAttribute('open', '')
    document.body.append(dialog)

    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(1))
    expect(state.phase).toBe('paused')
    dialog.remove()
    await waitFor(() => expect(dispatch).toHaveBeenCalledTimes(2))
    expect(state.phase).toBe('running')
  })

  it('surfaces malformed explicit challenge links', () => {
    render(
      <MemoryRouter initialEntries={['/wallstreet-surfers?seed=%20bad&rules=nope']}>
        <SettingsProvider store={createSettingsStore(createMemoryStorage())}>
          <WallstreetSurfersRoute
            createGame={() => ({
              destroy: vi.fn(),
              dispatch: vi.fn(),
              completeTutorial: vi.fn(),
              snapshot: () => createRunnerState({ seed: 'fallback', reducedMotion: false }),
              setReducedMotion: vi.fn(),
              diagnostics: vi.fn(),
            })}
            store={createRunnerStore(createMemoryStorage())}
          />
        </SettingsProvider>
      </MemoryRouter>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent(/challenge link is invalid/i)
  })

  it('surfaces a failed game-over save', async () => {
    let publish: ((state: ReturnType<typeof createRunnerState>) => void) | undefined
    const store: GameStore<ReturnType<typeof createRunnerSave>> = {
      load: () => ({ status: 'empty' }),
      save: () => ({ ok: false, reason: 'storage-unavailable' }),
      clear: () => ({ ok: true }),
    }
    const createGame: NonNullable<WallstreetSurfersRouteProps['createGame']> = (
      _parent,
      options,
    ) => {
      publish = options.onSnapshot
      return {
        destroy: vi.fn(),
        dispatch: vi.fn(),
        completeTutorial: vi.fn(),
        snapshot: () => createRunnerState({ seed: 'save-failure', reducedMotion: false }),
        setReducedMotion: vi.fn(),
        diagnostics: vi.fn(),
      }
    }

    render(
      <MemoryRouter initialEntries={['/wallstreet-surfers?seed=save-failure&rules=1']}>
        <SettingsProvider store={createSettingsStore(createMemoryStorage())}>
          <WallstreetSurfersRoute createGame={createGame} store={store} />
        </SettingsProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(publish).toBeTypeOf('function'))
    const gameOver = createRunnerState({ seed: 'save-failure', reducedMotion: false })
    gameOver.phase = 'gameOver'

    act(() => publish?.(gameOver))

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not save/i)
  })

  it('persists live tutorial completion only after all touch steps', async () => {
    const storage = createMemoryStorage()
    const store = createRunnerStore(storage)
    const completeTutorial = vi.fn()
    const state = createRunnerState({ seed: 'tutorial-route', reducedMotion: false })
    state.phase = 'tutorial'
    const handle = {
      destroy: vi.fn(),
      dispatch: vi.fn(),
      completeTutorial,
      snapshot: () => state,
      setReducedMotion: vi.fn(),
      diagnostics: vi.fn(),
    } as RunnerGameHandle
    const createGame = vi.fn<NonNullable<WallstreetSurfersRouteProps['createGame']>>(
      () => handle,
    )

    render(
      <MemoryRouter initialEntries={['/wallstreet-surfers?seed=tutorial-route&rules=1']}>
        <SettingsProvider store={createSettingsStore(createMemoryStorage())}>
          <WallstreetSurfersRoute createGame={createGame} store={store} />
        </SettingsProvider>
      </MemoryRouter>,
    )
    await waitFor(() => expect(createGame).toHaveBeenCalledTimes(1))

    fireEvent.click(screen.getByRole('button', { name: /move left/i }))
    fireEvent.click(screen.getByRole('button', { name: /jump/i }))
    fireEvent.click(screen.getByRole('button', { name: /roll/i }))
    expect(completeTutorial).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^long$/i }))

    await waitFor(() => expect(completeTutorial).toHaveBeenCalledTimes(1))
    expect(store.load()).toMatchObject({
      status: 'ready',
      value: { tutorialComplete: true },
    })
  })

  it('copies a full challenge URL only after the explicit game-over action', async () => {
    const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard')
    const writeText = vi.fn<(text: string) => Promise<void>>(async () => undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    let publish: ((state: ReturnType<typeof createRunnerState>) => void) | undefined
    const gameOver = createRunnerState({ seed: 'share-route', reducedMotion: false })
    gameOver.phase = 'gameOver'
    gameOver.lastFailure = {
      kind: 'barrier',
      message: 'You ate the barrier',
      tip: 'Jump or switch lanes before the barrier',
    }
    const handle: RunnerGameHandle = {
      destroy: vi.fn(),
      dispatch: vi.fn(),
      completeTutorial: vi.fn(),
      snapshot: () => gameOver,
      setReducedMotion: vi.fn(),
      diagnostics: () => ({
        catchUpLimit: 5,
        commandDrainCount: 0,
        droppedCommands: 0,
        droppedFrameMs: 0,
        sampledSimulationSteps: 0,
        maxSimulationStepMs: 0,
        pendingCommands: 0,
      }),
    }
    const createGame: NonNullable<WallstreetSurfersRouteProps['createGame']> = (
      _parent,
      options,
    ) => {
      publish = options.onSnapshot
      return handle
    }
    const store = createRunnerStore(createMemoryStorage())
    store.save(createRunnerSave('share-route', 0, true), { seed: 'share-route' })

    try {
      render(
        <MemoryRouter initialEntries={['/wallstreet-surfers?seed=share-route&rules=1']}>
          <SettingsProvider store={createSettingsStore(createMemoryStorage())}>
            <WallstreetSurfersRoute createGame={createGame} store={store} />
          </SettingsProvider>
        </MemoryRouter>,
      )
      await waitFor(() => expect(publish).toBeTypeOf('function'))
      act(() => publish?.(gameOver))
      expect(writeText).not.toHaveBeenCalled()

      fireEvent.click(screen.getByRole('button', { name: 'Challenge a friend' }))

      await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1))
      expect(writeText.mock.calls[0]?.[0]).toMatch(
        /#\/wallstreet-surfers\?seed=share-route&rules=1$/,
      )
      expect(screen.getByRole('status')).toHaveTextContent(/challenge link copied/i)
    } finally {
      if (clipboardDescriptor === undefined) {
        Reflect.deleteProperty(navigator, 'clipboard')
      } else {
        Object.defineProperty(navigator, 'clipboard', clipboardDescriptor)
      }
    }
  })
})
