import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { MediaPlayer } from '#/features/alignment/components/MediaPlayer'
import { SetupForm } from '#/features/alignment/components/SetupForm'
import type { SetupSelection } from '#/features/alignment/components/SetupForm'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [selection, setSelection] = useState<SetupSelection>()

  if (selection === undefined) {
    return (
      <main className="app-shell">
        <SetupForm onStart={setSelection} />
      </main>
    )
  }

  const { authoring, audioFile } = selection
  const importedMarks = authoring.alignment?.marks.length ?? 0

  return (
    <main className="app-shell">
      <section className="panel editor-panel" aria-labelledby="editor-title">
        <div className="editor-toolbar">
          <div>
            <p className="eyebrow">Editor</p>
            <h1 id="editor-title">Audio authoring</h1>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={() => setSelection(undefined)}
          >
            Setup に戻る
          </button>
        </div>

        <dl className="summary-grid">
          <div>
            <dt>Cues</dt>
            <dd>{authoring.cues.length}</dd>
          </div>
          <div>
            <dt>Imported marks</dt>
            <dd>{importedMarks}</dd>
          </div>
          <div>
            <dt>Audio</dt>
            <dd title={audioFile.name}>{audioFile.name}</dd>
          </div>
        </dl>

        <MediaPlayer file={audioFile} />

        <p className="editor-note">
          Alignment Session の表示と操作は Phase 3 の次の PR で追加します。
        </p>
      </section>
    </main>
  )
}
