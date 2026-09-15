import type { ReferenceCue } from '../input'

type CueViewerProps = {
  previousCue: ReferenceCue | undefined
  currentCue: ReferenceCue | undefined
  nextCue: ReferenceCue | undefined
  isCurrentMarked: boolean
}

const cueLabel = (cue: ReferenceCue | undefined): string =>
  cue?.label ?? cue?.id ?? '—'

export function CueViewer({
  previousCue,
  currentCue,
  nextCue,
  isCurrentMarked,
}: CueViewerProps) {
  return (
    <section className="cue-viewer" aria-label="Cue position">
      <div className="cue-card secondary-cue">
        <span>Previous</span>
        <strong>{cueLabel(previousCue)}</strong>
      </div>
      <div className="cue-card current-cue">
        <span>Current</span>
        <strong>{cueLabel(currentCue)}</strong>
        <small>{isCurrentMarked ? 'Marked' : 'Not marked'}</small>
      </div>
      <div className="cue-card secondary-cue">
        <span>Next</span>
        <strong>{cueLabel(nextCue)}</strong>
      </div>
    </section>
  )
}
