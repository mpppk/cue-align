import type { JsonValue, ReferenceCue } from '../input'

type CueViewerProps = {
  previousCue: ReferenceCue | undefined
  currentCue: ReferenceCue | undefined
  nextCue: ReferenceCue | undefined
  isCurrentMarked: boolean
}

const cueLabel = (cue: ReferenceCue | undefined): string =>
  cue?.label ?? cue?.id ?? '—'

const formatMetadataValue = (value: JsonValue): string =>
  typeof value === 'string' ? value : JSON.stringify(value)

export const getCueMetadataEntries = (
  cue: ReferenceCue | undefined,
): ReadonlyArray<readonly [string, string]> => {
  if (cue === undefined) {
    return []
  }

  return Object.entries(cue)
    .filter(
      ([key, value]) => key !== 'id' && key !== 'label' && value !== undefined,
    )
    .map(
      ([key, value]) => [key, formatMetadataValue(value as JsonValue)] as const,
    )
}

export function CueViewer({
  previousCue,
  currentCue,
  nextCue,
  isCurrentMarked,
}: CueViewerProps) {
  const metadata = getCueMetadataEntries(currentCue)

  if (
    previousCue === undefined &&
    currentCue === undefined &&
    nextCue === undefined
  ) {
    return (
      <div className="empty-state" role="status">
        Cue sequence が空です。
      </div>
    )
  }

  return (
    <section className="cue-viewer" aria-label="Cue position">
      <div className="cue-card secondary-cue">
        <span>Previous</span>
        <strong>{cueLabel(previousCue)}</strong>
      </div>
      <div className="cue-card current-cue">
        <span>Current</span>
        <strong>{cueLabel(currentCue)}</strong>
        {currentCue?.label === undefined ? null : (
          <small>ID: {currentCue.id}</small>
        )}
        <small className={isCurrentMarked ? 'marked-status' : undefined}>
          {isCurrentMarked ? 'Marked' : 'Not marked'}
        </small>
        {metadata.length === 0 ? null : (
          <dl className="cue-metadata">
            {metadata.map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="cue-card secondary-cue">
        <span>Next</span>
        <strong>{cueLabel(nextCue)}</strong>
      </div>
    </section>
  )
}
