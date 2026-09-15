import { Result } from '@praha/byethrow'

import { UnknownCueIdError } from './errors'
import type { CreateAlignmentStateError } from './errors'
import { asCueIndex } from './types'
import type {
  Alignment,
  AlignmentState,
  Cue,
  CueId,
  TimelinePosition,
} from './types'
import { validateAlignment, validateCues } from './validation'

export type CreateAlignmentStateOptions<TCue extends Cue> = {
  cues: ReadonlyArray<TCue>
  alignment?: Alignment
  initialCueId?: CueId
}

export const createAlignmentState = <TCue extends Cue>(
  options: CreateAlignmentStateOptions<TCue>,
): Result.Result<AlignmentState, CreateAlignmentStateError> => {
  const { cues, alignment, initialCueId } = options

  let marksByCueId: ReadonlyMap<CueId, TimelinePosition>

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

  let currentIndex = asCueIndex(0)

  if (initialCueId !== undefined) {
    const index = cues.findIndex((cue) => cue.id === initialCueId)
    if (index === -1) {
      return Result.fail(new UnknownCueIdError({ cueId: initialCueId }))
    }
    currentIndex = asCueIndex(index)
  }

  return Result.succeed({
    marksByCueId,
    currentIndex,
    history: [],
  })
}
