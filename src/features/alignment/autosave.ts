import { Result } from '@praha/byethrow'
import { ErrorFactory } from '@praha/error-factory'

import { asCueId, asTrackId } from '@mpppk/cue-align-core'
import type { CueId, MultiTrackAlignment, TrackId } from '@mpppk/cue-align-core'
import type { AuthoringInput } from './authoring'
import type { JsonValue } from './input'
import {
  parseAlignmentDocumentInput,
  parseCueTracksInput,
} from './multiTrackInput'

export const AUTOSAVE_STORAGE_KEY = 'cue-align:authoring-autosave'
export const AUTOSAVE_SCHEMA_VERSION = 1
export const AUTOSAVE_DEBOUNCE_MS = 750
export const AUTOSAVE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000
const AUTOSAVE_FUTURE_TOLERANCE_MS = 5 * 60 * 1000

export type AutosaveStorage = Pick<
  Storage,
  'getItem' | 'setItem' | 'removeItem'
>

export type MediaIdentity = {
  name: string
  type: string
  size: number
  lastModified: number
}

export type RecoveredAuthoringSession = {
  authoring: AuthoringInput & { alignment: MultiTrackAlignment }
  media: MediaIdentity
  savedAt: number
  currentTrackId: TrackId
  currentCueId?: CueId
}

export type AutosaveSnapshot = Omit<RecoveredAuthoringSession, 'savedAt'>

export class AutosaveReadError extends ErrorFactory({
  name: 'AutosaveReadError',
  message: 'Failed to read the local autosave',
}) {}

export class AutosaveWriteError extends ErrorFactory({
  name: 'AutosaveWriteError',
  message: 'Failed to write the local autosave',
}) {}

export class AutosaveQuotaError extends ErrorFactory({
  name: 'AutosaveQuotaError',
  message: 'Browser storage quota was exceeded while saving the session',
}) {}

export class AutosaveDiscardError extends ErrorFactory({
  name: 'AutosaveDiscardError',
  message: 'Failed to discard the local autosave',
}) {}

export class MalformedAutosaveError extends ErrorFactory({
  name: 'MalformedAutosaveError',
  message: 'The local autosave is malformed',
  fields: ErrorFactory.fields<{ reason: string }>(),
}) {}

export class UnsupportedAutosaveVersionError extends ErrorFactory({
  name: 'UnsupportedAutosaveVersionError',
  message: 'The local autosave version is not supported',
  fields: ErrorFactory.fields<{ version: unknown }>(),
}) {}

export class StaleAutosaveError extends ErrorFactory({
  name: 'StaleAutosaveError',
  message: 'The local autosave is stale',
  fields: ErrorFactory.fields<{ reason: string }>(),
}) {}

export type LoadAutosaveError =
  | AutosaveReadError
  | MalformedAutosaveError
  | UnsupportedAutosaveVersionError
  | StaleAutosaveError

export type SaveAutosaveError = AutosaveWriteError | AutosaveQuotaError

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const malformed = (
  reason: string,
  cause?: unknown,
): Result.Result<never, MalformedAutosaveError> =>
  Result.fail(new MalformedAutosaveError({ reason, cause }))

const parseMediaIdentity = (
  value: unknown,
): Result.Result<MediaIdentity, MalformedAutosaveError> => {
  if (!isRecord(value)) {
    return malformed('media must be an object')
  }

  const { name, type, size, lastModified } = value
  if (
    typeof name !== 'string' ||
    typeof type !== 'string' ||
    typeof size !== 'number' ||
    !Number.isFinite(size) ||
    size < 0 ||
    typeof lastModified !== 'number' ||
    !Number.isFinite(lastModified) ||
    lastModified < 0
  ) {
    return malformed('media identity has invalid fields')
  }

  return Result.succeed({ name, type, size, lastModified })
}

const toCueInput = (authoring: AuthoringInput): JsonValue => ({
  version: 2,
  tracks: authoring.tracks.map((track) => ({
    id: track.id,
    ...(track.label === undefined ? {} : { label: track.label }),
    cues: track.cues.map((cue) => ({ ...cue })),
  })),
})

export const getMediaIdentity = (
  file: Pick<File, 'name' | 'type' | 'size' | 'lastModified'>,
): MediaIdentity => ({
  name: file.name,
  type: file.type,
  size: file.size,
  lastModified: file.lastModified,
})

export const matchesMediaIdentity = (
  file: Pick<File, 'name' | 'type' | 'size' | 'lastModified'>,
  identity: MediaIdentity,
): boolean =>
  file.name === identity.name &&
  file.type === identity.type &&
  file.size === identity.size &&
  file.lastModified === identity.lastModified

export const validateRecoveryMedia = (
  file: Pick<File, 'name' | 'type' | 'size' | 'lastModified'>,
  identity: MediaIdentity,
): Result.Result<void, StaleAutosaveError> =>
  matchesMediaIdentity(file, identity)
    ? Result.succeed(undefined)
    : Result.fail(
        new StaleAutosaveError({
          reason: 'Selected media does not match the saved media identity',
        }),
      )

export const saveAutosave = (
  storage: AutosaveStorage,
  snapshot: AutosaveSnapshot,
  savedAt = Date.now(),
): Result.Result<void, SaveAutosaveError> => {
  const record = {
    version: AUTOSAVE_SCHEMA_VERSION,
    savedAt,
    media: snapshot.media,
    cueInput: toCueInput(snapshot.authoring),
    alignment: snapshot.authoring.alignment,
    currentTrackId: snapshot.currentTrackId,
    ...(snapshot.currentCueId === undefined
      ? {}
      : { currentCueId: snapshot.currentCueId }),
  }

  try {
    storage.setItem(AUTOSAVE_STORAGE_KEY, JSON.stringify(record))
    return Result.succeed(undefined)
  } catch (cause) {
    if (
      isRecord(cause) &&
      typeof cause.name === 'string' &&
      (cause.name === 'QuotaExceededError' ||
        cause.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    ) {
      return Result.fail(new AutosaveQuotaError({ cause }))
    }

    return Result.fail(new AutosaveWriteError({ cause }))
  }
}

export const loadAutosave = (
  storage: AutosaveStorage,
  now = Date.now(),
): Result.Result<RecoveredAuthoringSession | undefined, LoadAutosaveError> => {
  let text: string | null
  try {
    text = storage.getItem(AUTOSAVE_STORAGE_KEY)
  } catch (cause) {
    return Result.fail(new AutosaveReadError({ cause }))
  }

  if (text === null) {
    return Result.succeed(undefined)
  }

  let value: unknown
  try {
    value = JSON.parse(text) as unknown
  } catch (cause) {
    return malformed('stored value is not valid JSON', cause)
  }

  if (!isRecord(value)) {
    return malformed('stored value must be an object')
  }

  if (value.version !== AUTOSAVE_SCHEMA_VERSION) {
    return Result.fail(
      new UnsupportedAutosaveVersionError({ version: value.version }),
    )
  }

  if (typeof value.savedAt !== 'number' || !Number.isFinite(value.savedAt)) {
    return malformed('savedAt must be a finite number')
  }

  if (value.savedAt > now + AUTOSAVE_FUTURE_TOLERANCE_MS) {
    return Result.fail(
      new StaleAutosaveError({ reason: 'savedAt is in the future' }),
    )
  }

  if (now - value.savedAt > AUTOSAVE_MAX_AGE_MS) {
    return Result.fail(
      new StaleAutosaveError({ reason: 'autosave is older than 30 days' }),
    )
  }

  const mediaResult = parseMediaIdentity(value.media)
  if (Result.isFailure(mediaResult)) {
    return Result.fail(mediaResult.error)
  }

  const tracksResult = parseCueTracksInput(value.cueInput as JsonValue)
  if (Result.isFailure(tracksResult)) {
    return malformed('cue input is invalid', tracksResult.error)
  }

  const alignmentResult = parseAlignmentDocumentInput(
    tracksResult.value,
    value.alignment as JsonValue,
  )
  if (Result.isFailure(alignmentResult)) {
    return malformed('alignment is invalid', alignmentResult.error)
  }

  if (typeof value.currentTrackId !== 'string') {
    return malformed('currentTrackId must be a string')
  }

  const currentTrackId = asTrackId(value.currentTrackId)
  const currentTrack = tracksResult.value.find(
    (track) => track.id === currentTrackId,
  )
  if (currentTrack === undefined) {
    return Result.fail(
      new StaleAutosaveError({ reason: 'current Track no longer exists' }),
    )
  }

  let currentCueId: CueId | undefined
  if (value.currentCueId !== undefined) {
    if (typeof value.currentCueId !== 'string') {
      return malformed('currentCueId must be a string when present')
    }

    currentCueId = asCueId(value.currentCueId)
    if (!currentTrack.cues.some((cue) => cue.id === currentCueId)) {
      return Result.fail(
        new StaleAutosaveError({ reason: 'current Cue no longer exists' }),
      )
    }
  }

  return Result.succeed({
    authoring: {
      tracks: tracksResult.value,
      alignment: alignmentResult.value,
    },
    media: mediaResult.value,
    savedAt: value.savedAt,
    currentTrackId,
    ...(currentCueId === undefined ? {} : { currentCueId }),
  })
}

export const discardAutosave = (
  storage: AutosaveStorage,
): Result.Result<void, AutosaveDiscardError> => {
  try {
    storage.removeItem(AUTOSAVE_STORAGE_KEY)
    return Result.succeed(undefined)
  } catch (cause) {
    return Result.fail(new AutosaveDiscardError({ cause }))
  }
}

export type AutosaveScheduler<T> = {
  schedule: (value: T) => void
  flush: () => void
  cancel: () => void
}

export const createAutosaveScheduler = <T>(
  save: (value: T) => void,
  delayMs = AUTOSAVE_DEBOUNCE_MS,
): AutosaveScheduler<T> => {
  let pendingValue: T | undefined
  let timer: ReturnType<typeof setTimeout> | undefined

  const cancelTimer = () => {
    if (timer !== undefined) {
      clearTimeout(timer)
      timer = undefined
    }
  }

  const flush = () => {
    cancelTimer()
    if (pendingValue === undefined) {
      return
    }

    const value = pendingValue
    pendingValue = undefined
    save(value)
  }

  return {
    schedule: (value) => {
      pendingValue = value
      cancelTimer()
      timer = setTimeout(flush, delayMs)
    },
    flush,
    cancel: () => {
      cancelTimer()
      pendingValue = undefined
    },
  }
}
