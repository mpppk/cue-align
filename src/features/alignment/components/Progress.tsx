type ProgressProps = {
  markedCount: number
  totalCount: number
}

export function Progress({ markedCount, totalCount }: ProgressProps) {
  return (
    <div className="progress-block">
      <div className="progress-label">
        <span>Progress</span>
        <strong>
          {markedCount} / {totalCount}
        </strong>
      </div>
      <progress max={totalCount || 1} value={markedCount} />
    </div>
  )
}
