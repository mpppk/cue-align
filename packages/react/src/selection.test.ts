import { Result } from '@praha/byethrow'
import { describe, expect, it } from 'vite-plus/test'

import {
  asCueId,
  asTimelinePosition,
  createAlignmentState,
} from '@mpppk/cue-align-core'
import type { Cue } from '@mpppk/cue-align-core'
import { getAlignmentSessionSnapshot } from './useAlignmentSession'

type TestCue = Cue & { label: string }

const ids = {
  a: asCueId('a'),
  b: asCueId('b'),
  c: asCueId('c'),
}

const cues: ReadonlyArray<TestCue> = [
  { id: ids.a, label: 'Alpha' },
  { id: ids.b, label: 'Beta' },
  { id: ids.c, label: 'Gamma' },
]

describe('selected Cue snapshot', () => {
  it('exposes the selected Cue and its existing Mark without reordering output', () => {
    const stateResult = createAlignmentState({
      cues,
      alignment: {
        version: 1,
        marks: [
          { cueId: ids.c, at: asTimelinePosition(30) },
          { cueId: ids.b, at: asTimelinePosition(20) },
        ],
      },
      initialCueId: ids.c,
    })
    if (Result.isFailure(stateResult)) {
      throw stateResult.error
    }

    const snapshot = getAlignmentSessionSnapshot(stateResult.value, cues)

    expect(snapshot.currentCue?.label).toBe('Gamma')
    expect(snapshot.previousCue?.label).toBe('Beta')
    expect(snapshot.nextCue).toBeUndefined()
    expect(snapshot.currentMark).toEqual({ cueId: 'c', at: 30 })
    expect(snapshot.alignment).toEqual({
      version: 1,
      marks: [
        { cueId: 'b', at: 20 },
        { cueId: 'c', at: 30 },
      ],
    })
  })
})
