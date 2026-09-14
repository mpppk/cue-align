import { Result } from '@praha/byethrow'

import {
  DuplicateCueIdError,
  DuplicateMarkError,
  EmptyCueIdError,
  InvalidTimeError,
  NonMonotonicTimeError,
  UnknownCueIdError,
} from './errors'
import type { ValidateAlignmentError, ValidateCuesError } from './errors'
import type { Alignment, Cue, CueId } from './types'

export const validateCues = <TCue extends Cue>(
  cues: ReadonlyArray<TCue>,
): Result.Result<void, ValidateCuesError> => {
  const ids = new Set<CueId>()

  for (const [index, cue] of cues.entries()) {
    if (cue.id.length === 0) {
      return Result.fail(new EmptyCueIdError({ index }))
    }

    if (ids.has(cue.id)) {
      return Result.fail(new DuplicateCueIdError({ cueId: cue.id }))
    }

    ids.add(cue.id)
  }

  return Result.succeed(undefined)
}

export const validateTime = (
  at: number,
): Result.Result<number, InvalidTimeError> => {
  if (!Number.isFinite(at) || at < 0) {
    return Result.fail(new InvalidTimeError({ at }))
  }

  return Result.succeed(at)
}

export const validateAlignment = <TCue extends Cue>(
  cues: ReadonlyArray<TCue>,
  alignment: Alignment,
): Result.Result<ReadonlyMap<CueId, number>, ValidateAlignmentError> => {
  const cueValidation = validateCues(cues)
  if (Result.isFailure(cueValidation)) {
    return Result.fail(cueValidation.error)
  }

  const cueIds = new Set(cues.map((cue) => cue.id))
  const marksByCueId = new Map<CueId, number>()

  for (const mark of alignment.marks) {
    if (!cueIds.has(mark.cueId)) {
      return Result.fail(new UnknownCueIdError({ cueId: mark.cueId }))
    }

    if (marksByCueId.has(mark.cueId)) {
      return Result.fail(new DuplicateMarkError({ cueId: mark.cueId }))
    }

    const timeValidation = validateTime(mark.at)
    if (Result.isFailure(timeValidation)) {
      return Result.fail(timeValidation.error)
    }

    marksByCueId.set(mark.cueId, mark.at)
  }

  let previousAt: number | undefined

  for (const cue of cues) {
    const at = marksByCueId.get(cue.id)
    if (at === undefined) {
      continue
    }

    if (previousAt !== undefined && at < previousAt) {
      return Result.fail(
        new NonMonotonicTimeError({
          cueId: cue.id,
          at,
          min: previousAt,
        }),
      )
    }

    previousAt = at
  }

  return Result.succeed(marksByCueId)
}
