import { ErrorFactory } from '@praha/error-factory'

import type { CueId, CueIndex, TimelinePosition } from './types'

export class EmptyCueIdError extends ErrorFactory({
  name: 'EmptyCueIdError',
  message: 'Cue ID must not be empty',
  fields: ErrorFactory.fields<{ index: CueIndex }>(),
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

export class CueNotMarkedError extends ErrorFactory({
  name: 'CueNotMarkedError',
  message: 'Cue must already have a Mark before this operation',
  fields: ErrorFactory.fields<{ cueId: CueId }>(),
}) {}

export class DuplicateMarkError extends ErrorFactory({
  name: 'DuplicateMarkError',
  message: 'Alignment must not contain duplicate marks for a cue',
  fields: ErrorFactory.fields<{ cueId: CueId }>(),
}) {}

export class DuplicateRangeError extends ErrorFactory({
  name: 'DuplicateRangeError',
  message: 'Alignment must not contain duplicate ranges for a cue',
  fields: ErrorFactory.fields<{ cueId: CueId }>(),
}) {}

export class InvalidTimeError extends ErrorFactory({
  name: 'InvalidTimeError',
  message: 'Timeline position must be a finite non-negative number',
  fields: ErrorFactory.fields<{ at: TimelinePosition }>(),
}) {}

export class InvalidRangeError extends ErrorFactory({
  name: 'InvalidRangeError',
  message: 'Explicit range end must not precede its start Mark',
  fields: ErrorFactory.fields<{
    cueId: CueId
    start: TimelinePosition
    end: TimelinePosition
  }>(),
}) {}

export class NonMonotonicTimeError extends ErrorFactory({
  name: 'NonMonotonicTimeError',
  message: 'Timestamp violates cue ordering',
  fields: ErrorFactory.fields<{
    cueId: CueId
    at: TimelinePosition
    min?: TimelinePosition
    max?: TimelinePosition
  }>(),
}) {}

export class UnsupportedAlignmentVersionError extends ErrorFactory({
  name: 'UnsupportedAlignmentVersionError',
  message: 'Alignment version is not supported',
  fields: ErrorFactory.fields<{ version: unknown }>(),
}) {}

export class InvalidAlignmentProposalError extends ErrorFactory({
  name: 'InvalidAlignmentProposalError',
  message: 'Alignment proposal is malformed',
  fields: ErrorFactory.fields<{ path: string; reason: string }>(),
}) {}

export class InvalidCueIndexError extends ErrorFactory({
  name: 'InvalidCueIndexError',
  message: 'Cue index is out of range',
  fields: ErrorFactory.fields<{ index: CueIndex }>(),
}) {}

export type ValidateCuesError = EmptyCueIdError | DuplicateCueIdError

export type ValidateAlignmentError =
  | ValidateCuesError
  | UnknownCueIdError
  | CueNotMarkedError
  | DuplicateMarkError
  | DuplicateRangeError
  | InvalidTimeError
  | InvalidRangeError
  | NonMonotonicTimeError

export type CreateAlignmentStateError = ValidateAlignmentError
export type CreateAlignmentSessionError = CreateAlignmentStateError

export type MarkCurrentError =
  | InvalidCueIndexError
  | InvalidTimeError
  | InvalidRangeError
  | NonMonotonicTimeError

export type MarkError =
  | UnknownCueIdError
  | InvalidTimeError
  | InvalidRangeError
  | NonMonotonicTimeError

export type AdjustMarkError =
  | UnknownCueIdError
  | CueNotMarkedError
  | InvalidTimeError
  | InvalidRangeError
  | NonMonotonicTimeError

export type SetRangeEndError =
  | UnknownCueIdError
  | CueNotMarkedError
  | InvalidTimeError
  | InvalidRangeError

export type ClearRangeEndError = UnknownCueIdError

export type SeekCueError = UnknownCueIdError
export type SeekIndexError = InvalidCueIndexError

export type ParseAlignmentProposalError =
  | InvalidAlignmentProposalError
  | UnsupportedAlignmentVersionError
  | ValidateAlignmentError

export type RequestAlignmentProposalError<TProviderError extends Error> =
  | TProviderError
  | ParseAlignmentProposalError

/** All domain errors, useful as an umbrella type but intentionally not used by Result APIs. */
export type AlignmentError =
  | EmptyCueIdError
  | DuplicateCueIdError
  | UnknownCueIdError
  | CueNotMarkedError
  | DuplicateMarkError
  | DuplicateRangeError
  | InvalidTimeError
  | InvalidRangeError
  | NonMonotonicTimeError
  | UnsupportedAlignmentVersionError
  | InvalidAlignmentProposalError
  | InvalidCueIndexError
