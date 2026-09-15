import { describe, expect, expectTypeOf, it } from 'vite-plus/test'

import {
  asCueId,
  asCueIndex,
  asTimelinePosition,
  createAlignmentState,
} from '@mpppk/cue-align-core'
import type { AlignmentState } from '@mpppk/cue-align-core'
import type { ReferenceCue } from './input'
import { getAlignmentSessionSnapshot } from './useAlignmentSession'
import type { AlignmentSessionSnapshot } from './useAlignmentSession'

const cues: ReadonlyArray<ReferenceCue> = [
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
        marks: [{ cueId: asCueId('a'), at: asTimelinePosition(1.5) }],
      },
      initialCueId: asCueId('b'),
    })

    expect(stateResult).toBeSuccess((state) => {
      const snapshot = getAlignmentSessionSnapshot(state, cues)

      expect(snapshot.currentCue?.label).toBe('Beta')
      expect(snapshot.previousCue?.label).toBe('Alpha')
      expect(snapshot.nextCue?.label).toBe('Gamma')
      expect(snapshot.currentMark).toBeUndefined()
      expect(snapshot.markedCount).toBe(1)
      expect(snapshot.totalCount).toBe(3)
      expect(snapshot.isComplete).toBe(false)
    })
  })

  it('preserves the concrete Cue type in the snapshot', () => {
    const state: AlignmentState = {
      marksByCueId: new Map(),
      currentIndex: asCueIndex(0),
      history: [],
    }
    const snapshot = getAlignmentSessionSnapshot(state, cues)

    expectTypeOf(snapshot).toEqualTypeOf<
      AlignmentSessionSnapshot<ReferenceCue>
    >()
    expectTypeOf(snapshot.currentCue?.label).toEqualTypeOf<string | undefined>()
  })
})
