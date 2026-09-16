import { Result } from '@praha/byethrow'

import {
  CueNotMarkedError,
  DuplicateCueIdError,
  DuplicateMarkError,
  DuplicateRangeError,
  EmptyCueIdError,
  InvalidRangeError,
  InvalidTimeError,
  NonMonotonicTimeError,
  UnknownCueIdError,
} from './errors'
import type { ValidateAlignmentError, ValidateCuesError } from './errors'
import { asCueIndex } from './types'
import type { Alignment, Cue, CueId, TimelinePosition } from './types'

export const validateCues = <TCue extends Cue>(
  cues: ReadonlyArray<TCue>,
): Result.Result<void, ValidateCuesError> => {
  const ids = new Set<CueId>()

  for (const [index, cue] of cues.entries()) {
    if (cue.id.length === 0) {
      return Result.fail(new EmptyCueIdError({ index: asCueIndex(index) }))
    }

    if (ids.has(cue.id)) {
      return Result.fail(new DuplicateCueIdError({ cueId: cue.id }))
    }

    ids.add(cue.id)
  }

  return Result.succeed(undefined)
}

export const validateTime = (
  at: TimelinePosition,
): Result.Result<TimelinePosition, InvalidTimeError> => {
  if (!Number.isFinite(at) || at < 0) {
    return Result.fail(new InvalidTimeError({ at }))
  }

  return Result.succeed(at)
}

export const validateRangeEnd = (
  cueId: CueId,
  start: TimelinePosition,
  end: TimelinePosition,
): Result.Result<TimelinePosition, InvalidTimeError | InvalidRangeError> => {
  const timeValidation = validateTime(end)
  if (Result.isFailure(timeValidation)) {
    return Result.fail(timeValidation.error)
  }

  if (end < start) {
    return Result.fail(new InvalidRangeError({ cueId, start, end }))
  }

  return Result.succeed(end)
}

export const validateAlignment = <TCue extends Cue>(
  cues: ReadonlyArray<TCue>,
  alignment: Alignment,
): Result.Result<
  ReadonlyMap<CueId, TimelinePosition>,
  ValidateAlignmentError
> => {
  const cueValidation = validateCues(cues)
  if (Result.isFailure(cueValidation)) {
    return Result.fail(cueValidation.error)
  }

  const cueIds = new Set(cues.map((cue) => cue.id))
  const marksByCueId = new Map<CueId, TimelinePosition>()

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

  let previousAt: TimelinePosition | undefined

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

  const rangeCueIds = new Set<CueId>()

  for (const range of alignment.ranges ?? []) {
    if (!cueIds.has(range.cueId)) {
      return Result.fail(new UnknownCueIdError({ cueId: range.cueId }))
    }

    if (rangeCueIds.has(range.cueId)) {
      return Result.fail(new DuplicateRangeError({ cueId: range.cueId }))
    }

    const start = marksByCueId.get(range.cueId)
    if (start === undefined) {
      return Result.fail(new CueNotMarkedError({ cueId: range.cueId }))
    }

    const rangeValidation = validateRangeEnd(range.cueId, start, range.end)
    if (Result.isFailure(rangeValidation)) {
      return Result.fail(rangeValidation.error)
    }

    rangeCueIds.add(range.cueId)
  }

  return Result.succeed(marksByCueId)
}
