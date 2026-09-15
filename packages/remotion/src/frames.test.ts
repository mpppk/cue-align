import { describe, expect, it } from 'vite-plus/test'

import { asCueId, asTimelinePosition } from '@mpppk/cue-align-core'
import {
  InvalidFramesPerSecondError,
  InvalidRemotionFrameError,
  MissingMarkError,
  alignmentToFrameMarks,
  frameToTimelinePosition,
  getCueFrameMark,
  timelinePositionToFrame,
} from './index'

const alignment = {
  version: 1 as const,
  marks: [
    { cueId: asCueId('a'), at: asTimelinePosition(1.25) },
    { cueId: asCueId('c'), at: asTimelinePosition(2.51) },
  ],
}

describe('Remotion frame adapter', () => {
  it('converts timeline positions to the nearest frame', () => {
    expect(timelinePositionToFrame(asTimelinePosition(1.25), 30)).toBeSuccess(
      (frame) => expect(frame).toBe(38),
    )
    expect(timelinePositionToFrame(asTimelinePosition(1.24), 30)).toBeSuccess(
      (frame) => expect(frame).toBe(37),
    )
  })

  it('supports fractional frame rates without changing Core precision', () => {
    expect(
      timelinePositionToFrame(asTimelinePosition(10), 29.97),
    ).toBeSuccess((frame) => expect(frame).toBe(300))
  })

  it('rejects invalid fps values', () => {
    for (const fps of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        timelinePositionToFrame(asTimelinePosition(1), fps),
      ).toBeFailure((error) => {
        expect(error).toBeInstanceOf(InvalidFramesPerSecondError)
      })
    }
  })

  it('converts integer frames back to TimelinePosition seconds', () => {
    expect(frameToTimelinePosition(45, 30)).toBeSuccess((at) =>
      expect(at).toBe(1.5),
    )
  })

  it('rejects invalid Remotion frames', () => {
    for (const frame of [-1, 1.5, Number.NaN]) {
      expect(frameToTimelinePosition(frame, 30)).toBeFailure((error) => {
        expect(error).toBeInstanceOf(InvalidRemotionFrameError)
      })
    }
  })

  it('maps canonical Alignment marks while preserving order and timestamps', () => {
    expect(alignmentToFrameMarks(alignment, 30)).toBeSuccess((marks) => {
      expect(marks).toEqual([
        { cueId: 'a', at: 1.25, frame: 38 },
        { cueId: 'c', at: 2.51, frame: 75 },
      ])
    })
  })

  it('gets a single Cue frame without inferring an end frame', () => {
    expect(getCueFrameMark(alignment, asCueId('c'), 30)).toBeSuccess((mark) => {
      expect(mark).toEqual({ cueId: 'c', at: 2.51, frame: 75 })
      expect(mark).not.toHaveProperty('endFrame')
    })
  })

  it('returns a typed error for an unmarked Cue', () => {
    expect(getCueFrameMark(alignment, asCueId('b'), 30)).toBeFailure((error) => {
      expect(error).toBeInstanceOf(MissingMarkError)
    })
  })
})
