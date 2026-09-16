import type { Alignment, CueId } from '@mpppk/cue-align-core'
import type { ReferenceCue } from '../input'

type CueListProps = {
  cues: ReadonlyArray<ReferenceCue>
  alignment: Alignment
  currentCueId?: CueId
  onSelectCue: (cueId: CueId) => void
}

export function CueList({
  cues,
  alignment,
  currentCueId,
  onSelectCue,
}: CueListProps) {
  const markedCueIds = new Set(alignment.marks.map((mark) => mark.cueId))

  return (
    <section className="cue-list-section" aria-labelledby="cue-list-title">
      <div className="cue-list-heading">
        <div>
          <p className="eyebrow">Cue selection</p>
          <h2 id="cue-list-title">任意の Cue を選択</h2>
        </div>
        <span>{cues.length} cues</span>
      </div>

      <div className="cue-list">
        {cues.map((cue, index) => {
          const isCurrent = cue.id === currentCueId
          const isMarked = markedCueIds.has(cue.id)

          return (
            <button
              className={`cue-list-item${isCurrent ? ' current-cue-item' : ''}`}
              type="button"
              aria-pressed={isCurrent}
              key={cue.id}
              onClick={() => onSelectCue(cue.id)}
            >
              <span>{index + 1}</span>
              <strong>{cue.label ?? cue.id}</strong>
              <small>{isMarked ? 'Marked' : 'Unmarked'}</small>
            </button>
          )
        })}
      </div>
    </section>
  )
}
