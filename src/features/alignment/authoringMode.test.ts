import { Result } from '@praha/byethrow'
import { describe, expect, it } from 'vite-plus/test'

import { asCueId, asTimelinePosition } from '@mpppk/cue-align-core'
import { markForAuthoringMode } from './authoringMode'
import type { AuthoringMarkActions } from './authoringMode'

const cueId = asCueId('selected')
const at = asTimelinePosition(12.5)

const createActions = () => {
  let sequentialMarks = 0
  let selectedMarks = 0

  const actions: AuthoringMarkActions = {
    markCurrent: () => {
      sequentialMarks += 1
      return Result.succeed(undefined)
    },
    mark: (selectedCueId, selectedAt) => {
      expect(selectedCueId).toBe(cueId)
      expect(selectedAt).toBe(at)
      selectedMarks += 1
      return Result.succeed(undefined)
    },
  }

  return {
    actions,
    getSequentialMarks: () => sequentialMarks,
    getSelectedMarks: () => selectedMarks,
  }
}

describe('authoring mode', () => {
  it('preserves sequential mark-and-advance behavior by using markCurrent', () => {
    const state = createActions()

    expect(
      markForAuthoringMode(state.actions, 'sequential', cueId, at),
    ).toBeSuccess()
    expect(state.getSequentialMarks()).toBe(1)
    expect(state.getSelectedMarks()).toBe(0)
  })

  it('marks the selected Cue directly in selection mode', () => {
    const state = createActions()

    expect(
      markForAuthoringMode(state.actions, 'selection', cueId, at),
    ).toBeSuccess()
    expect(state.getSequentialMarks()).toBe(0)
    expect(state.getSelectedMarks()).toBe(1)
  })
})
