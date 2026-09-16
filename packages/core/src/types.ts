declare const cueIdBrand: unique symbol
declare const timelinePositionBrand: unique symbol
declare const cueIndexBrand: unique symbol

export type CueId = string & { readonly [cueIdBrand]: 'CueId' }
export type TimelinePosition = number & {
  readonly [timelinePositionBrand]: 'TimelinePosition'
}
export type CueIndex = number & { readonly [cueIndexBrand]: 'CueIndex' }

export const asCueId = (value: string): CueId => value as CueId
export const asTimelinePosition = (value: number): TimelinePosition =>
  value as TimelinePosition
export const asCueIndex = (value: number): CueIndex => value as CueIndex

export type Cue = {
  id: CueId
}

export type Mark = {
  cueId: CueId
  at: TimelinePosition
}

export type CueRange = {
  cueId: CueId
  end: TimelinePosition
}

export type Alignment = {
  version: 1
  marks: Array<Mark>
  ranges?: Array<CueRange>
}

export type MarkHistoryEntry = {
  type: 'mark'
  cueId: CueId
  previousAt: TimelinePosition | undefined
  previousCursorIndex: CueIndex
}

export type RangeHistoryEntry = {
  type: 'range'
  cueId: CueId
  previousEnd: TimelinePosition | undefined
  previousCursorIndex: CueIndex
}

export type AlignmentHistoryEntry = MarkHistoryEntry | RangeHistoryEntry

export type AlignmentState = {
  marksByCueId: ReadonlyMap<CueId, TimelinePosition>
  rangeEndsByCueId: ReadonlyMap<CueId, TimelinePosition>
  currentIndex: CueIndex
  history: ReadonlyArray<AlignmentHistoryEntry>
}
