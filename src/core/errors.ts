import { ErrorFactory } from '@praha/error-factory'

import type { CueId } from './types'

export class EmptyCueIdError extends ErrorFactory({
  name: 'EmptyCueIdError',
  message: 'Cue ID must not be empty',
  fields: ErrorFactory.fields<{ index: number }>(),
}) {}

export class DuplicateCueIdError extends ErrorFactory({
  name: 'DuplicateCueIdError',
  message: 'Cue ID must be unique',
  fields: ErrorFactory.fields<{ cueId: CueId }>(),
}) {}

export class UnknownCueIdError extends ErrorFactory({
  name: 'UnknownCueIdError',
  message: 'Cue ID was not found',
  fields: ErrorFactory.fields<{ cueId: CueId }>(),
}) {}

export class DuplicateMarkError extends ErrorFactory({
  name: 'DuplicateMarkError',
  message: 'Alignment must not contain duplicate marks for a cue',
  fields: ErrorFactory.fields<{ cueId: CueId }>(),
}) {}

export class InvalidTimeError extends ErrorFactory({
  name: 'InvalidTimeError',
  message: 'Timeline position must be a finite non-negative number',
  fields: ErrorFactory.fields<{ at: number }>(),
}) {}

export class NonMonotonicTimeError extends ErrorFactory({
  name: 'NonMonotonicTimeError',
  message: 'Timestamp violates cue ordering',
  fields: ErrorFactory.fields<{
    cueId: CueId
    at: number
    min?: number
    max?: number
  }>(),
}) {}

export class UnsupportedAlignmentVersionError extends ErrorFactory({
  name: 'UnsupportedAlignmentVersionError',
  message: 'Alignment version is not supported',
  fields: ErrorFactory.fields<{ version: unknown }>(),
}) {}

export class InvalidCueIndexError extends ErrorFactory({
  name: 'InvalidCueIndexError',
  message: 'Cue index is out of range',
  fields: ErrorFactory.fields<{ index: number }>(),
}) {}

export type ValidateCuesError = EmptyCueIdError | DuplicateCueIdError

export type ValidateAlignmentError =
  | ValidateCuesError
  | UnknownCueIdError
  | DuplicateMarkError
  | InvalidTimeError
  | NonMonotonicTimeError

export type CreateAlignmentStateError = ValidateAlignmentError
export type CreateAlignmentSessionError = CreateAlignmentStateError

export type MarkCurrentError =
  | InvalidCueIndexError
  | InvalidTimeError
  | NonMonotonicTimeError

export type MarkError =
  | UnknownCueIdError
  | InvalidTimeError
  | NonMonotonicTimeError

export type SeekCueError = UnknownCueIdError
export type SeekIndexError = InvalidCueIndexError

/** All domain errors, useful as an umbrella type but intentionally not used by Result APIs. */
export type AlignmentError =
  | EmptyCueIdError
  | DuplicateCueIdError
  | UnknownCueIdError
  | DuplicateMarkError
  | InvalidTimeError
  | NonMonotonicTimeError
  | UnsupportedAlignmentVersionError
  | InvalidCueIndexError
