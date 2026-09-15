import { Result } from '@praha/byethrow'
import { useState } from 'react'
import type { FormEvent } from 'react'

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
        <p>
          Cue JSON とローカル音声を選択してください。ファイルはブラウザ内だけで扱い、
          サーバーには送信しません。
        </p>
      </div>

      <form className="setup-form" onSubmit={handleSubmit}>
        <label className="file-field">
          <span>Cue JSON</span>
          <small>必須</small>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => setCueFile(event.currentTarget.files?.[0])}
          />
        </label>

        <label className="file-field">
          <span>Audio file</span>
          <small>必須</small>
          <input
            type="file"
            accept="audio/*"
            onChange={(event) => setAudioFile(event.currentTarget.files?.[0])}
          />
        </label>

        <label className="file-field">
          <span>Alignment JSON</span>
          <small>任意・作業再開用</small>
          <input
            type="file"
            accept="application/json,.json"
            onChange={(event) => {
              setAlignmentFile(event.currentTarget.files?.[0])
            }}
          />
        </label>

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
