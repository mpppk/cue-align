import { Result } from '@praha/byethrow'
import { describe, expect, it } from 'vite-plus/test'

import {
  DuplicateCueIdError,
  InvalidCueIndexError,
  NonMonotonicTimeError,
} from './errors'
import { createAlignmentSession } from './session'
import type { AlignmentSession } from './session'
import { createAlignmentState } from './state'
import { markCurrent } from './transitions'
import type { AlignmentError, Cue } from './index'

type TestCue = Cue & {
  label: string
}

const cues: ReadonlyArray<TestCue> = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
]

const unwrapSession = (
  result: Result.Result<AlignmentSession<TestCue>, AlignmentError>,
): AlignmentSession<TestCue> => {
  if (Result.isFailure(result)) {
    throw result.error
  }

  return result.value
}

describe('alignment domain model', () => {
  it('rejects duplicate cue IDs', () => {
    const result = createAlignmentSession({
      cues: [
        { id: 'a', label: 'Alpha' },
        { id: 'a', label: 'Another Alpha' },
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
    expect(Result.isSuccess(session.markCurrent(1.25))).toBe(true)
    expect(session.currentCue?.label).toBe('Beta')
    expect(session.getMark('a')).toEqual({ cueId: 'a', at: 1.25 })
  })

  it('keeps pure transitions immutable', () => {
    const stateResult = createAlignmentState({ cues })
    if (Result.isFailure(stateResult)) {
      throw stateResult.error
    }

    const initialState = stateResult.value
    const nextStateResult = markCurrent(initialState, cues, 1)
    if (Result.isFailure(nextStateResult)) {
      throw nextStateResult.error
    }

    expect(nextStateResult.value).not.toBe(initialState)
    expect(initialState.marksByCueId.size).toBe(0)
    expect(nextStateResult.value.marksByCueId.get('a')).toBe(1)
  })

  it('rejects a mark that violates neighboring timestamps without mutating state', () => {
    const session = unwrapSession(createAlignmentSession({ cues }))

    expect(Result.isSuccess(session.mark('a', 10))).toBe(true)
    expect(Result.isSuccess(session.mark('c', 20))).toBe(true)

    const result = session.mark('b', 21)

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.error).toBeInstanceOf(NonMonotonicTimeError)
    }
    expect(session.getMark('b')).toBeUndefined()
  })

  it('allows re-marking a cue when the new timestamp remains ordered', () => {
    const session = unwrapSession(createAlignmentSession({ cues }))

    expect(Result.isSuccess(session.mark('a', 10))).toBe(true)
    expect(Result.isSuccess(session.mark('b', 20))).toBe(true)
    expect(Result.isSuccess(session.mark('c', 30))).toBe(true)
    expect(Result.isSuccess(session.mark('b', 25))).toBe(true)

    expect(session.getMark('b')).toEqual({ cueId: 'b', at: 25 })
  })

  it('undoes mark mutations and restores the previous cursor', () => {
    const session = unwrapSession(createAlignmentSession({ cues }))

    session.markCurrent(10)
    session.markCurrent(20)

    expect(session.currentCue?.id).toBe('c')
    expect(session.undo()).toBe(true)
    expect(session.currentCue?.id).toBe('b')
    expect(session.getMark('b')).toBeUndefined()

    expect(session.undo()).toBe(true)
    expect(session.currentCue?.id).toBe('a')
    expect(session.getMark('a')).toBeUndefined()
    expect(session.undo()).toBe(false)
  })

  it('exports marks in cue order regardless of imported mark order', () => {
    const session = unwrapSession(
      createAlignmentSession({
        cues,
        alignment: {
          version: 1,
          marks: [
            { cueId: 'b', at: 20 },
            { cueId: 'a', at: 10 },
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
          { cueId: 'a', at: 20 },
          { cueId: 'b', at: 10 },
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
    const result = session.seekIndex(99)

    expect(Result.isFailure(result)).toBe(true)
    if (Result.isFailure(result)) {
      expect(result.error).toBeInstanceOf(InvalidCueIndexError)
    }
  })
})
