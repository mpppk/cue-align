import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { Editor } from '#/features/alignment/components/Editor'
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

  return (
    <main className="app-shell">
      <Editor
        authoring={selection.authoring}
        audioFile={selection.audioFile}
        onBack={() => setSelection(undefined)}
      />
    </main>
  )
}
