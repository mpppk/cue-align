import { describe, expect, it } from 'vite-plus/test'

import { asCueId, asTimelinePosition } from '@mpppk/cue-align-core'
import {
  createWaveformPeaks,
  getWaveformMarkPositions,
  timelinePositionFromWaveformOffset,
  waveformRatio,
} from './waveform'

describe('waveform helpers', () => {
  it('downsamples decoded channels into absolute peak amplitudes', () => {
    expect(
      createWaveformPeaks(
        [
          new Float32Array([0, 0.5, -1, 0.25]),
          new Float32Array([0.2, -0.25, 0.75, -0.5]),
        ],
        4,
      ),
    ).toEqual([0.2, 0.5, 1, 0.5])
  })

  it('returns a stable silent waveform for empty decoded audio', () => {
    expect(createWaveformPeaks([], 3)).toEqual([0, 0, 0])
  })

  it('maps pointer offsets to timeline positions and clamps the edges', () => {
    expect(timelinePositionFromWaveformOffset(50, 200, 20)).toBe(5)
    expect(timelinePositionFromWaveformOffset(-10, 200, 20)).toBe(0)
    expect(timelinePositionFromWaveformOffset(250, 200, 20)).toBe(20)
  })

  it('maps playback positions to a clamped waveform ratio', () => {
    expect(waveformRatio(5, 20)).toBe(0.25)
    expect(waveformRatio(-1, 20)).toBe(0)
    expect(waveformRatio(30, 20)).toBe(1)
  })

  it('derives Mark overlays directly from the canonical Alignment', () => {
    const alignment = {
      version: 1 as const,
      marks: [
        { cueId: asCueId('a'), at: asTimelinePosition(2) },
        { cueId: asCueId('b'), at: asTimelinePosition(8) },
      ],
    }

    expect(getWaveformMarkPositions(alignment, 10)).toEqual([
      { cueId: 'a', at: 2, ratio: 0.2 },
      { cueId: 'b', at: 8, ratio: 0.8 },
    ])
  })
})
