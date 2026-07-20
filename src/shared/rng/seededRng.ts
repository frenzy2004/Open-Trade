const UINT32_RANGE = 4_294_967_296

export interface SeededRng {
  readonly seed: number
  next(): number
  int(minInclusive: number, maxExclusive: number): number
  pick<T>(values: readonly T[]): T
  shuffle<T>(values: readonly T[]): T[]
  fork(label: string): SeededRng
}

function hashString(value: string): number {
  let hash = 2_166_136_261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16_777_619)
  }

  return hash >>> 0
}

function normalizeSeed(seed: number | string): number {
  if (typeof seed === 'string') {
    return hashString(seed)
  }

  if (!Number.isFinite(seed)) {
    throw new RangeError('Seed must be a finite number or string')
  }

  return Math.trunc(seed) >>> 0
}

export function createSeededRng(seedInput: number | string): SeededRng {
  const seed = normalizeSeed(seedInput)
  let state = seed

  const api: SeededRng = {
    seed,
    next() {
      state = (state + 0x6d2b79f5) | 0
      let value = state
      value = Math.imul(value ^ (value >>> 15), value | 1)
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
      return ((value ^ (value >>> 14)) >>> 0) / UINT32_RANGE
    },
    int(minInclusive, maxExclusive) {
      if (!Number.isSafeInteger(minInclusive)) {
        throw new RangeError('minInclusive must be a safe integer')
      }
      if (!Number.isSafeInteger(maxExclusive)) {
        throw new RangeError('maxExclusive must be a safe integer')
      }
      if (maxExclusive <= minInclusive) {
        throw new RangeError(
          'maxExclusive must be greater than minInclusive',
        )
      }
      return (
        minInclusive +
        Math.floor(api.next() * (maxExclusive - minInclusive))
      )
    },
    pick<T>(values: readonly T[]) {
      if (values.length === 0) {
        throw new RangeError('Cannot pick from an empty list')
      }
      const selected = values[api.int(0, values.length)]
      if (selected === undefined) {
        throw new RangeError('Selected index was outside the list')
      }
      return selected
    },
    shuffle<T>(values: readonly T[]) {
      const shuffled = [...values]
      for (let index = shuffled.length - 1; index > 0; index -= 1) {
        const swapIndex = api.int(0, index + 1)
        const current = shuffled[index]
        const replacement = shuffled[swapIndex]
        if (current === undefined || replacement === undefined) {
          throw new RangeError('Shuffle index was outside the list')
        }
        shuffled[index] = replacement
        shuffled[swapIndex] = current
      }
      return shuffled
    },
    fork(label) {
      return createSeededRng(hashString(String(seed) + ':' + label))
    },
  }

  return api
}
