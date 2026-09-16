import { Result } from '@praha/byethrow'
import { useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { readAuthoringInput } from '../authoring'
import type { AuthoringInput, ReadAuthoringInputError } from '../authoring'
import {
  discardAutosave,
  loadAutosave,
  validateRecoveryMedia,
} from '../autosave'
import type { RecoveredAuthoringSession } from '../autosave'
import { InvalidAlignmentInputError, InvalidCueInputError } from '../errors'

export type SetupSelection = {
  authoring: AuthoringInput
  mediaFile: File
  recovery?: RecoveredAuthoringSession
}

type SetupFormProps = {
  onStart: (selection: SetupSelection) => void
}

type FileFieldProps = {
  label: string
  hint: string
  accept: string
  onChange: (file: File | undefined) => void
}

function FileField({ label, hint, accept, onChange }: FileFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.files?.[0])
  }

  return (
    <label className="file-field">
      <span>{label}</span>
      <small>{hint}</small>
      <input type="file" accept={accept} onChange={handleChange} />
    </label>
  )
}

const formatInputError = (error: ReadAuthoringInputError): string => {
  if (
    error instanceof InvalidCueInputError ||
    error instanceof InvalidAlignmentInputError
  ) {
    return `${error.message}: ${error.path} — ${error.reason}`
  }

  return error.message
}

export function SetupForm({ onStart }: SetupFormProps) {
  const [cueFile, setCueFile] = useState<File>()
  const [mediaFile, setMediaFile] = useState<File>()
  const [alignmentFile, setAlignmentFile] = useState<File>()
  const [recoveryMediaFile, setRecoveryMediaFile] = useState<File>()
  const [recovery, setRecovery] = useState<RecoveredAuthoringSession>()
  const [error, setError] = useState<ReadAuthoringInputError>()
  const [autosaveError, setAutosaveError] = useState<Error>()
  const [isLoading, setIsLoading] = useState(false)
  const canStart =
    cueFile !== undefined && mediaFile !== undefined && !isLoading

  useEffect(() => {
    const result = loadAutosave(window.localStorage)
    if (Result.isFailure(result)) {
      setAutosaveError(result.error)
      return
    }

    setRecovery(result.value)
  }, [])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (cueFile === undefined || mediaFile === undefined) {
      return
    }

    setIsLoading(true)
    setError(undefined)

    const result = await readAuthoringInput(cueFile, alignmentFile)
    setIsLoading(false)

    if (Result.isFailure(result)) {
      setError(result.error)
      return
    }

    onStart({ authoring: result.value, mediaFile })
  }

  const handleRecover = () => {
    if (recovery === undefined || recoveryMediaFile === undefined) {
      return
    }

    const mediaValidation = validateRecoveryMedia(
      recoveryMediaFile,
      recovery.media,
    )
    if (Result.isFailure(mediaValidation)) {
      setAutosaveError(mediaValidation.error)
      return
    }

    setAutosaveError(undefined)
    onStart({
      authoring: recovery.authoring,
      mediaFile: recoveryMediaFile,
      recovery,
    })
  }

  const handleDiscard = () => {
    const result = discardAutosave(window.localStorage)
    if (Result.isFailure(result)) {
      setAutosaveError(result.error)
      return
    }

    setRecovery(undefined)
    setRecoveryMediaFile(undefined)
    setAutosaveError(undefined)
  }

  return (
    <section className="panel setup-panel" aria-labelledby="setup-title">
      <div className="section-heading">
        <p className="eyebrow">Reference authoring tool</p>
        <h1 id="setup-title">Cue sequence をメディアへ合わせる</h1>
        <p>選択したファイルはブラウザ内だけで扱います。</p>
      </div>

      {recovery === undefined ? null : (
        <div className="setup-form" aria-label="Autosave recovery">
          <div>
            <strong>前回の作業を復旧できます</strong>
            <p>
              {recovery.media.name} —{' '}
              {new Date(recovery.savedAt).toLocaleString()}
            </p>
            <small>
              メディア本体は保存していないため、同じファイルを再選択してください。
            </small>
          </div>
          <FileField
            label="Audio / Video file"
            hint={`復旧用・${recovery.media.name}`}
            accept="audio/*,video/*"
            onChange={setRecoveryMediaFile}
          />
          <div className="editor-actions">
            <button
              className="primary-button"
              type="button"
              disabled={recoveryMediaFile === undefined}
              onClick={handleRecover}
            >
              前回の作業を復旧
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={handleDiscard}
            >
              Autosave を破棄
            </button>
          </div>
        </div>
      )}

      {autosaveError === undefined ? null : (
        <div className="error-message" role="status">
          <strong>{autosaveError.name}</strong>
          <span>
            {autosaveError.message}。通常のSetupから新しく開始できます。
          </span>
        </div>
      )}

      <form className="setup-form" onSubmit={handleSubmit}>
        <FileField
          label="Cue JSON"
          hint="必須"
          accept="application/json,.json"
          onChange={setCueFile}
        />
        <FileField
          label="Audio / Video file"
          hint="必須"
          accept="audio/*,video/*"
          onChange={setMediaFile}
        />
        <FileField
          label="Alignment JSON"
          hint="任意・作業再開用"
          accept="application/json,.json"
          onChange={setAlignmentFile}
        />

        {error === undefined ? null : (
          <div className="error-message" role="alert">
            <strong>{error.name}</strong>
            <span>{formatInputError(error)}</span>
          </div>
        )}

        <button className="primary-button" type="submit" disabled={!canStart}>
          {isLoading ? '読み込み中…' : 'Editor を開く'}
        </button>
      </form>
    </section>
  )
}
