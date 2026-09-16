import { Result } from '@praha/byethrow'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  asTimelinePosition,
  createMultiTrackAlignmentState,
  seekCue,
} from '@mpppk/cue-align-core'
import type {
  AdjustMarkError,
  MultiTrackAlignmentState,
  CueId,
  SeekCueError,
  SelectTrackError,
  TrackId,
} from '@mpppk/cue-align-core'
import { useMultiTrackAlignmentSession } from '@mpppk/cue-align-react'
import type { AuthoringInput } from '../authoring'
import { markForAuthoringMode } from '../authoringMode'
import type { AuthoringMode } from '../authoringMode'
import { createAutosaveScheduler } from '../autosave'
import { downloadAlignment } from '../export'
import type { AlignmentExportError } from '../export'
import { PlaybackToggleError } from '../playback'
import { saveProjectSession } from '../../project/repository'
import type { SaveProjectSessionError } from '../../project/errors'
import type { ProjectId, SaveProjectSessionInput } from '../../project/project'
import { useAlignmentShortcuts } from '../useAlignmentShortcuts'
import { CueList } from './CueList'
import { CueViewer } from './CueViewer'
import { MediaPlayer, getMediaKind } from './MediaPlayer'
import { Progress } from './Progress'
import { ShortcutGuide } from './ShortcutGuide'
import { WaveformReview } from './WaveformReview'

type EditorProps = {
  projectId: ProjectId
  projectName?: string
  authoring: AuthoringInput
  mediaFile: File
  initialTrackId?: TrackId
  initialCueId?: CueId
  onBack: () => void
}

type ReadyEditorProps = EditorProps & {
  initialState: MultiTrackAlignmentState
}

type EditorInteractionError = SeekCueError | AdjustMarkError | SelectTrackError

const formatPlaybackTime = (seconds: number): string => {
  const wholeMinutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds - wholeMinutes * 60
  return `${wholeMinutes.toString().padStart(2, '0')}:${remainingSeconds
    .toFixed(3)
    .padStart(6, '0')}`
}

const createEditorInitialState = (
  authoring: AuthoringInput,
  initialTrackId?: TrackId,
  initialCueId?: CueId,
) => {
  const initialStateResult = createMultiTrackAlignmentState({
    tracks: authoring.tracks,
    alignment: authoring.alignment,
    ...(initialTrackId === undefined ? {} : { initialTrackId }),
  })
  if (Result.isFailure(initialStateResult) || initialCueId === undefined) {
    return initialStateResult
  }

  const resolvedTrackId =
    initialTrackId ?? initialStateResult.value.currentTrackId
  const track = authoring.tracks.find(
    (candidate) => candidate.id === resolvedTrackId,
  )
  const trackState =
    initialStateResult.value.statesByTrackId.get(resolvedTrackId)
  if (track === undefined || trackState === undefined) {
    return initialStateResult
  }

  const seekResult = seekCue(trackState, track.cues, initialCueId)
  if (Result.isFailure(seekResult)) {
    return Result.fail(seekResult.error)
  }

  const statesByTrackId = new Map(initialStateResult.value.statesByTrackId)
  statesByTrackId.set(track.id, seekResult.value)
  return Result.succeed({ ...initialStateResult.value, statesByTrackId })
}

function ReadyEditor({
  projectId,
  projectName,
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
  const [playbackError, setPlaybackError] = useState<PlaybackToggleError>()
  const [interactionError, setInteractionError] =
    useState<EditorInteractionError>()
  const [autosaveError, setAutosaveError] = useState<SaveProjectSessionError>()
  const session = useMultiTrackAlignmentSession(authoring.tracks, initialState)
  const alignmentFingerprint = JSON.stringify(session.multiTrackAlignment)
  const autosaveScheduler = useMemo(
    () =>
      createAutosaveScheduler((snapshot: SaveProjectSessionInput) => {
        void saveProjectSession(projectId, snapshot).then((result) => {
          if (Result.isFailure(result)) {
            setAutosaveError(result.error)
            return
          }

          setAutosaveError(undefined)
        })
      }),
    [projectId],
  )

  useEffect(() => {
    autosaveScheduler.schedule({
      alignment: session.multiTrackAlignment,
      currentTrackId: session.currentTrackId,
      ...(session.currentCue === undefined
        ? {}
        : { currentCueId: session.currentCue.id }),
    })
  }, [
    alignmentFingerprint,
    autosaveScheduler,
    session.currentCue,
    session.currentTrackId,
    session.multiTrackAlignment,
  ])

  useEffect(
    () => () => {
      autosaveScheduler.flush()
    },
    [autosaveScheduler],
  )

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
      togglePlayback: () => {
        const media = mediaRef.current
        if (media === null) {
          return
        }

        if (media.paused) {
          media.play().then(
            () => {
              setPlaybackError(undefined)
            },
            (cause: unknown) => {
              setPlaybackError(new PlaybackToggleError({ cause }))
            },
          )
          return
        }

        media.pause()
        setPlaybackError(undefined)
      },
      undo: session.undo,
      goToPreviousCue: session.goToPreviousCue,
      goToNextCue: session.goToNextCue,
    },
  })
  const visibleError =
    shortcutError ??
    playbackError ??
    interactionError ??
    exportError ??
    autosaveError
  const mediaKind = getMediaKind(mediaFile)
  const isComplete = session.totalCount > 0 && session.isComplete

  const handleExport = () => {
    const alignment =
      session.trackCount === 1 ? session.alignment : session.multiTrackAlignment
    const result = downloadAlignment(
      alignment,
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
      setInteractionError(result.error)
      return
    }

    setAuthoringMode('selection')
    setInteractionError(undefined)
  }

  const handleTrackSelect = (trackId: TrackId) => {
    const result = session.selectTrack(trackId)
    if (Result.isFailure(result)) {
      setInteractionError(result.error)
      return
    }

    setInteractionError(undefined)
  }

  const handleWaveformMarkAdjust = (cueId: CueId, at: number) => {
    const result = session.adjustMark(cueId, asTimelinePosition(at))
    if (Result.isFailure(result)) {
      setInteractionError(result.error)
      return
    }

    setInteractionError(undefined)
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
          {projectName === undefined ? null : (
            <p className="media-name">Project: {projectName}</p>
          )}
          <p className="media-name">{mediaFile.name}</p>
          <p className="media-name">
            編集内容は Project へ自動保存されます（端末・origin ローカル）。
          </p>
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

      {session.trackCount > 1 ? (
        <div className="authoring-mode-toolbar">
          <div
            className="authoring-mode-switch"
            role="group"
            aria-label="Cue track"
          >
            {authoring.tracks.map((track) => (
              <button
                className="secondary-button"
                type="button"
                key={track.id}
                aria-pressed={session.currentTrackId === track.id}
                onClick={() => handleTrackSelect(track.id)}
              >
                {track.label ?? track.id}
              </button>
            ))}
          </div>
          <p>Track ごとに Cue、Mark、Undo 履歴を独立して編集します。</p>
        </div>
      ) : null}

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
            ? 'Enter で Mark すると次の Cue へ進みます。'
            : '選択中の Cue を Enter で Mark / re-mark します。'}
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
          {visibleError === autosaveError ? (
            <span>
              Project への自動保存に失敗しました。編集と Alignment JSON export
              は継続できます。
            </span>
          ) : null}
        </div>
      )}

      {isComplete ? (
        <div className="completion-message" role="status" aria-live="polite">
          <strong>Track alignment complete</strong>
          <span>選択中の Track のすべての Cue が Mark 済みです。</span>
        </div>
      ) : null}

      <CueViewer
        previousCue={session.previousCue}
        currentCue={session.currentCue}
        nextCue={session.nextCue}
        isCurrentMarked={session.currentMark !== undefined}
      />

      <CueList
        cues={session.currentTrack.cues}
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

export function Editor({
  projectId,
  projectName,
  authoring,
  mediaFile,
  initialTrackId,
  initialCueId,
  onBack,
}: EditorProps) {
  const initialStateResult = useMemo(
    () => createEditorInitialState(authoring, initialTrackId, initialCueId),
    [authoring, initialTrackId, initialCueId],
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
      projectId={projectId}
      projectName={projectName}
      authoring={authoring}
      mediaFile={mediaFile}
      onBack={onBack}
      initialState={initialStateResult.value}
    />
  )
}
