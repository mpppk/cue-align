import { Result } from '@praha/byethrow'

import { UnknownCueIdError } from './errors'
import type { AlignmentError } from './errors'
import type { Alignment, AlignmentState, Cue, CueId } from './types'
import { validateAlignment, validateCues } from './validation'

export type CreateAlignmentStateOptions<TCue extends Cue> = {
  cues: ReadonlyArray<TCue>
  alignment?: Alignment
  initialCueId?: CueId
}

export const createAlignmentState = <TCue extends Cue>(
  options: CreateAlignmentStateOptions<TCue>,
): Result.Result<AlignmentState, AlignmentError> => {
  const { cues, alignment, initialCueId } = options

  let marksByCueId: ReadonlyMap<CueId, number>

  if (alignment === undefined) {
    const cueValidation = validateCues(cues)
    if (Result.isFailure(cueValidation)) {
      return Result.fail(cueValidation.error)
    }

    marksByCueId = new Map()
  } else {
    const alignmentValidation = validateAlignment(cues, alignment)
    if (Result.isFailure(alignmentValidation)) {
      return Result.fail(alignmentValidation.error)
    }

    marksByCueId = alignmentValidation.value
  }

  let currentIndex = 0

  if (initialCueId !== undefined) {
    currentIndex = cues.findIndex((cue) => cue.id === initialCueId)
    if (currentIndex === -1) {
      return Result.fail(new UnknownCueIdError({ cueId: initialCueId }))
    }
  }

  return Result.succeed({
    marksByCueId,
    currentIndex,
    history: [],
  })
}
