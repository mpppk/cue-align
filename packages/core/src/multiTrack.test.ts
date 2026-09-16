import { describe, expect, it } from 'vite-plus/test'

import { Result } from '@praha/byethrow'
import { DuplicateTrackIdError, UnknownTrackIdError } from './errors'
import {
  createMultiTrackAlignmentState,
  getMultiTrackAlignment,
  selectTrack,
  validateMultiTrackAlignment,
} from './multiTrack'
import { mark } from './transitions'
import {
  asCueId,
  asTimelinePosition,
  asTrackId,
} from './types'
import type { CueTrack, MultiTrackAlignment } from './types'

const sharedCueId = asCueId('intro')
const tracks: ReadonlyArray<CueTrack> = [
  {
    id: asTrackId('lyrics'),
    cues: [
      { id: sharedCueId },
      { id: asCueId('verse') },
    ],
  },
  {
    id: asTrackId('scenes'),
    cues: [
      { id: sharedCueId },
      { id: asCueId('close-up') },
    ],
  },
]

describe('multi-track alignment', () => {
  it('allows the same Cue ID in different tracks', () => {
    const alignment: MultiTrackAlignment = {
      version: 2,
      tracks: [
        {
          trackId: asTrackId('lyrics'),
          marks: [{ cueId: sharedCueId, at: asTimelinePosition(1) }],
        },
        {
          trackId: asTrackId('scenes'),
          marks: [{ cueId: sharedCueId, at: asTimelinePosition(2) }],
        },
      ],
    }

    expect(validateMultiTrackAlignment(tracks, alignment)).toBeSuccess()
  })

  it('keeps each track state independent when switching tracks', () => {
    const stateResult = createMultiTrackAlignmentState({ tracks })

    expect(stateResult).toBeSuccess((initialState) => {
      const lyrics = tracks[0]
      if (lyrics === undefined) {
        return
      }

      const lyricsState = initialState.statesByTrackId.get(lyrics.id)
      if (lyricsState === undefined) {
        return
      }

      const markResult = mark(
        lyricsState,
        lyrics.cues,
        sharedCueId,
        asTimelinePosition(1.25),
      )
      expect(Result.isSuccess(markResult)).toBe(true)
      if (Result.isFailure(markResult)) {
        return
      }

      const statesByTrackId = new Map(initialState.statesByTrackId)
      statesByTrackId.set(lyrics.id, markResult.value)
      const markedState = { ...initialState, statesByTrackId }

      const switchResult = selectTrack(
        markedState,
        tracks,
        asTrackId('scenes'),
      )
      expect(switchResult).toBeSuccess((switchedState) => {
        expect(switchedState.currentTrackId).toBe('scenes')
        expect(
          switchedState.statesByTrackId.get(asTrackId('lyrics'))?.marksByCueId.get(
            sharedCueId,
          ),
        ).toBe(1.25)
        expect(
          switchedState.statesByTrackId.get(asTrackId('scenes'))?.marksByCueId.size,
        ).toBe(0)

        expect(getMultiTrackAlignment(switchedState, tracks)).toEqual({
          version: 2,
          tracks: [
            {
              trackId: 'lyrics',
              marks: [{ cueId: 'intro', at: 1.25 }],
            },
            { trackId: 'scenes', marks: [] },
          ],
        })
      })
    })
  })

  it('rejects duplicate and unknown track IDs', () => {
    const duplicateTracks: ReadonlyArray<CueTrack> = [tracks[0]!, tracks[0]!]
    expect(createMultiTrackAlignmentState({ tracks: duplicateTracks })).toBeFailure(
      DuplicateTrackIdError,
    )

    const stateResult = createMultiTrackAlignmentState({ tracks })
    expect(stateResult).toBeSuccess((state) => {
      expect(
        selectTrack(state, tracks, asTrackId('missing')),
      ).toBeFailure(UnknownTrackIdError)
    })
  })
})
