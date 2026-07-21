import type { FounderStyle } from './types'

type UnknownRecord = Record<string, unknown>

const FOUNDER_STYLES: readonly FounderStyle[] = [
  'visionary',
  'operator',
  'consensus',
]

function asRecord(value: unknown): UnknownRecord | null {
  try {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as UnknownRecord)
      : null
  } catch {
    return null
  }
}

function asArray(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value)) return null
    const source = value as readonly unknown[]
    // Materialize own slots only: a sparse array must not inherit authored
    // sources, decisions, choices, or IDs from a poisoned prototype.
    return Array.from({ length: source.length }, (_, index) =>
      Object.hasOwn(source, index) ? source[index] : undefined,
    )
  } catch {
    return null
  }
}

function read(record: UnknownRecord, key: string): unknown {
  try {
    return Object.hasOwn(record, key) ? record[key] : undefined
  } catch {
    return undefined
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function positiveFinite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
}

function positiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0
}

function integer(value: unknown): value is number {
  return Number.isSafeInteger(value)
}

function validHttpUrl(value: unknown): boolean {
  if (!nonEmptyString(value)) return false
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function validIsoDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }
  const parts = value.split('-')
  const year = Number(parts[0])
  const month = Number(parts[1])
  const day = Number(parts[2])
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function validateStyledCopy(
  value: unknown,
  path: string,
  errors: string[],
): void {
  const copy = asRecord(value)
  for (const style of ['classic', 'brainrot'] as const) {
    if (!copy || !nonEmptyString(read(copy, style))) {
      errors.push(`${path}.${style} must be non-empty`)
    }
  }
}

function validateSources(
  value: unknown,
  episodePath: string,
  errors: string[],
): Set<string> {
  const sources = asArray(value)
  const sourceIds = new Set<string>()
  if (!sources) {
    errors.push(`${episodePath} sources must be an array`)
    return sourceIds
  }

  sources.forEach((valueAtIndex, index) => {
    const source = asRecord(valueAtIndex)
    if (!source) {
      errors.push(`${episodePath}/sources[${index}] must be an object`)
      return
    }

    const rawId = read(source, 'id')
    const id = nonEmptyString(rawId) ? rawId : ''
    const path = `${episodePath}/${id || '<missing source id>'}`
    if (!id) {
      errors.push(`${path} source id must be non-empty`)
    } else if (sourceIds.has(id)) {
      errors.push(`${path} source id must be unique`)
    } else {
      sourceIds.add(id)
    }

    if (!nonEmptyString(read(source, 'title'))) {
      errors.push(`${path} title must be non-empty`)
    }
    if (!validHttpUrl(read(source, 'url'))) {
      errors.push(`${path} url must be an absolute http(s) URL`)
    }
    if (!nonEmptyString(read(source, 'publisher'))) {
      errors.push(`${path} publisher must be non-empty`)
    }
    if (!validIsoDate(read(source, 'accessed'))) {
      errors.push(`${path} accessed must use YYYY-MM-DD`)
    }
  })

  return sourceIds
}

function validateChoice(
  value: unknown,
  decisionPath: string,
  choiceIndex: number,
  seenChoiceIds: Set<string>,
  errors: string[],
): void {
  const choice = asRecord(value)
  if (!choice) {
    errors.push(`${decisionPath}/choices[${choiceIndex}] must be an object`)
    return
  }

  const rawId = read(choice, 'id')
  const id = nonEmptyString(rawId) ? rawId : ''
  const path = `${decisionPath}/${id || `choices[${choiceIndex}]`}`
  if (!id) {
    errors.push(`${path} choice id must be non-empty`)
  } else if (seenChoiceIds.has(id)) {
    errors.push(`${path} choice id must be unique within its decision`)
  } else {
    seenChoiceIds.add(id)
  }

  if (!nonEmptyString(read(choice, 'label'))) {
    errors.push(`${path} label must be non-empty`)
  }
  if (typeof read(choice, 'matchedHistory') !== 'boolean') {
    errors.push(`${path} matchedHistory must be a boolean`)
  }
  if (typeof read(choice, 'worked') !== 'boolean') {
    errors.push(`${path} worked must be a boolean`)
  }
  if (!positiveFinite(read(choice, 'valueMultiplier'))) {
    errors.push(`${path} valueMultiplier must be greater than 0`)
  }

  const styleWeights = asRecord(read(choice, 'styleWeights'))
  for (const style of FOUNDER_STYLES) {
    const weight = styleWeights ? read(styleWeights, style) : undefined
    if (
      typeof weight !== 'number' ||
      !Number.isFinite(weight) ||
      weight < 0
    ) {
      errors.push(
        `${path} styleWeights.${style} must be a non-negative finite number`,
      )
    }
  }

  validateStyledCopy(read(choice, 'outcome'), `${path} outcome`, errors)
}

function validateDecisions(
  value: unknown,
  episodePath: string,
  startYear: unknown,
  sourceIds: ReadonlySet<string>,
  errors: string[],
): void {
  const decisions = asArray(value)
  if (!decisions) {
    errors.push(`${episodePath} decisions must be an array`)
    return
  }
  if (decisions.length !== 5) {
    errors.push(`${episodePath} must contain exactly 5 decisions`)
  }

  const seenDecisionIds = new Set<string>()
  let previousYear: number | null = null
  decisions.forEach((valueAtIndex, decisionIndex) => {
    const decision = asRecord(valueAtIndex)
    if (!decision) {
      errors.push(`${episodePath}/decisions[${decisionIndex}] must be an object`)
      return
    }

    const rawId = read(decision, 'id')
    const id = nonEmptyString(rawId) ? rawId : ''
    const path = `${episodePath}/${id || `decisions[${decisionIndex}]`}`
    if (!id) {
      errors.push(`${path} decision id must be non-empty`)
    } else if (seenDecisionIds.has(id)) {
      errors.push(`${path} decision id must be unique`)
    } else {
      seenDecisionIds.add(id)
    }

    const year = read(decision, 'year')
    if (!integer(year)) {
      errors.push(`${path} year must be an integer`)
    } else {
      if (integer(startYear) && year < startYear) {
        errors.push(`${path} year must not precede the episode start year`)
      }
      if (previousYear !== null && year < previousYear) {
        errors.push(`${path} year must not precede the previous decision year`)
      }
      previousYear = year
    }

    validateStyledCopy(read(decision, 'prompt'), `${path} prompt`, errors)

    const references = asArray(read(decision, 'sourceIds'))
    if (!references || references.length === 0) {
      errors.push(`${path} must reference at least 1 source`)
    } else {
      const seenReferences = new Set<string>()
      references.forEach((reference, sourceIndex) => {
        if (!nonEmptyString(reference)) {
          errors.push(`${path} sourceIds[${sourceIndex}] must be non-empty`)
        } else if (seenReferences.has(reference)) {
          errors.push(`${path} source reference ${reference} must be unique`)
        } else {
          seenReferences.add(reference)
          if (!sourceIds.has(reference)) {
            errors.push(`${path} references unknown source ${reference}`)
          }
        }
      })
    }

    const choices = asArray(read(decision, 'choices'))
    if (!choices) {
      errors.push(`${path} choices must be an array`)
      return
    }
    if (choices.length !== 3) {
      errors.push(`${path} must contain exactly 3 choices`)
    }
    const hasHistoricalChoice = choices.some((choice) => {
      const candidate = asRecord(choice)
      return candidate !== null && read(candidate, 'matchedHistory') === true
    })
    if (!hasHistoricalChoice) {
      errors.push(`${path} must contain at least 1 historical choice`)
    }

    const seenChoiceIds = new Set<string>()
    choices.forEach((choice, choiceIndex) => {
      validateChoice(choice, path, choiceIndex, seenChoiceIds, errors)
    })
  })
}

/**
 * Validates untrusted episode content without mutating or retaining it.
 * Messages are emitted in stable field/source/decision/choice order.
 */
export function validateEpisode(episode: unknown): string[] {
  const record = asRecord(episode)
  if (!record) return ['<episode> must be an object']

  const errors: string[] = []
  const rawId = read(record, 'id')
  const id = nonEmptyString(rawId) ? rawId : ''
  const path = id || '<missing episode id>'

  if (!id) errors.push(`${path} id must be non-empty`)
  if (!positiveInteger(read(record, 'episodeNumber'))) {
    errors.push(`${path} episodeNumber must be a positive integer`)
  }
  if (!nonEmptyString(read(record, 'company'))) {
    errors.push(`${path} company must be non-empty`)
  }
  if (!nonEmptyString(read(record, 'founder'))) {
    errors.push(`${path} founder must be non-empty`)
  }
  const startYear = read(record, 'startYear')
  if (!integer(startYear)) errors.push(`${path} startYear must be an integer`)
  if (!positiveInteger(read(record, 'rulesetVersion'))) {
    errors.push(`${path} rulesetVersion must be a positive integer`)
  }
  if (!positiveFinite(read(record, 'initialValueBn'))) {
    errors.push(`${path} initialValueBn must be a positive finite number`)
  }
  if (!positiveFinite(read(record, 'historicalEndValueBn'))) {
    errors.push(`${path} historicalEndValueBn must be a positive finite number`)
  }

  validateStyledCopy(read(record, 'intro'), `${path} intro`, errors)
  const sourceIds = validateSources(read(record, 'sources'), path, errors)
  validateDecisions(
    read(record, 'decisions'),
    path,
    startYear,
    sourceIds,
    errors,
  )

  return errors
}
