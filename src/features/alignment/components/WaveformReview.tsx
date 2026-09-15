import type { KeyboardEvent, MouseEvent } from 'react'

import type { Alignment, CueId } from '@mpppk/cue-align-core'
import { useWaveform } from '../useWaveform'
import {
  getWaveformMarkPositions,
  timelinePositionFromWaveformOffset,
  waveformRatio,
} from '../waveform'

type WaveformReviewProps = {
  file: File
  alignment: Alignment
  currentCueId?: CueId
  currentTime: number
  onSeek: (at: number) => void
  onSelectCue: (cueId: CueId) => void
}

const formatSeconds = (seconds: number): string => `${seconds.toFixed(3)}s`

export function WaveformReview({
  file,
  alignment,
  currentCueId,
  currentTime,
  onSeek,
  onSelectCue,
}: WaveformReviewProps) {
  const waveform = useWaveform(file)

  if (waveform.status === 'loading') {
    return (
      <section className="waveform-review" aria-label="Waveform review">
        <div className="waveform-status" role="status" aria-live="polite">
          波形を解析しています…
        </div>
      </section>
    )
  }

  if (waveform.status === 'error') {
    return (
      <section className="waveform-review" aria-label="Waveform review">
        <div className="waveform-status waveform-error" role="alert">
          <strong>Waveform unavailable</strong>
          <span>{waveform.message}</span>
        </div>
      </section>
    )
  }

  const duration = waveform.duration
  const marks = getWaveformMarkPositions(alignment, duration)
  const currentRatio = waveformRatio(currentTime, duration)

  const seekFromPointer = (event: MouseEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    onSeek(
      timelinePositionFromWaveformOffset(
        event.clientX - bounds.left,
        bounds.width,
        duration,
      ),
    )
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 5 : 1
    let nextTime: number | undefined

    switch (event.key) {
      case 'ArrowLeft':
        nextTime = currentTime - step
        break
      case 'ArrowRight':
        nextTime = currentTime + step
        break
      case 'Home':
        nextTime = 0
        break
      case 'End':
        nextTime = duration
        break
      default:
        return
    }

    event.preventDefault()
    onSeek(Math.min(duration, Math.max(0, nextTime)))
  }

  return (
    <section className="waveform-review" aria-label="Waveform review">
      <div className="waveform-heading">
        <strong>Waveform review</strong>
        <span>
          {formatSeconds(currentTime)} / {formatSeconds(duration)}
        </span>
      </div>

      <div
        className="waveform-surface"
        role="slider"
        tabIndex={0}
        aria-label="Playback position"
        aria-valuemin={0}
        aria-valuemax={duration}
        aria-valuenow={Math.min(duration, Math.max(0, currentTime))}
        aria-valuetext={formatSeconds(currentTime)}
        onClick={seekFromPointer}
        onKeyDown={handleKeyDown}
      >
        <div className="waveform-bars" aria-hidden="true">
          {waveform.peaks.map((peak, index) => (
            <span
              // The decoded peak list is stable for one File instance.
              key={index}
              className="waveform-peak"
              style={{ height: `${Math.max(4, peak * 100)}%` }}
            />
          ))}
        </div>

        {marks.map((mark) => (
          <button
            key={mark.cueId}
            className={`waveform-mark${mark.cueId === currentCueId ? ' current-waveform-mark' : ''}`}
            type="button"
            style={{ left: `${mark.ratio * 100}%` }}
            aria-label={`Cue ${mark.cueId} at ${formatSeconds(mark.at)}`}
            title={`${mark.cueId} · ${formatSeconds(mark.at)}`}
            onClick={(event) => {
              event.stopPropagation()
              onSelectCue(mark.cueId)
              onSeek(mark.at)
            }}
          />
        ))}

        <span
          className="waveform-playhead"
          style={{ left: `${currentRatio * 100}%` }}
          aria-hidden="true"
        />
      </div>

      <p className="waveform-help">
        波形をクリックして seek。Mark をクリックすると対応する Cue を選択します。
      </p>
    </section>
  )
}
