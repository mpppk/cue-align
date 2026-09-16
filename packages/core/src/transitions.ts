import { Result } from '@praha/byethrow'

import {
  CueNotMarkedError,
  InvalidCueIndexError,
  InvalidRangeError,
  NonMonotonicTimeError,
  UnknownCueIdError,
} from './errors'
import type {
  AdjustMarkError,
  ClearRangeEndError,
  InvalidTimeError,
  MarkCurrentError,
  MarkError,
  SeekCueError,
  SeekIndexError,
  SetRangeEndError,
} from './errors'
import { asCueIndex } from './types'
import type {
  AlignmentState,
  Cue,
  CueId,
  CueIndex,
  TimelinePosition,
} from './types'
import { validateRangeEnd, validateTime } from './validation'

type MarkKnownIndexError =
  | InvalidTimeError
  | InvalidRangeError
  | NonMonotonicTimeError

const markAtKnownIndex = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
  index: CueIndex,
  at: TimelinePosition,
  advanceCursor: boolean,
): Result.Result<AlignmentState, MarkKnownIndexError> => {
  const timeValidation = validateTime(at)
  if (Result.isFailure(timeValidation)) {
    return Result.fail(timeValidation.error)
  }

  let min: TimelinePosition | undefined
  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
    const previousCue = cues[previousIndex]
    const previousAt = state.marksByCueId.get(previousCue.id)
    if (previousAt !== undefined) {
      min = previousAt
      break
    }
  }

  let max: TimelinePosition | undefined
  for (let nextIndex = index + 1; nextIndex < cues.length; nextIndex += 1) {
    const nextCue = cues[nextIndex]
    const nextAt = state.marksByCueId.get(nextCue.id)
    if (nextAt !== undefined) {
      max = nextAt
      break
    }
  }

  const cue = cues[index]

  if ((min !== undefined && at < min) || (max !== undefined && at > max)) {
    return Result.fail(
      new NonMonotonicTimeError({
        cueId: cue.id,
        at,
        min,
        max,
      }),
    )
  }

  const end = state.rangeEndsByCueId.get(cue.id)
  if (end !== undefined && at > end) {
    return Result.fail(new InvalidRangeError({ cueId: cue.id, start: at, end }))
  }

  const marksByCueId = new Map(state.marksByCueId)
  const previousAt = marksByCueId.get(cue.id)
  marksByCueId.set(cue.id, at)

  const nextCursorIndex =
    advanceCursor && index + 1 < cues.length
      ? asCueIndex(index + 1)
      : state.currentIndex

  return Result.succeed({
    ...state,
    marksByCueId,
    currentIndex: nextCursorIndex,
    history: [
      ...state.history,
      {
        type: 'mark',
        cueId: cue.id,
        previousAt,
        previousCursorIndex: state.currentIndex,
      },
    ],
  })
}

export const markCurrent = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
  at: TimelinePosition,
): Result.Result<AlignmentState, MarkCurrentError> => {
  const index = state.currentIndex
  if (index < 0 || index >= cues.length) {
    return Result.fail(new InvalidCueIndexError({ index }))
  }

  return markAtKnownIndex(state, cues, index, at, true)
}

export const mark = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
  cueId: CueId,
  at: TimelinePosition,
): Result.Result<AlignmentState, MarkError> => {
  const index = cues.findIndex((cue) => cue.id === cueId)
  if (index === -1) {
    return Result.fail(new UnknownCueIdError({ cueId }))
  }

  return markAtKnownIndex(state, cues, asCueIndex(index), at, false)
}

export const adjustMark = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
  cueId: CueId,
  at: TimelinePosition,
): Result.Result<AlignmentState, AdjustMarkError> => {
  const index = cues.findIndex((cue) => cue.id === cueId)
  if (index === -1) {
    return Result.fail(new UnknownCueIdError({ cueId }))
  }

  if (!state.marksByCueId.has(cueId)) {
    return Result.fail(new CueNotMarkedError({ cueId }))
  }

  return markAtKnownIndex(state, cues, asCueIndex(index), at, false)
}

export const setRangeEnd = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
  cueId: CueId,
  end: TimelinePosition,
): Result.Result<AlignmentState, SetRangeEndError> => {
  if (!cues.some((cue) => cue.id === cueId)) {
    return Result.fail(new UnknownCueIdError({ cueId }))
  }

  const start = state.marksByCueId.get(cueId)
  if (start === undefined) {
    return Result.fail(new CueNotMarkedError({ cueId }))
  }

  const rangeValidation = validateRangeEnd(cueId, start, end)
  if (Result.isFailure(rangeValidation)) {
    return Result.fail(rangeValidation.error)
  }

  const rangeEndsByCueId = new Map(state.rangeEndsByCueId)
  const previousEnd = rangeEndsByCueId.get(cueId)
  rangeEndsByCueId.set(cueId, end)

  return Result.succeed({
    ...state,
    rangeEndsByCueId,
    history: [
      ...state.history,
      {
        type: 'range',
        cueId,
        previousEnd,
        previousCursorIndex: state.currentIndex,
      },
    ],
  })
}

export const clearRangeEnd = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
  cueId: CueId,
): Result.Result<AlignmentState, ClearRangeEndError> => {
  if (!cues.some((cue) => cue.id === cueId)) {
    return Result.fail(new UnknownCueIdError({ cueId }))
  }

  const previousEnd = state.rangeEndsByCueId.get(cueId)
  if (previousEnd === undefined) {
    return Result.succeed(state)
  }

  const rangeEndsByCueId = new Map(state.rangeEndsByCueId)
  rangeEndsByCueId.delete(cueId)

  return Result.succeed({
    ...state,
    rangeEndsByCueId,
    history: [
      ...state.history,
      {
        type: 'range',
        cueId,
        previousEnd,
        previousCursorIndex: state.currentIndex,
      },
    ],
  })
}

export type UndoResult = {
  state: AlignmentState
  undone: boolean
}

export const undo = (state: AlignmentState): UndoResult => {
  const entry = state.history.at(-1)
  if (entry === undefined) {
    return { state, undone: false }
  }

  if (entry.type === 'mark') {
    const marksByCueId = new Map(state.marksByCueId)
    if (entry.previousAt === undefined) {
      marksByCueId.delete(entry.cueId)
    } else {
      marksByCueId.set(entry.cueId, entry.previousAt)
    }

    return {
      state: {
        ...state,
        marksByCueId,
        currentIndex: entry.previousCursorIndex,
        history: state.history.slice(0, -1),
      },
      undone: true,
    }
  }

  const rangeEndsByCueId = new Map(state.rangeEndsByCueId)
  if (entry.previousEnd === undefined) {
    rangeEndsByCueId.delete(entry.cueId)
  } else {
    rangeEndsByCueId.set(entry.cueId, entry.previousEnd)
  }

  return {
    state: {
      ...state,
      rangeEndsByCueId,
      currentIndex: entry.previousCursorIndex,
      history: state.history.slice(0, -1),
    },
    undone: true,
  }
}

export const seekCue = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
  cueId: CueId,
): Result.Result<AlignmentState, SeekCueError> => {
  const index = cues.findIndex((cue) => cue.id === cueId)
  if (index === -1) {
    return Result.fail(new UnknownCueIdError({ cueId }))
  }

  return Result.succeed({ ...state, currentIndex: asCueIndex(index) })
}

export const seekIndex = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
  index: CueIndex,
): Result.Result<AlignmentState, SeekIndexError> => {
  if (index < 0 || index >= cues.length) {
    return Result.fail(new InvalidCueIndexError({ index }))
  }

  return Result.succeed({ ...state, currentIndex: index })
}

export const nextCue = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
): AlignmentState => {
  if (state.currentIndex >= cues.length - 1) {
    return state
  }

  return { ...state, currentIndex: asCueIndex(state.currentIndex + 1) }
}

export const previousCue = (state: AlignmentState): AlignmentState => {
  if (state.currentIndex <= 0) {
    return state
  }

  return { ...state, currentIndex: asCueIndex(state.currentIndex - 1) }
}
