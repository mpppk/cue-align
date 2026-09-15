import type { Alignment, AlignmentState, Cue, CueId, Mark } from './types'

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

export const getAlignment = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
): Alignment => ({
  version: 1,
  marks: cues.flatMap((cue) => {
    const at = state.marksByCueId.get(cue.id)
    return at === undefined ? [] : [{ cueId: cue.id, at }]
  }),
})

export const isComplete = <TCue extends Cue>(
  state: AlignmentState,
  cues: ReadonlyArray<TCue>,
): boolean => cues.every((cue) => state.marksByCueId.has(cue.id))
