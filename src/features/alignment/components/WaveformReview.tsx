import { useRef, useState } from 'react'
import type {
  KeyboardEvent,
  MouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'

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
  onAdjustMark: (cueId: CueId, at: number) => void
}

type DragPreview = {
  cueId: CueId
  at: number
}

const formatSeconds = (seconds: number): string => `${seconds.toFixed(3)}s`

export function WaveformReview({
  file,
  alignment,
  currentCueId,
  currentTime,
  onSeek,
  onSelectCue,
  onAdjustMark,
}: WaveformReviewProps) {
  const waveform = useWaveform(file)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const didDragRef = useRef(false)
  const [dragPreview, setDragPreview] = useState<DragPreview>()

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

  const positionFromClientX = (clientX: number): number => {
    const surface = surfaceRef.current
    if (surface === null) {
      return 0
    }

    const bounds = surface.getBoundingClientRect()
    return timelinePositionFromWaveformOffset(
      clientX - bounds.left,
      bounds.width,
      duration,
    )
  }

  const seekFromPointer = (event: MouseEvent<HTMLDivElement>) => {
    onSeek(positionFromClientX(event.clientX))
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

  const beginDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    cueId: CueId,
    at: number,
  ) => {
    event.stopPropagation()
    didDragRef.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    onSelectCue(cueId)
    setDragPreview({ cueId, at })
  }

  const updateDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    cueId: CueId,
    originalAt: number,
  ) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      return
    }

    const at = positionFromClientX(event.clientX)
    if (Math.abs(at - originalAt) >= 0.001) {
      didDragRef.current = true
    }
    setDragPreview({ cueId, at })
  }

  const finishDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    cueId: CueId,
  ) => {
    event.stopPropagation()
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }

    const preview = dragPreview
    if (didDragRef.current && preview?.cueId === cueId) {
      onAdjustMark(cueId, preview.at)
    }
    setDragPreview(undefined)
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
        ref={surfaceRef}
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

        {marks.map((mark) => {
          const previewAt =
            dragPreview?.cueId === mark.cueId ? dragPreview.at : mark.at
          const previewRatio = waveformRatio(previewAt, duration)

          return (
            <button
              key={mark.cueId}
              className={`waveform-mark${mark.cueId === currentCueId ? ' current-waveform-mark' : ''}${dragPreview?.cueId === mark.cueId ? ' dragging-waveform-mark' : ''}`}
              type="button"
              style={{ left: `${previewRatio * 100}%` }}
              aria-label={`Cue ${mark.cueId} at ${formatSeconds(previewAt)}. Drag to adjust.`}
              title={`${mark.cueId} · ${formatSeconds(previewAt)}`}
              onPointerDown={(event) => beginDrag(event, mark.cueId, mark.at)}
              onPointerMove={(event) => updateDrag(event, mark.cueId, mark.at)}
              onPointerUp={(event) => finishDrag(event, mark.cueId)}
              onPointerCancel={() => setDragPreview(undefined)}
              onClick={(event) => {
                event.stopPropagation()
                if (didDragRef.current) {
                  didDragRef.current = false
                  return
                }
                onSelectCue(mark.cueId)
                onSeek(mark.at)
              }}
            />
          )
        })}

        <span
          className="waveform-playhead"
          style={{ left: `${currentRatio * 100}%` }}
          aria-hidden="true"
        />
      </div>

      <p className="waveform-help">
        波形をクリックして seek。Mark はクリックで選択、ドラッグで timing
        を微調整できます。
      </p>
    </section>
  )
}
