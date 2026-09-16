import { Result } from '@praha/byethrow'
import { useRef, useState } from 'react'

import {
  adjustMark,
  clearRangeEnd,
  getMultiTrackAlignment,
  mark,
  markCurrent,
  nextCue as nextCueTransition,
  previousCue as previousCueTransition,
  seekCue,
  seekIndex,
  selectTrack as selectTrackTransition,
  setRangeEnd,
  undo,
} from '@mpppk/cue-align-core'
import type {
  AdjustMarkError,
  AlignmentState,
  ClearRangeEndError,
  Cue,
  CueId,
  CueIndex,
  CueTrack,
  MarkCurrentError,
  MarkError,
  MultiTrackAlignment,
  MultiTrackAlignmentState,
  SeekCueError,
  SeekIndexError,
  SelectTrackError,
  SetRangeEndError,
  TimelinePosition,
  TrackId,
} from '@mpppk/cue-align-core'
import {
  getAlignmentSessionSnapshot,
} from './useAlignmentSession'
import type {
  AlignmentSessionSnapshot,
} from './useAlignmentSession'

export type MultiTrackAlignmentSessionSnapshot<TCue extends Cue> =
  AlignmentSessionSnapshot<TCue> & {
    currentTrackId: TrackId
    currentTrack: CueTrack<TCue>
    multiTrackAlignment: MultiTrackAlignment
    trackCount: number
  }

const getCurrentTrackContext = <TCue extends Cue>(
  state: MultiTrackAlignmentState,
  tracks: ReadonlyArray<CueTrack<TCue>>,
): { track: CueTrack<TCue>; state: AlignmentState } => {
  const track = tracks.find((candidate) => candidate.id === state.currentTrackId)
  const trackState = state.statesByTrackId.get(state.currentTrackId)

  if (track === undefined || trackState === undefined) {
    const fallbackTrack = tracks[0]
    const fallbackState =
      fallbackTrack === undefined
        ? undefined
        : state.statesByTrackId.get(fallbackTrack.id)

    if (fallbackTrack === undefined || fallbackState === undefined) {
      throw new Error('Invalid multi-track Alignment state')
    }

    return { track: fallbackTrack, state: fallbackState }
  }

  return { track, state: trackState }
}

export const getMultiTrackAlignmentSessionSnapshot = <TCue extends Cue>(
  state: MultiTrackAlignmentState,
  tracks: ReadonlyArray<CueTrack<TCue>>,
): MultiTrackAlignmentSessionSnapshot<TCue> => {
  const current = getCurrentTrackContext(state, tracks)
  return {
    ...getAlignmentSessionSnapshot(current.state, current.track.cues),
    currentTrackId: current.track.id,
    currentTrack: current.track,
    multiTrackAlignment: getMultiTrackAlignment(state, tracks),
    trackCount: tracks.length,
  }
}

export type MultiTrackAlignmentSessionController<TCue extends Cue> =
  MultiTrackAlignmentSessionSnapshot<TCue> & {
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
    clearRangeEnd: (cueId: CueId) => Result.Result<void, ClearRangeEndError>
    undo: () => boolean
    seekCue: (cueId: CueId) => Result.Result<void, SeekCueError>
    seekIndex: (index: CueIndex) => Result.Result<void, SeekIndexError>
    goToNextCue: () => void
    goToPreviousCue: () => void
    selectTrack: (trackId: TrackId) => Result.Result<void, SelectTrackError>
  }

export const useMultiTrackAlignmentSession = <TCue extends Cue>(
  tracks: ReadonlyArray<CueTrack<TCue>>,
  initialState: MultiTrackAlignmentState,
): MultiTrackAlignmentSessionController<TCue> => {
  const [state, setState] = useState(initialState)
  const stateRef = useRef(state)

  const commit = (nextState: MultiTrackAlignmentState) => {
    stateRef.current = nextState
    setState(nextState)
  }

  const updateCurrentTrack = <TError extends Error>(
    transition: (
      trackState: AlignmentState,
      cues: ReadonlyArray<TCue>,
    ) => Result.Result<AlignmentState, TError>,
  ): Result.Result<void, TError> => {
    const currentState = stateRef.current
    const current = getCurrentTrackContext(currentState, tracks)
    const result = transition(current.state, current.track.cues)
    if (Result.isFailure(result)) {
      return Result.fail(result.error)
    }

    const statesByTrackId = new Map(currentState.statesByTrackId)
    statesByTrackId.set(current.track.id, result.value)
    commit({ ...currentState, statesByTrackId })
    return Result.succeed(undefined)
  }

  const snapshot = getMultiTrackAlignmentSessionSnapshot(state, tracks)

  return {
    ...snapshot,
    markCurrent: (at) =>
      updateCurrentTrack((trackState, cues) => markCurrent(trackState, cues, at)),
    mark: (cueId, at) =>
      updateCurrentTrack((trackState, cues) =>
        mark(trackState, cues, cueId, at),
      ),
    adjustMark: (cueId, at) =>
      updateCurrentTrack((trackState, cues) =>
        adjustMark(trackState, cues, cueId, at),
      ),
    setRangeEnd: (cueId, end) =>
      updateCurrentTrack((trackState, cues) =>
        setRangeEnd(trackState, cues, cueId, end),
      ),
    clearRangeEnd: (cueId) =>
      updateCurrentTrack((trackState, cues) =>
        clearRangeEnd(trackState, cues, cueId),
      ),
    undo: () => {
      const currentState = stateRef.current
      const current = getCurrentTrackContext(currentState, tracks)
      const result = undo(current.state)
      if (!result.undone) {
        return false
      }

      const statesByTrackId = new Map(currentState.statesByTrackId)
      statesByTrackId.set(current.track.id, result.state)
      commit({ ...currentState, statesByTrackId })
      return true
    },
    seekCue: (cueId) =>
      updateCurrentTrack((trackState, cues) =>
        seekCue(trackState, cues, cueId),
      ),
    seekIndex: (index) =>
      updateCurrentTrack((trackState, cues) =>
        seekIndex(trackState, cues, index),
      ),
    goToNextCue: () => {
      const currentState = stateRef.current
      const current = getCurrentTrackContext(currentState, tracks)
      const statesByTrackId = new Map(currentState.statesByTrackId)
      statesByTrackId.set(
        current.track.id,
        nextCueTransition(current.state, current.track.cues),
      )
      commit({ ...currentState, statesByTrackId })
    },
    goToPreviousCue: () => {
      const currentState = stateRef.current
      const current = getCurrentTrackContext(currentState, tracks)
      const statesByTrackId = new Map(currentState.statesByTrackId)
      statesByTrackId.set(current.track.id, previousCueTransition(current.state))
      commit({ ...currentState, statesByTrackId })
    },
    selectTrack: (trackId) => {
      const result = selectTrackTransition(stateRef.current, tracks, trackId)
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      commit(result.value)
      return Result.succeed(undefined)
    },
  }
}
