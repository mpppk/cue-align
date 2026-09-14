import { Result } from '@praha/byethrow'

import {
  InvalidCueIndexError,
  NonMonotonicTimeError,
  UnknownCueIdError,
} from './errors'
import type { AlignmentError } from './errors'
import type { AlignmentState, Cue, CueId } from './types'
import { validateTime } from './validation'

const markAtIndex = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
  index: number,
  at: number,
  advanceCursor: boolean,
): Result.Result<AlignmentState, AlignmentError> => {
  if (index < 0 || index >= cues.length) {
    return Result.fail(new InvalidCueIndexError({ index }))
  }

  const timeValidation = validateTime(at)
  if (Result.isFailure(timeValidation)) {
    return Result.fail(timeValidation.error)
  }

  let min: number | undefined
  for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
    const previousCue = cues[previousIndex]
    const previousAt = state.marksByCueId.get(previousCue.id)
    if (previousAt !== undefined) {
      min = previousAt
      break
    }
  }

  let max: number | undefined
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

  const marksByCueId = new Map(state.marksByCueId)
  const previousAt = marksByCueId.get(cue.id)
  marksByCueId.set(cue.id, at)

  const nextCursorIndex =
    advanceCursor && index + 1 < cues.length ? index + 1 : state.currentIndex

  return Result.succeed({
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
  at: number,
): Result.Result<AlignmentState, AlignmentError> =>
  markAtIndex(state, cues, state.currentIndex, at, true)

export const mark = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
  cueId: CueId,
  at: number,
): Result.Result<AlignmentState, AlignmentError> => {
  const index = cues.findIndex((cue) => cue.id === cueId)
  if (index === -1) {
    return Result.fail(new UnknownCueIdError({ cueId }))
  }

  return markAtIndex(state, cues, index, at, false)
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

  const marksByCueId = new Map(state.marksByCueId)
  if (entry.previousAt === undefined) {
    marksByCueId.delete(entry.cueId)
  } else {
    marksByCueId.set(entry.cueId, entry.previousAt)
  }

  return {
    state: {
      marksByCueId,
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
): Result.Result<AlignmentState, AlignmentError> => {
  const index = cues.findIndex((cue) => cue.id === cueId)
  if (index === -1) {
    return Result.fail(new UnknownCueIdError({ cueId }))
  }

  return Result.succeed({ ...state, currentIndex: index })
}

export const seekIndex = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
  index: number,
): Result.Result<AlignmentState, AlignmentError> => {
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

  return { ...state, currentIndex: state.currentIndex + 1 }
}

export const previousCue = (state: AlignmentState): AlignmentState => {
  if (state.currentIndex <= 0) {
    return state
  }

  return { ...state, currentIndex: state.currentIndex - 1 }
}
