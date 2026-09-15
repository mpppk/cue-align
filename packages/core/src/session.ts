import { Result } from '@praha/byethrow'

import type {
  CreateAlignmentSessionError,
  MarkCurrentError,
  MarkError,
  SeekCueError,
  SeekIndexError,
} from './errors'
import { getAlignment, getCurrentCue, getMark, isComplete } from './selectors'
import { createAlignmentState } from './state'
import type { CreateAlignmentStateOptions } from './state'
import {
  mark as applyMark,
  markCurrent as applyMarkCurrent,
  nextCue as applyNextCue,
  previousCue as applyPreviousCue,
  seekCue as applySeekCue,
  seekIndex as applySeekIndex,
  undo as applyUndo,
} from './transitions'
import type {
  Alignment,
  Cue,
  CueId,
  CueIndex,
  Mark,
  TimelinePosition,
} from './types'

export type AlignmentSession<TCue extends Cue> = {
  readonly cues: ReadonlyArray<TCue>
  readonly currentCue: TCue | undefined
  readonly currentIndex: CueIndex
  markCurrent: (at: TimelinePosition) => Result.Result<void, MarkCurrentError>
  mark: (cueId: CueId, at: TimelinePosition) => Result.Result<void, MarkError>
  undo: () => boolean
  seekCue: (cueId: CueId) => Result.Result<void, SeekCueError>
  seekIndex: (index: CueIndex) => Result.Result<void, SeekIndexError>
  nextCue: () => void
  previousCue: () => void
  getMark: (cueId: CueId) => Mark | undefined
  getAlignment: () => Alignment
  isComplete: () => boolean
}

export const createAlignmentSession = <TCue extends Cue>(
  options: CreateAlignmentStateOptions<TCue>,
): Result.Result<AlignmentSession<TCue>, CreateAlignmentSessionError> => {
  const stateResult = createAlignmentState(options)
  if (Result.isFailure(stateResult)) {
    return Result.fail(stateResult.error)
  }

  const cues = options.cues
  let state = stateResult.value

  const session: AlignmentSession<TCue> = {
    get cues() {
      return cues
    },
    get currentCue() {
      return getCurrentCue(state, cues)
    },
    get currentIndex() {
      return state.currentIndex
    },
    markCurrent: (at) => {
      const result = applyMarkCurrent(state, cues, at)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      state = result.value
      return Result.succeed(undefined)
    },
    mark: (cueId, at) => {
      const result = applyMark(state, cues, cueId, at)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      state = result.value
      return Result.succeed(undefined)
    },
    undo: () => {
      const result = applyUndo(state)
      state = result.state
      return result.undone
    },
    seekCue: (cueId) => {
      const result = applySeekCue(state, cues, cueId)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      state = result.value
      return Result.succeed(undefined)
    },
    seekIndex: (index) => {
      const result = applySeekIndex(state, cues, index)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      state = result.value
      return Result.succeed(undefined)
    },
    nextCue: () => {
      state = applyNextCue(state, cues)
    },
    previousCue: () => {
      state = applyPreviousCue(state)
    },
    getMark: (cueId) => getMark(state, cueId),
    getAlignment: () => getAlignment(state, cues),
    isComplete: () => isComplete(state, cues),
  }

  return Result.succeed(session)
}
