import { Result } from '@praha/byethrow'
import { describe, expect, expectTypeOf, it } from 'vite-plus/test'

import {
  DuplicateCueIdError,
  InvalidCueIndexError,
  NonMonotonicTimeError,
} from './errors'
import { createAlignmentSession } from './session'
import type { AlignmentSession } from './session'
import { createAlignmentState } from './state'
import { markCurrent } from './transitions'
import { asCueId, asCueIndex, asTimelinePosition } from './types'
import type {
  CreateAlignmentSessionError,
  CreateAlignmentStateError,
  Cue,
  CueId,
  CueIndex,
  MarkCurrentError,
  MarkError,
  SeekCueError,
  SeekIndexError,
  TimelinePosition,
} from './index'
import type { AlignmentState } from './types'

type TestCue = Cue & {
  label: string
}

type IsAssignable<From, To> = [From] extends [To] ? true : false
type StringToCueId = IsAssignable<string, CueId>
type NumberToTimelinePosition = IsAssignable<number, TimelinePosition>
type NumberToCueIndex = IsAssignable<number, CueIndex>
type TimelinePositionToCueIndex = IsAssignable<TimelinePosition, CueIndex>
type CueIndexToTimelinePosition = IsAssignable<CueIndex, TimelinePosition>

const ids = {
  a: asCueId('a'),
  b: asCueId('b'),
  c: asCueId('c'),
}

const position = (value: number): TimelinePosition => asTimelinePosition(value)
const index = (value: number): CueIndex => asCueIndex(value)

const cues: ReadonlyArray<TestCue> = [
  { id: ids.a, label: 'Alpha' },
  { id: ids.b, label: 'Beta' },
  { id: ids.c, label: 'Gamma' },
]

const unwrapSession = (
  result: Result.Result<AlignmentSession<TestCue>, CreateAlignmentSessionError>,
): AlignmentSession<TestCue> => {
  if (Result.isFailure(result)) {
    throw result.error
  }

  return result.value
}

describe('alignment domain model', () => {
  it('brands domain primitives to prevent accidental interchange', () => {
    expectTypeOf<StringToCueId>().toEqualTypeOf<false>()
    expectTypeOf<NumberToTimelinePosition>().toEqualTypeOf<false>()
    expectTypeOf<NumberToCueIndex>().toEqualTypeOf<false>()
    expectTypeOf<TimelinePositionToCueIndex>().toEqualTypeOf<false>()
    expectTypeOf<CueIndexToTimelinePosition>().toEqualTypeOf<false>()
  })

  it('exposes precise Result error unions', () => {
    expectTypeOf(createAlignmentState({ cues })).toEqualTypeOf<
      Result.Result<AlignmentState, CreateAlignmentStateError>
    >()

    expectTypeOf(createAlignmentSession({ cues })).toEqualTypeOf<
      Result.Result<AlignmentSession<TestCue>, CreateAlignmentSessionError>
    >()

    const session = unwrapSession(createAlignmentSession({ cues }))

    expectTypeOf(session.markCurrent(position(1))).toEqualTypeOf<
      Result.Result<void, MarkCurrentError>
    >()
    expectTypeOf(session.mark(ids.a, position(1))).toEqualTypeOf<
      Result.Result<void, MarkError>
    >()
    expectTypeOf(session.seekCue(ids.a)).toEqualTypeOf<
      Result.Result<void, SeekCueError>
    >()
    expectTypeOf(session.seekIndex(index(0))).toEqualTypeOf<
      Result.Result<void, SeekIndexError>
    >()
  })

  it('rejects duplicate cue IDs', () => {
    const result = createAlignmentSession({
      cues: [
        { id: ids.a, label: 'Alpha' },
        { id: ids.a, label: 'Another Alpha' },
      ],
    })

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.error).toBeInstanceOf(DuplicateCueIdError)
    }
  })

  it('preserves the concrete cue type and advances after markCurrent', () => {
    const session = unwrapSession(createAlignmentSession({ cues }))

    expect(session.currentCue?.label).toBe('Alpha')
    expect(Result.isSuccess(session.markCurrent(position(1.25)))).toBe(true)
    expect(session.currentCue?.label).toBe('Beta')
    expect(session.getMark(ids.a)).toEqual({ cueId: 'a', at: 1.25 })
  })

  it('keeps pure transitions immutable', () => {
    const stateResult = createAlignmentState({ cues })
    if (Result.isFailure(stateResult)) {
      throw stateResult.error
    }

    const initialState = stateResult.value
    const nextStateResult = markCurrent(initialState, cues, position(1))
    if (Result.isFailure(nextStateResult)) {
      throw nextStateResult.error
    }

    expect(nextStateResult.value).not.toBe(initialState)
    expect(initialState.marksByCueId.size).toBe(0)
    expect(nextStateResult.value.marksByCueId.get(ids.a)).toBe(1)
  })

  it('rejects a mark that violates neighboring timestamps without mutating state', () => {
    const session = unwrapSession(createAlignmentSession({ cues }))

    expect(Result.isSuccess(session.mark(ids.a, position(10)))).toBe(true)
    expect(Result.isSuccess(session.mark(ids.c, position(20)))).toBe(true)

    const result = session.mark(ids.b, position(21))

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.error).toBeInstanceOf(NonMonotonicTimeError)
    }
    expect(session.getMark(ids.b)).toBeUndefined()
  })

  it('allows re-marking a cue when the new timestamp remains ordered', () => {
    const session = unwrapSession(createAlignmentSession({ cues }))

    expect(Result.isSuccess(session.mark(ids.a, position(10)))).toBe(true)
    expect(Result.isSuccess(session.mark(ids.b, position(20)))).toBe(true)
    expect(Result.isSuccess(session.mark(ids.c, position(30)))).toBe(true)
    expect(Result.isSuccess(session.mark(ids.b, position(25)))).toBe(true)

    expect(session.getMark(ids.b)).toEqual({ cueId: 'b', at: 25 })
  })

  it('undoes mark mutations and restores the previous cursor', () => {
    const session = unwrapSession(createAlignmentSession({ cues }))

    session.markCurrent(position(10))
    session.markCurrent(position(20))

    expect(session.currentCue?.id).toBe('c')
    expect(session.undo()).toBe(true)
    expect(session.currentCue?.id).toBe('b')
    expect(session.getMark(ids.b)).toBeUndefined()

    expect(session.undo()).toBe(true)
    expect(session.currentCue?.id).toBe('a')
    expect(session.getMark(ids.a)).toBeUndefined()
    expect(session.undo()).toBe(false)
  })

  it('exports marks in cue order regardless of imported mark order', () => {
    const session = unwrapSession(
      createAlignmentSession({
        cues,
        alignment: {
          version: 1,
          marks: [
            { cueId: ids.b, at: position(20) },
            { cueId: ids.a, at: position(10) },
          ],
        },
      }),
    )

    expect(session.getAlignment()).toEqual({
      version: 1,
      marks: [
        { cueId: 'a', at: 10 },
        { cueId: 'b', at: 20 },
      ],
    })
    expect(session.isComplete()).toBe(false)
  })

  it('rejects non-monotonic imported alignments', () => {
    const result = createAlignmentSession({
      cues,
      alignment: {
        version: 1,
        marks: [
          { cueId: ids.a, at: position(20) },
          { cueId: ids.b, at: position(10) },
        ],
      },
    })

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.error).toBeInstanceOf(NonMonotonicTimeError)
    }
  })

  it('returns an error when seeking outside the cue list', () => {
    const session = unwrapSession(createAlignmentSession({ cues }))
    const result = session.seekIndex(index(99))

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.error).toBeInstanceOf(InvalidCueIndexError)
    }
  })
})
