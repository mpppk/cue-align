import type { Alignment, CueId, TimelinePosition } from '@mpppk/cue-align-core'

export type WaveformMarkPosition = {
  cueId: CueId
  at: TimelinePosition
  ratio: number
}

const clampUnit = (value: number): number => Math.min(1, Math.max(0, value))

export const waveformRatio = (at: number, duration: number): number => {
  if (!Number.isFinite(at) || !Number.isFinite(duration) || duration <= 0) {
    return 0
  }

  return clampUnit(at / duration)
}

export const timelinePositionFromWaveformOffset = (
  offset: number,
  width: number,
  duration: number,
): number => {
  if (
    !Number.isFinite(offset) ||
    !Number.isFinite(width) ||
    !Number.isFinite(duration) ||
    width <= 0 ||
    duration <= 0
  ) {
    return 0
  }

  return clampUnit(offset / width) * duration
}

export const getWaveformMarkPositions = (
  alignment: Alignment,
  duration: number,
): ReadonlyArray<WaveformMarkPosition> =>
  alignment.marks.map((mark) => ({
    cueId: mark.cueId,
    at: mark.at,
    ratio: waveformRatio(mark.at, duration),
  }))

/**
 * Downsamples decoded audio channels into peak amplitudes suitable for a
 * lightweight waveform preview. The returned values are normalized to [0, 1].
 */
export const createWaveformPeaks = (
  channels: ReadonlyArray<Float32Array>,
  peakCount: number,
): ReadonlyArray<number> => {
  if (!Number.isInteger(peakCount) || peakCount <= 0) {
    return []
  }

  const sampleCount = channels.reduce(
    (maximum, channel) => Math.max(maximum, channel.length),
    0,
  )
  if (sampleCount === 0) {
    return Array.from({ length: peakCount }, () => 0)
  }

  return Array.from({ length: peakCount }, (_, peakIndex) => {
    const start = Math.floor((peakIndex * sampleCount) / peakCount)
    const end = Math.max(
      start + 1,
      Math.floor(((peakIndex + 1) * sampleCount) / peakCount),
    )
    let peak = 0

    for (const channel of channels) {
      const channelEnd = Math.min(end, channel.length)
      for (let sampleIndex = start; sampleIndex < channelEnd; sampleIndex += 1) {
        peak = Math.max(peak, Math.abs(channel[sampleIndex] ?? 0))
      }
    }

    return clampUnit(peak)
  })
}
