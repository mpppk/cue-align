import { Result } from '@praha/byethrow'

import type {
  CueId,
  MarkCurrentError,
  MarkError,
  TimelinePosition,
} from '@mpppk/cue-align-core'

export type AuthoringMode = 'sequential' | 'selection'

export type AuthoringMarkError = MarkCurrentError | MarkError

export type AuthoringMarkActions = {
  markCurrent: (at: TimelinePosition) => Result.Result<void, MarkCurrentError>
  mark: (cueId: CueId, at: TimelinePosition) => Result.Result<void, MarkError>
}

export const markForAuthoringMode = (
  actions: AuthoringMarkActions,
  mode: AuthoringMode,
  currentCueId: CueId | undefined,
  at: TimelinePosition,
): Result.Result<void, AuthoringMarkError> => {
  if (mode === 'selection' && currentCueId !== undefined) {
    return actions.mark(currentCueId, at)
  }

  return actions.markCurrent(at)
}
