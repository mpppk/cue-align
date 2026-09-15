import { Result } from '@praha/byethrow'
import { useEffect, useState } from 'react'
import type { RefObject } from 'react'

import { asTimelinePosition } from '#/core'
import type { MarkCurrentError, TimelinePosition } from '#/core'

type AlignmentShortcut = 'mark-current' | 'undo' | 'previous-cue' | 'next-cue'

export type AlignmentShortcutActions = {
  markCurrent: (
    at: TimelinePosition,
  ) => Result.Result<void, MarkCurrentError>
  undo: () => boolean
  goToPreviousCue: () => void
  goToNextCue: () => void
}

export type AlignmentShortcutEvent = Pick<
  KeyboardEvent,
  'code' | 'repeat' | 'target' | 'preventDefault'
>

const editableTagNames = new Set(['INPUT', 'TEXTAREA', 'SELECT'])

export const isEditableShortcutTarget = (
  target: EventTarget | null,
): boolean => {
  if (target === null) {
    return false
  }

  const candidate = target as EventTarget & {
    tagName?: unknown
    isContentEditable?: unknown
  }

  if (candidate.isContentEditable === true) {
    return true
  }

  if (typeof candidate.tagName !== 'string') {
    return false
  }

  return editableTagNames.has(candidate.tagName.toUpperCase())
}

const resolveAlignmentShortcut = (
  code: KeyboardEvent['code'],
): AlignmentShortcut | undefined => {
  switch (code) {
    case 'Space':
      return 'mark-current'
    case 'Backspace':
      return 'undo'
    case 'ArrowLeft':
      return 'previous-cue'
    case 'ArrowRight':
      return 'next-cue'
    default:
      return undefined
  }
}

export const handleAlignmentShortcut = (
  event: AlignmentShortcutEvent,
  media: Pick<HTMLMediaElement, 'currentTime'> | null,
  actions: AlignmentShortcutActions,
): Result.Result<boolean, MarkCurrentError> => {
  if (isEditableShortcutTarget(event.target)) {
    return Result.succeed(false)
  }

  const shortcut = resolveAlignmentShortcut(event.code)
  if (shortcut === undefined) {
    return Result.succeed(false)
  }

  event.preventDefault()

  if (event.repeat) {
    return Result.succeed(false)
  }

  switch (shortcut) {
    case 'mark-current': {
      if (media === null) {
        return Result.succeed(false)
      }

      const result = actions.markCurrent(
        asTimelinePosition(media.currentTime),
      )
      if (Result.isFailure(result)) {
        return Result.fail(result.error)
      }

      return Result.succeed(true)
    }
    case 'undo':
      actions.undo()
      return Result.succeed(true)
    case 'previous-cue':
      actions.goToPreviousCue()
      return Result.succeed(true)
    case 'next-cue':
      actions.goToNextCue()
      return Result.succeed(true)
  }
}

type UseAlignmentShortcutsOptions = {
  mediaRef: RefObject<HTMLAudioElement | null>
  actions: AlignmentShortcutActions
}

export const useAlignmentShortcuts = ({
  mediaRef,
  actions,
}: UseAlignmentShortcutsOptions): MarkCurrentError | undefined => {
  const [error, setError] = useState<MarkCurrentError>()

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const result = handleAlignmentShortcut(event, mediaRef.current, actions)

      if (Result.isFailure(result)) {
        setError(result.error)
        return
      }

      if (result.value) {
        setError(undefined)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [actions, mediaRef])

  return error
}
