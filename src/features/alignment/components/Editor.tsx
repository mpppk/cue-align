import { Result } from '@praha/byethrow'
import { useMemo, useRef, useState } from 'react'

import { createAlignmentState } from '#/core'
import type { AlignmentState } from '#/core'
import type { AuthoringInput } from '../authoring'
import { downloadAlignment } from '../export'
import type { AlignmentExportError } from '../export'
import { useAlignmentSession } from '../useAlignmentSession'
import { useAlignmentShortcuts } from '../useAlignmentShortcuts'
import { CueViewer } from './CueViewer'
import { MediaPlayer } from './MediaPlayer'
import { Progress } from './Progress'

type EditorProps = {
  authoring: AuthoringInput
  audioFile: File
  onBack: () => void
}

type ReadyEditorProps = EditorProps & {
  initialState: AlignmentState
}

const formatPlaybackTime = (seconds: number): string => {
  const wholeMinutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds - wholeMinutes * 60
  return `${wholeMinutes.toString().padStart(2, '0')}:${remainingSeconds
    .toFixed(3)
    .padStart(6, '0')}`
}

function ReadyEditor({
  authoring,
  audioFile,
  onBack,
  initialState,
}: ReadyEditorProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [currentTime, setCurrentTime] = useState(0)
  const [exportError, setExportError] = useState<AlignmentExportError>()
  const session = useAlignmentSession(authoring.cues, initialState)
  const shortcutError = useAlignmentShortcuts({
    mediaRef: audioRef,
    actions: session,
  })
  const visibleError = shortcutError ?? exportError

  const handleExport = () => {
    const result = downloadAlignment(
      session.alignment,
      `${audioFile.name}.alignment.json`,
    )
    if (Result.isFailure(result)) {
      setExportError(result.error)
      return
    }

    setExportError(undefined)
  }

  return (
    <section className="panel editor-panel" aria-labelledby="editor-title">
      <div className="editor-toolbar">
        <div>
          <p className="eyebrow">Editor</p>
          <h1 id="editor-title">Audio authoring</h1>
        </div>
        <div className="editor-actions">
          <button className="secondary-button" type="button" onClick={handleExport}>
            Alignment を保存
          </button>
          <button className="secondary-button" type="button" onClick={onBack}>
            Setup に戻る
          </button>
        </div>
      </div>

      <div className="playback-time" aria-label="Current playback time">
        {formatPlaybackTime(currentTime)}
      </div>

      <MediaPlayer
        file={audioFile}
        mediaRef={audioRef}
        onTimeChange={setCurrentTime}
      />

      {visibleError === undefined ? null : (
        <div className="error-message" role="alert">
          <strong>{visibleError.name}</strong>
          <span>{visibleError.message}</span>
        </div>
      )}

      <CueViewer
        previousCue={session.previousCue}
        currentCue={session.currentCue}
        nextCue={session.nextCue}
        isCurrentMarked={session.currentMark !== undefined}
      />

      <Progress
        markedCount={session.markedCount}
        totalCount={session.totalCount}
      />

      <p className="editor-note">
        Space: Mark / Backspace: Undo / ←: Previous Cue / →: Next Cue
      </p>
    </section>
  )
}

export function Editor({ authoring, audioFile, onBack }: EditorProps) {
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
      audioFile={audioFile}
      onBack={onBack}
      initialState={initialStateResult.value}
    />
  )
}
