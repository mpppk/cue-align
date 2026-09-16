import { Result } from '@praha/byethrow'
import { useMemo, useRef, useState } from 'react'

import { asTimelinePosition, createAlignmentState } from '@mpppk/cue-align-core'
import type {
  AdjustMarkError,
  AlignmentState,
  CueId,
  SeekCueError,
} from '@mpppk/cue-align-core'
import { useAlignmentSession } from '@mpppk/cue-align-react'
import type { AuthoringInput } from '../authoring'
import { markForAuthoringMode } from '../authoringMode'
import type { AuthoringMode } from '../authoringMode'
import { downloadAlignment } from '../export'
import type { AlignmentExportError } from '../export'
import { useAlignmentShortcuts } from '../useAlignmentShortcuts'
import { CueList } from './CueList'
import { CueViewer } from './CueViewer'
import { MediaPlayer, getMediaKind } from './MediaPlayer'
import { Progress } from './Progress'
import { ShortcutGuide } from './ShortcutGuide'
import { WaveformReview } from './WaveformReview'

type EditorProps = {
  authoring: AuthoringInput
  mediaFile: File
  onBack: () => void
}

type ReadyEditorProps = EditorProps & {
  initialState: AlignmentState
}

type WaveformEditError = SeekCueError | AdjustMarkError

const formatPlaybackTime = (seconds: number): string => {
  const wholeMinutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds - wholeMinutes * 60
  return `${wholeMinutes.toString().padStart(2, '0')}:${remainingSeconds
    .toFixed(3)
    .padStart(6, '0')}`
}

function ReadyEditor({
  authoring,
  mediaFile,
  onBack,
  initialState,
}: ReadyEditorProps) {
  const mediaRef = useRef<HTMLMediaElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [authoringMode, setAuthoringMode] =
    useState<AuthoringMode>('sequential')
  const [exportError, setExportError] = useState<AlignmentExportError>()
  const [waveformError, setWaveformError] = useState<WaveformEditError>()
  const session = useAlignmentSession(authoring.cues, initialState)
  const shortcutError = useAlignmentShortcuts({
    mediaRef,
    actions: {
      mark: (at) =>
        markForAuthoringMode(
          session,
          authoringMode,
          session.currentCue?.id,
          at,
        ),
      undo: session.undo,
      goToPreviousCue: session.goToPreviousCue,
      goToNextCue: session.goToNextCue,
    },
  })
  const visibleError = shortcutError ?? waveformError ?? exportError
  const mediaKind = getMediaKind(mediaFile)
  const isComplete = session.totalCount > 0 && session.isComplete

  const handleExport = () => {
    const result = downloadAlignment(
      session.alignment,
      `${mediaFile.name}.alignment.json`,
    )
    if (Result.isFailure(result)) {
      setExportError(result.error)
      return
    }

    setExportError(undefined)
  }

  const handleWaveformSeek = (at: number) => {
    const media = mediaRef.current
    if (media === null) {
      return
    }

    const duration = Number.isFinite(media.duration) ? media.duration : at
    const nextTime = Math.min(duration, Math.max(0, at))
    media.currentTime = nextTime
    setCurrentTime(nextTime)
  }

  const handleCueSelect = (cueId: CueId) => {
    const result = session.seekCue(cueId)
    if (Result.isFailure(result)) {
      setWaveformError(result.error)
      return
    }

    setAuthoringMode('selection')
    setWaveformError(undefined)
  }

  const handleWaveformMarkAdjust = (cueId: CueId, at: number) => {
    const result = session.adjustMark(cueId, asTimelinePosition(at))
    if (Result.isFailure(result)) {
      setWaveformError(result.error)
      return
    }

    setWaveformError(undefined)
    handleWaveformSeek(at)
  }

  return (
    <section className="panel editor-panel" aria-labelledby="editor-title">
      <div className="editor-toolbar">
        <div>
          <p className="eyebrow">Editor</p>
          <h1 id="editor-title">
            {mediaKind === 'video' ? 'Video authoring' : 'Audio authoring'}
          </h1>
          <p className="media-name">{mediaFile.name}</p>
        </div>
        <div className="editor-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={handleExport}
          >
            Alignment を保存
          </button>
          <button className="secondary-button" type="button" onClick={onBack}>
            Setup に戻る
          </button>
        </div>
      </div>

      <div className="authoring-mode-toolbar">
        <div
          className="authoring-mode-switch"
          role="group"
          aria-label="Authoring mode"
        >
          <button
            className="secondary-button"
            type="button"
            aria-pressed={authoringMode === 'sequential'}
            onClick={() => setAuthoringMode('sequential')}
          >
            Sequential
          </button>
          <button
            className="secondary-button"
            type="button"
            aria-pressed={authoringMode === 'selection'}
            onClick={() => setAuthoringMode('selection')}
          >
            Selection
          </button>
        </div>
        <p>
          {authoringMode === 'sequential'
            ? 'Space で Mark すると次の Cue へ進みます。'
            : '選択中の Cue を Space で Mark / re-mark します。'}
        </p>
      </div>

      <div className="playback-time" aria-label="Current playback time">
        {formatPlaybackTime(currentTime)}
      </div>

      <MediaPlayer
        file={mediaFile}
        mediaRef={mediaRef}
        onTimeChange={setCurrentTime}
      />

      {mediaKind === 'audio' ? (
        <WaveformReview
          file={mediaFile}
          alignment={session.alignment}
          currentCueId={session.currentCue?.id}
          currentTime={currentTime}
          onSeek={handleWaveformSeek}
          onSelectCue={handleCueSelect}
          onAdjustMark={handleWaveformMarkAdjust}
        />
      ) : null}

      {visibleError === undefined ? null : (
        <div className="error-message" role="alert">
          <strong>{visibleError.name}</strong>
          <span>{visibleError.message}</span>
        </div>
      )}

      {isComplete ? (
        <div className="completion-message" role="status" aria-live="polite">
          <strong>Alignment complete</strong>
          <span>すべての Cue が Mark 済みです。結果を保存できます。</span>
        </div>
      ) : null}

      <CueViewer
        previousCue={session.previousCue}
        currentCue={session.currentCue}
        nextCue={session.nextCue}
        isCurrentMarked={session.currentMark !== undefined}
      />

      <CueList
        cues={authoring.cues}
        alignment={session.alignment}
        currentCueId={session.currentCue?.id}
        onSelectCue={handleCueSelect}
      />

      <Progress
        markedCount={session.markedCount}
        totalCount={session.totalCount}
      />

      <ShortcutGuide />
    </section>
  )
}

export function Editor({ authoring, mediaFile, onBack }: EditorProps) {
  const initialStateResult = useMemo(
    () =>
      createAlignmentState({
        cues: authoring.cues,
        alignment: authoring.alignment,
      }),
    [authoring.alignment, authoring.cues],
  )

  if (Result.isFailure(initialStateResult)) {
    return (
      <section className="panel editor-panel">
        <div className="error-message" role="alert">
          <strong>{initialStateResult.error.name}</strong>
          <span>{initialStateResult.error.message}</span>
        </div>
        <button className="secondary-button" type="button" onClick={onBack}>
          Setup に戻る
        </button>
      </section>
    )
  }

  return (
    <ReadyEditor
      authoring={authoring}
      mediaFile={mediaFile}
      onBack={onBack}
      initialState={initialStateResult.value}
    />
  )
}
