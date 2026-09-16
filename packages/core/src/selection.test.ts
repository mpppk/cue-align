import { Result } from '@praha/byethrow'
import { describe, expect, it } from 'vite-plus/test'

import { createAlignmentSession } from './session'
import { asCueId, asTimelinePosition } from './types'
import type { Cue } from './types'

const ids = {
  a: asCueId('a'),
  b: asCueId('b'),
  c: asCueId('c'),
}

const cues: ReadonlyArray<Cue> = [{ id: ids.a }, { id: ids.b }, { id: ids.c }]

const position = (value: number) => asTimelinePosition(value)

describe('arbitrary Cue selection', () => {
  it('marks and re-marks a selected Cue without advancing the cursor', () => {
    const sessionResult = createAlignmentSession({ cues })
    if (Result.isFailure(sessionResult)) {
      throw sessionResult.error
    }

    const session = sessionResult.value

    expect(session.seekCue(ids.c)).toBeSuccess()
    expect(session.mark(ids.c, position(30))).toBeSuccess()
    expect(session.currentCue?.id).toBe(ids.c)

    expect(session.seekCue(ids.b)).toBeSuccess()
    expect(session.mark(ids.b, position(20))).toBeSuccess()
    expect(session.mark(ids.b, position(22))).toBeSuccess()
    expect(session.currentCue?.id).toBe(ids.b)
    expect(session.getMark(ids.b)).toEqual({ cueId: 'b', at: 22 })

    expect(session.undo()).toBe(true)
    expect(session.currentCue?.id).toBe(ids.b)
    expect(session.getMark(ids.b)).toEqual({ cueId: 'b', at: 20 })
    expect(session.getAlignment()).toEqual({
      version: 1,
      marks: [
        { cueId: 'b', at: 20 },
        { cueId: 'c', at: 30 },
      ],
    })
  })

  it('keeps previous and next navigation relative to the selected Cue', () => {
    const sessionResult = createAlignmentSession({ cues })
    if (Result.isFailure(sessionResult)) {
      throw sessionResult.error
    }

    const session = sessionResult.value
    expect(session.seekCue(ids.b)).toBeSuccess()

    session.goToPreviousCue()
    expect(session.currentCue?.id).toBe(ids.a)

    session.goToNextCue()
    expect(session.currentCue?.id).toBe(ids.b)
  })
})
