import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

import { Editor } from '#/features/alignment/components/Editor'
import { ProjectStartScreen } from '#/features/project/components/ProjectStartScreen'
import type { OpenedProject } from '#/features/project/components/ProjectStartScreen'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const [selection, setSelection] = useState<OpenedProject>()

  if (selection === undefined) {
    return (
      <main className="app-shell">
        <ProjectStartScreen onOpen={setSelection} />
      </main>
    )
  }

  return (
    <main className="app-shell">
      <Editor
        projectId={selection.projectId}
        projectName={selection.projectName}
        authoring={selection.authoring}
        mediaFile={selection.mediaFile}
        initialTrackId={selection.currentTrackId}
        {...(selection.currentCueId === undefined
          ? {}
          : { initialCueId: selection.currentCueId })}
        onBack={() => setSelection(undefined)}
      />
    </main>
  )
}
