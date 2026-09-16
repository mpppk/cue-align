import { Result } from '@praha/byethrow'

import {
  DuplicateTrackAlignmentError,
  DuplicateTrackIdError,
  EmptyTrackIdError,
  EmptyTrackListError,
  UnknownTrackIdError,
} from './errors'
import type {
  CreateMultiTrackAlignmentStateError,
  SelectTrackError,
  ValidateCueTracksError,
  ValidateMultiTrackAlignmentError,
} from './errors'
import { getAlignment } from './selectors'
import { createAlignmentState } from './state'
import type {
  Alignment,
  Cue,
  CueTrack,
  MultiTrackAlignment,
  MultiTrackAlignmentState,
  TrackAlignment,
  TrackId,
} from './types'
import { validateAlignment, validateCues } from './validation'

export const validateCueTracks = <TCue extends Cue>(
  tracks: ReadonlyArray<CueTrack<TCue>>,
): Result.Result<void, ValidateCueTracksError> => {
  if (tracks.length === 0) {
    return Result.fail(new EmptyTrackListError())
  }

  const trackIds = new Set<TrackId>()

  for (const [index, track] of tracks.entries()) {
    if (track.id.length === 0) {
      return Result.fail(new EmptyTrackIdError({ index }))
    }

    if (trackIds.has(track.id)) {
      return Result.fail(new DuplicateTrackIdError({ trackId: track.id }))
    }

    const cueValidation = validateCues(track.cues)
    if (Result.isFailure(cueValidation)) {
      return Result.fail(cueValidation.error)
    }

    trackIds.add(track.id)
  }

  return Result.succeed(undefined)
}

export const trackAlignmentToAlignment = (
  trackAlignment: TrackAlignment,
): Alignment => ({
  version: 1,
  marks: trackAlignment.marks,
  ...(trackAlignment.ranges === undefined
    ? {}
    : { ranges: trackAlignment.ranges }),
})

export const alignmentToTrackAlignment = (
  trackId: TrackId,
  alignment: Alignment,
): TrackAlignment => ({
  trackId,
  marks: alignment.marks,
  ...(alignment.ranges === undefined ? {} : { ranges: alignment.ranges }),
})

export const validateMultiTrackAlignment = <TCue extends Cue>(
  tracks: ReadonlyArray<CueTrack<TCue>>,
  alignment: MultiTrackAlignment,
): Result.Result<
  ReadonlyMap<TrackId, Alignment>,
  ValidateMultiTrackAlignmentError
> => {
  const trackValidation = validateCueTracks(tracks)
  if (Result.isFailure(trackValidation)) {
    return Result.fail(trackValidation.error)
  }

  const tracksById = new Map(tracks.map((track) => [track.id, track]))
  const alignmentsByTrackId = new Map<TrackId, Alignment>()

  for (const trackAlignment of alignment.tracks) {
    const track = tracksById.get(trackAlignment.trackId)
    if (track === undefined) {
      return Result.fail(
        new UnknownTrackIdError({ trackId: trackAlignment.trackId }),
      )
    }

    if (alignmentsByTrackId.has(trackAlignment.trackId)) {
      return Result.fail(
        new DuplicateTrackAlignmentError({ trackId: trackAlignment.trackId }),
      )
    }

    const singleTrackAlignment = trackAlignmentToAlignment(trackAlignment)
    const alignmentValidation = validateAlignment(
      track.cues,
      singleTrackAlignment,
    )
    if (Result.isFailure(alignmentValidation)) {
      return Result.fail(alignmentValidation.error)
    }

    alignmentsByTrackId.set(trackAlignment.trackId, singleTrackAlignment)
  }

  return Result.succeed(alignmentsByTrackId)
}

export type CreateMultiTrackAlignmentStateOptions<TCue extends Cue> = {
  tracks: ReadonlyArray<CueTrack<TCue>>
  alignment?: MultiTrackAlignment
  initialTrackId?: TrackId
}

export const createMultiTrackAlignmentState = <TCue extends Cue>(
  options: CreateMultiTrackAlignmentStateOptions<TCue>,
): Result.Result<MultiTrackAlignmentState, CreateMultiTrackAlignmentStateError> => {
  const { tracks, alignment, initialTrackId } = options

  let alignmentsByTrackId: ReadonlyMap<TrackId, Alignment>
  if (alignment === undefined) {
    const trackValidation = validateCueTracks(tracks)
    if (Result.isFailure(trackValidation)) {
      return Result.fail(trackValidation.error)
    }
    alignmentsByTrackId = new Map()
  } else {
    const alignmentValidation = validateMultiTrackAlignment(tracks, alignment)
    if (Result.isFailure(alignmentValidation)) {
      return Result.fail(alignmentValidation.error)
    }
    alignmentsByTrackId = alignmentValidation.value
  }

  const firstTrack = tracks[0]
  if (firstTrack === undefined) {
    return Result.fail(new EmptyTrackListError())
  }

  const currentTrackId = initialTrackId ?? firstTrack.id
  if (!tracks.some((track) => track.id === currentTrackId)) {
    return Result.fail(new UnknownTrackIdError({ trackId: currentTrackId }))
  }

  const statesByTrackId = new Map<TrackId, MultiTrackAlignmentState['statesByTrackId'] extends ReadonlyMap<TrackId, infer TState> ? TState : never>()

  for (const track of tracks) {
    const stateResult = createAlignmentState({
      cues: track.cues,
      alignment: alignmentsByTrackId.get(track.id),
    })
    if (Result.isFailure(stateResult)) {
      return Result.fail(stateResult.error)
    }

    statesByTrackId.set(track.id, stateResult.value)
  }

  return Result.succeed({ currentTrackId, statesByTrackId })
}

export const selectTrack = <TCue extends Cue>(
  state: MultiTrackAlignmentState,
  tracks: ReadonlyArray<CueTrack<TCue>>,
  trackId: TrackId,
): Result.Result<MultiTrackAlignmentState, SelectTrackError> => {
  if (!tracks.some((track) => track.id === trackId)) {
    return Result.fail(new UnknownTrackIdError({ trackId }))
  }

  return Result.succeed({ ...state, currentTrackId: trackId })
}

export const getCurrentTrack = <TCue extends Cue>(
  state: MultiTrackAlignmentState,
  tracks: ReadonlyArray<CueTrack<TCue>>,
): CueTrack<TCue> | undefined =>
  tracks.find((track) => track.id === state.currentTrackId)

export const getMultiTrackAlignment = <TCue extends Cue>(
  state: MultiTrackAlignmentState,
  tracks: ReadonlyArray<CueTrack<TCue>>,
): MultiTrackAlignment => ({
  version: 2,
  tracks: tracks.flatMap((track) => {
    const trackState = state.statesByTrackId.get(track.id)
    if (trackState === undefined) {
      return []
    }

    return [alignmentToTrackAlignment(track.id, getAlignment(trackState, track.cues))]
  }),
})

export const getTrackAlignment = (
  alignment: MultiTrackAlignment,
  trackId: TrackId,
): Alignment | undefined => {
  const trackAlignment = alignment.tracks.find(
    (entry) => entry.trackId === trackId,
  )
  return trackAlignment === undefined
    ? undefined
    : trackAlignmentToAlignment(trackAlignment)
}
