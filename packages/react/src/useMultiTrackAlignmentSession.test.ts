import { describe, expect, expectTypeOf, it } from 'vite-plus/test'

import {
  asCueId,
  asTimelinePosition,
  asTrackId,
  createMultiTrackAlignmentState,
} from '@mpppk/cue-align-core'
import type { Cue, CueTrack } from '@mpppk/cue-align-core'
import { getMultiTrackAlignmentSessionSnapshot } from './useMultiTrackAlignmentSession'
import type { MultiTrackAlignmentSessionSnapshot } from './useMultiTrackAlignmentSession'

type TestCue = Cue & { label: string }

const tracks: ReadonlyArray<CueTrack<TestCue>> = [
  {
    id: asTrackId('lyrics'),
    cues: [
      { id: asCueId('a'), label: 'Alpha' },
      { id: asCueId('b'), label: 'Beta' },
    ],
  },
  {
    id: asTrackId('scenes'),
    cues: [{ id: asCueId('a'), label: 'Scene A' }],
  },
]

describe('getMultiTrackAlignmentSessionSnapshot', () => {
  it('derives only the selected track context', () => {
    const stateResult = createMultiTrackAlignmentState({
      tracks,
      alignment: {
        version: 2,
        tracks: [
          {
            trackId: asTrackId('lyrics'),
            marks: [{ cueId: asCueId('a'), at: asTimelinePosition(1) }],
          },
          {
            trackId: asTrackId('scenes'),
            marks: [{ cueId: asCueId('a'), at: asTimelinePosition(3) }],
          },
        ],
      },
      initialTrackId: asTrackId('scenes'),
    })

    expect(stateResult).toBeSuccess((state) => {
      const snapshot = getMultiTrackAlignmentSessionSnapshot(state, tracks)
      expect(snapshot.currentTrackId).toBe('scenes')
      expect(snapshot.currentCue?.label).toBe('Scene A')
      expect(snapshot.alignment).toEqual({
        version: 1,
        marks: [{ cueId: 'a', at: 3 }],
      })
      expect(snapshot.trackCount).toBe(2)
      expectTypeOf(snapshot).toEqualTypeOf<
        MultiTrackAlignmentSessionSnapshot<TestCue>
      >()
    })
  })
})
