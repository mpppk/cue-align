import { Result } from '@praha/byethrow'
import { useRef, useState } from 'react'

import {
  adjustMark,
  clearRangeEnd,
  getAlignment,
  getCurrentCue,
  getMark,
  getRange,
  isComplete,
  mark,
  markCurrent,
  nextCue as nextCueTransition,
  previousCue as previousCueTransition,
  seekCue,
  seekIndex,
  setRangeEnd,
  undo,
} from '@mpppk/cue-align-core'
import type {
  AdjustMarkError,
  Alignment,
  AlignmentState,
  ClearRangeEndError,
  Cue,
  CueId,
  CueIndex,
  CueRange,
  Mark,
  MarkCurrentError,
  MarkError,
  SeekCueError,
  SeekIndexError,
  SetRangeEndError,
  TimelinePosition,
} from '@mpppk/cue-align-core'

export type AlignmentSessionSnapshot<TCue extends Cue> = {
  currentCue: TCue | undefined
  previousCue: TCue | undefined
  nextCue: TCue | undefined
  currentIndex: CueIndex
  currentMark: Mark | undefined
  currentRange: CueRange | undefined
  alignment: Alignment
  markedCount: number
  totalCount: number
  isComplete: boolean
}

export const getAlignmentSessionSnapshot = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
): AlignmentSessionSnapshot<TCue> => {
  const currentCue = getCurrentCue(state, cues)
  const previous = cues[state.currentIndex - 1]
  const next = cues[state.currentIndex + 1]

  return {
    currentCue,
    previousCue: previous,
    nextCue: next,
    currentIndex: state.currentIndex,
    currentMark:
      currentCue === undefined ? undefined : getMark(state, currentCue.id),
    currentRange:
      currentCue === undefined ? undefined : getRange(state, currentCue.id),
    alignment: getAlignment(state, cues),
    markedCount: state.marksByCueId.size,
    totalCount: cues.length,
    isComplete: isComplete(state, cues),
  }
}

export type AlignmentSessionController<TCue extends Cue> =
  AlignmentSessionSnapshot<TCue> & {
    markCurrent: (at: TimelinePosition) => Result.Result<void, MarkCurrentError>
    mark: (cueId: CueId, at: TimelinePosition) => Result.Result<void, MarkError>
    adjustMark: (
      cueId: CueId,
      at: TimelinePosition,
    ) => Result.Result<void, AdjustMarkError>
    setRangeEnd: (
      cueId: CueId,
      end: TimelinePosition,
    ) => Result.Result<void, SetRangeEndError>
    clearRangeEnd: (
      cueId: CueId,
    ) => Result.Result<void, ClearRangeEndError>
    undo: () => boolean
    seekCue: (cueId: CueId) => Result.Result<void, SeekCueError>
    seekIndex: (index: CueIndex) => Result.Result<void, SeekIndexError>
    goToNextCue: () => void
    goToPreviousCue: () => void
  }

export const useAlignmentSession = <TCue extends Cue>(
  cues: ReadonlyArray<TCue>,
  initialState: AlignmentState,
): AlignmentSessionController<TCue> => {
  const [state, setState] = useState(initialState)
  const stateRef = useRef(state)

  const commit = (nextState: AlignmentState) => {
    stateRef.current = nextState
    setState(nextState)
  }

  const snapshot = getAlignmentSessionSnapshot(state, cues)

  return {
    ...snapshot,
    markCurrent: (at) => {
      const result = markCurrent(stateRef.current, cues, at)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      commit(result.value)
      return Result.succeed(undefined)
    },
    mark: (cueId, at) => {
      const result = mark(stateRef.current, cues, cueId, at)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      commit(result.value)
      return Result.succeed(undefined)
    },
    adjustMark: (cueId, at) => {
      const result = adjustMark(stateRef.current, cues, cueId, at)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      commit(result.value)
      return Result.succeed(undefined)
    },
    setRangeEnd: (cueId, end) => {
      const result = setRangeEnd(stateRef.current, cues, cueId, end)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      commit(result.value)
      return Result.succeed(undefined)
    },
    clearRangeEnd: (cueId) => {
      const result = clearRangeEnd(stateRef.current, cues, cueId)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      commit(result.value)
      return Result.succeed(undefined)
    },
    undo: () => {
      const result = undo(stateRef.current)
      if (result.undone) {
        commit(result.state)
      }
      return result.undone
    },
    seekCue: (cueId) => {
      const result = seekCue(stateRef.current, cues, cueId)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      commit(result.value)
      return Result.succeed(undefined)
    },
    seekIndex: (index) => {
      const result = seekIndex(stateRef.current, cues, index)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      commit(result.value)
      return Result.succeed(undefined)
    },
    goToNextCue: () => {
      commit(nextCueTransition(stateRef.current, cues))
    },
    goToPreviousCue: () => {
      commit(previousCueTransition(stateRef.current))
    },
  }
}
