import { describe, expect, expectTypeOf, it } from 'vite-plus/test'

import {
  asCueId,
  asCueIndex,
  asTimelinePosition,
  createAlignmentState,
} from '@mpppk/cue-align-core'
import type { AlignmentState, Cue } from '@mpppk/cue-align-core'
import { getAlignmentSessionSnapshot } from './useAlignmentSession'
import type { AlignmentSessionSnapshot } from './useAlignmentSession'

type TestCue = Cue & {
  label: string
}

const cues: ReadonlyArray<TestCue> = [
  { id: asCueId('a'), label: 'Alpha' },
  { id: asCueId('b'), label: 'Beta' },
  { id: asCueId('c'), label: 'Gamma' },
]

describe('getAlignmentSessionSnapshot', () => {
  it('derives Cue context and progress from AlignmentState', () => {
    const stateResult = createAlignmentState({
      cues,
      alignment: {
        version: 1,
        marks: [
          { cueId: asCueId('a'), at: asTimelinePosition(1.5) },
          { cueId: asCueId('b'), at: asTimelinePosition(2) },
        ],
        ranges: [{ cueId: asCueId('b'), end: asTimelinePosition(3) }],
      },
      initialCueId: asCueId('b'),
    })

    expect(stateResult).toBeSuccess((state) => {
      const snapshot = getAlignmentSessionSnapshot(state, cues)

      expect(snapshot.currentCue?.label).toBe('Beta')
      expect(snapshot.previousCue?.label).toBe('Alpha')
      expect(snapshot.nextCue?.label).toBe('Gamma')
      expect(snapshot.currentMark).toEqual({ cueId: 'b', at: 2 })
      expect(snapshot.currentRange).toEqual({ cueId: 'b', end: 3 })
      expect(snapshot.markedCount).toBe(2)
      expect(snapshot.totalCount).toBe(3)
      expect(snapshot.isComplete).toBe(false)
    })
  })

  it('preserves the concrete Cue type in the snapshot', () => {
    const state: AlignmentState = {
      marksByCueId: new Map(),
      rangeEndsByCueId: new Map(),
      currentIndex: asCueIndex(0),
      history: [],
    }
    const snapshot = getAlignmentSessionSnapshot(state, cues)

    expectTypeOf(snapshot).toEqualTypeOf<AlignmentSessionSnapshot<TestCue>>()
    expectTypeOf(snapshot.currentCue?.label).toEqualTypeOf<string | undefined>()
  })
})
