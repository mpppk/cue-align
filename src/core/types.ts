export type CueId = string

export type Cue = {
  id: CueId
}

export type Mark = {
  cueId: CueId
  at: number
}

export type Alignment = {
  version: 1
  marks: Array<Mark>
}

export type MarkHistoryEntry = {
  type: 'mark'
  cueId: CueId
  previousAt: number | undefined
  previousCursorIndex: number
}

export type AlignmentState = {
  marksByCueId: ReadonlyMap<CueId, number>
  currentIndex: number
  history: ReadonlyArray<MarkHistoryEntry>
}
