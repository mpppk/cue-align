import { Result } from '@praha/byethrow'
import { describe, expect, it } from 'vite-plus/test'

import { CueNotMarkedError, InvalidRangeError } from './errors'
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

describe('explicit Cue ranges', () => {
  it('keeps legacy Alignment serialization unchanged when ranges are unused', () => {
    const sessionResult = createAlignmentSession({
      cues,
      alignment: {
        version: 1,
        marks: [{ cueId: ids.a, at: position(1) }],
      },
    })
    if (Result.isFailure(sessionResult)) {
      throw sessionResult.error
    }

    expect(sessionResult.value.getAlignment()).toEqual({
      version: 1,
      marks: [{ cueId: 'a', at: 1 }],
    })
  })

  it('round-trips explicit ends in canonical Cue order', () => {
    const sessionResult = createAlignmentSession({
      cues,
      alignment: {
        version: 1,
        marks: [
          { cueId: ids.a, at: position(1) },
          { cueId: ids.b, at: position(4) },
          { cueId: ids.c, at: position(8) },
        ],
        ranges: [
          { cueId: ids.c, end: position(9) },
          { cueId: ids.a, end: position(3) },
        ],
      },
    })
    if (Result.isFailure(sessionResult)) {
      throw sessionResult.error
    }

    const session = sessionResult.value
    expect(session.getRange(ids.a)).toEqual({ cueId: 'a', end: 3 })
    expect(session.getAlignment()).toEqual({
      version: 1,
      marks: [
        { cueId: 'a', at: 1 },
        { cueId: 'b', at: 4 },
        { cueId: 'c', at: 8 },
      ],
      ranges: [
        { cueId: 'a', end: 3 },
        { cueId: 'c', end: 9 },
      ],
    })
  })

  it('sets, replaces, clears, and undoes explicit ends', () => {
    const sessionResult = createAlignmentSession({ cues })
    if (Result.isFailure(sessionResult)) {
      throw sessionResult.error
    }

    const session = sessionResult.value
    expect(session.mark(ids.a, position(1))).toBeSuccess()
    expect(session.setRangeEnd(ids.a, position(3))).toBeSuccess()
    expect(session.setRangeEnd(ids.a, position(4))).toBeSuccess()
    expect(session.getRange(ids.a)).toEqual({ cueId: 'a', end: 4 })

    expect(session.clearRangeEnd(ids.a)).toBeSuccess()
    expect(session.getRange(ids.a)).toBeUndefined()
    expect(session.undo()).toBe(true)
    expect(session.getRange(ids.a)).toEqual({ cueId: 'a', end: 4 })
    expect(session.undo()).toBe(true)
    expect(session.getRange(ids.a)).toEqual({ cueId: 'a', end: 3 })
  })

  it('requires a start Mark before an explicit end can be set', () => {
    const sessionResult = createAlignmentSession({ cues })
    if (Result.isFailure(sessionResult)) {
      throw sessionResult.error
    }

    expect(sessionResult.value.setRangeEnd(ids.a, position(2))).toBeFailure(
      (error) => expect(error).toBeInstanceOf(CueNotMarkedError),
    )
  })

  it('rejects ends before starts and start edits after existing ends', () => {
    const sessionResult = createAlignmentSession({ cues })
    if (Result.isFailure(sessionResult)) {
      throw sessionResult.error
    }

    const session = sessionResult.value
    expect(session.mark(ids.a, position(2))).toBeSuccess()
    expect(session.setRangeEnd(ids.a, position(1))).toBeFailure((error) =>
      expect(error).toBeInstanceOf(InvalidRangeError),
    )

    expect(session.setRangeEnd(ids.a, position(3))).toBeSuccess()
    expect(session.adjustMark(ids.a, position(4))).toBeFailure((error) =>
      expect(error).toBeInstanceOf(InvalidRangeError),
    )
    expect(session.getMark(ids.a)).toEqual({ cueId: 'a', at: 2 })
  })

  it('rejects imported ranges that do not have start Marks', () => {
    const result = createAlignmentSession({
      cues,
      alignment: {
        version: 1,
        marks: [],
        ranges: [{ cueId: ids.a, end: position(3) }],
      },
    })

    expect(result).toBeFailure((error) =>
      expect(error).toBeInstanceOf(CueNotMarkedError),
    )
  })
})
