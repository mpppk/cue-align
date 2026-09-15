import { Result } from '@praha/byethrow'
import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { readAuthoringInput } from '../authoring'
import type { AuthoringInput, ReadAuthoringInputError } from '../authoring'
import { InvalidAlignmentInputError, InvalidCueInputError } from '../errors'

export type SetupSelection = {
  authoring: AuthoringInput
  audioFile: File
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
  const [audioFile, setAudioFile] = useState<File>()
  const [alignmentFile, setAlignmentFile] = useState<File>()
  const [error, setError] = useState<ReadAuthoringInputError>()
  const [isLoading, setIsLoading] = useState(false)
  const canStart =
    cueFile !== undefined && audioFile !== undefined && !isLoading

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (cueFile === undefined || audioFile === undefined) {
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

    onStart({ authoring: result.value, audioFile })
  }

  return (
    <section className="panel setup-panel" aria-labelledby="setup-title">
      <div className="section-heading">
        <p className="eyebrow">Reference authoring tool</p>
        <h1 id="setup-title">Cue sequence を音声へ合わせる</h1>
        <p>選択したファイルはブラウザ内だけで扱います。</p>
      </div>

      <form className="setup-form" onSubmit={handleSubmit}>
        <FileField
          label="Cue JSON"
          hint="必須"
          accept="application/json,.json"
          onChange={setCueFile}
        />
        <FileField
          label="Audio file"
          hint="必須"
          accept="audio/*"
          onChange={setAudioFile}
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

        <button
          className="primary-button"
          type="submit"
          disabled={!canStart}
        >
          {isLoading ? '読み込み中…' : 'Editor を開く'}
        </button>
      </form>
    </section>
  )
}
