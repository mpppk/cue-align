import { Result } from '@praha/byethrow'
import { describe, expect, it } from 'vite-plus/test'

import { asTimelinePosition } from '#/core'
import type { TimelinePosition } from '#/core'
import {
  handleAlignmentShortcut,
  isEditableShortcutTarget,
} from './useAlignmentShortcuts'
import type {
  AlignmentShortcutActions,
  AlignmentShortcutEvent,
} from './useAlignmentShortcuts'

const createEvent = ({
  code,
  repeat = false,
  target = null,
}: {
  code: string
  repeat?: boolean
  target?: EventTarget | null
}) => {
  let prevented = false
  const event: AlignmentShortcutEvent = {
    code,
    repeat,
    target,
    preventDefault: () => {
      prevented = true
    },
  }

  return {
    event,
    wasPrevented: () => prevented,
  }
}

const createActions = () => {
  let markedAt: TimelinePosition | undefined
  let undoCount = 0
  let previousCount = 0
  let nextCount = 0

  const actions: AlignmentShortcutActions = {
    markCurrent: (at) => {
      markedAt = at
      return Result.succeed(undefined)
    },
    undo: () => {
      undoCount += 1
      return true
    },
    goToPreviousCue: () => {
      previousCount += 1
    },
    goToNextCue: () => {
      nextCount += 1
    },
  }

  return {
    actions,
    getMarkedAt: () => markedAt,
    getUndoCount: () => undoCount,
    getPreviousCount: () => previousCount,
    getNextCount: () => nextCount,
  }
}

const editableTarget = (
  tagName: string,
  isContentEditable = false,
): EventTarget =>
  ({ tagName, isContentEditable }) as unknown as EventTarget

describe('alignment keyboard shortcuts', () => {
  it('marks using the media currentTime read at the keyboard event', () => {
    const state = createActions()
    const keyboard = createEvent({ code: 'Space' })
    const media = { currentTime: 12.345 }

    const result = handleAlignmentShortcut(
      keyboard.event,
      media,
      state.actions,
    )

    expect(result).toBeSuccess((handled) => expect(handled).toBe(true))
    expect(state.getMarkedAt()).toBe(asTimelinePosition(12.345))
    expect(keyboard.wasPrevented()).toBe(true)
  })

  it('routes undo and Cue navigation without marking', () => {
    const state = createActions()

    for (const code of ['Backspace', 'ArrowLeft', 'ArrowRight']) {
      const keyboard = createEvent({ code })
      expect(
        handleAlignmentShortcut(keyboard.event, null, state.actions),
      ).toBeSuccess((handled) => expect(handled).toBe(true))
      expect(keyboard.wasPrevented()).toBe(true)
    }

    expect(state.getMarkedAt()).toBeUndefined()
    expect(state.getUndoCount()).toBe(1)
    expect(state.getPreviousCount()).toBe(1)
    expect(state.getNextCount()).toBe(1)
  })

  it('suppresses repeated handled keys without repeating the action', () => {
    const state = createActions()
    const keyboard = createEvent({ code: 'Space', repeat: true })

    const result = handleAlignmentShortcut(
      keyboard.event,
      { currentTime: 3 },
      state.actions,
    )

    expect(result).toBeSuccess((handled) => expect(handled).toBe(false))
    expect(state.getMarkedAt()).toBeUndefined()
    expect(keyboard.wasPrevented()).toBe(true)
  })

  it('ignores shortcuts while an editable element has focus', () => {
    const state = createActions()

    for (const target of [
      editableTarget('input'),
      editableTarget('textarea'),
      editableTarget('select'),
      editableTarget('div', true),
    ]) {
      const keyboard = createEvent({ code: 'Space', target })
      expect(
        handleAlignmentShortcut(
          keyboard.event,
          { currentTime: 4 },
          state.actions,
        ),
      ).toBeSuccess((handled) => expect(handled).toBe(false))
      expect(keyboard.wasPrevented()).toBe(false)
    }

    expect(state.getMarkedAt()).toBeUndefined()
  })

  it('identifies editable targets without requiring DOM globals', () => {
    expect(isEditableShortcutTarget(editableTarget('INPUT'))).toBe(true)
    expect(isEditableShortcutTarget(editableTarget('div', true))).toBe(true)
    expect(isEditableShortcutTarget(editableTarget('button'))).toBe(false)
    expect(isEditableShortcutTarget(null)).toBe(false)
  })

  it('leaves unrelated keys untouched', () => {
    const state = createActions()
    const keyboard = createEvent({ code: 'KeyA' })

    const result = handleAlignmentShortcut(
      keyboard.event,
      { currentTime: 5 },
      state.actions,
    )

    expect(result).toBeSuccess((handled) => expect(handled).toBe(false))
    expect(keyboard.wasPrevented()).toBe(false)
    expect(state.getMarkedAt()).toBeUndefined()
  })
})
