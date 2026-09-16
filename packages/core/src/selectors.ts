import type {
  Alignment,
  AlignmentState,
  Cue,
  CueId,
  CueRange,
  Mark,
} from './types'

export const getCurrentCue = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
): TCue | undefined => cues[state.currentIndex]

export const getMark = (
  state: AlignmentState,
  cueId: CueId,
): Mark | undefined => {
  const at = state.marksByCueId.get(cueId)
  return at === undefined ? undefined : { cueId, at }
}

export const getRange = (
  state: AlignmentState,
  cueId: CueId,
): CueRange | undefined => {
  const end = state.rangeEndsByCueId.get(cueId)
  return end === undefined ? undefined : { cueId, end }
}

export const getAlignment = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
): Alignment => {
  const marks = cues.flatMap((cue) => {
    const at = state.marksByCueId.get(cue.id)
    return at === undefined ? [] : [{ cueId: cue.id, at }]
  })
  const ranges = cues.flatMap((cue) => {
    const end = state.rangeEndsByCueId.get(cue.id)
    return end === undefined ? [] : [{ cueId: cue.id, end }]
  })

  return {
    version: 1,
    marks,
    ...(ranges.length === 0 ? {} : { ranges }),
  }
}

export const isComplete = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
): boolean => cues.every((cue) => state.marksByCueId.has(cue.id))
