import { ErrorFactory } from '@praha/error-factory'

import type {
  UnsupportedAlignmentVersionError,
  ValidateAlignmentError,
  ValidateCuesError,
} from '#/core'

export type InputSource = 'cue' | 'alignment'

export class InputReadError extends ErrorFactory({
  name: 'InputReadError',
  message: 'Failed to read input file',
  fields: ErrorFactory.fields<{ source: InputSource }>(),
}) {}

export class InputParseError extends ErrorFactory({
  name: 'InputParseError',
  message: 'Failed to parse input JSON',
  fields: ErrorFactory.fields<{ source: InputSource }>(),
}) {}

export class InvalidCueInputError extends ErrorFactory({
  name: 'InvalidCueInputError',
  message: 'Cue input is structurally invalid',
  fields: ErrorFactory.fields<{ path: string; reason: string }>(),
}) {}

export class InvalidAlignmentInputError extends ErrorFactory({
  name: 'InvalidAlignmentInputError',
  message: 'Alignment input is structurally invalid',
  fields: ErrorFactory.fields<{ path: string; reason: string }>(),
}) {}

export type ParseCueInputError = InvalidCueInputError | ValidateCuesError
export type ParseCueJsonError = InputParseError | ParseCueInputError
export type ReadCueFileError = InputReadError | ParseCueJsonError

export type ParseAlignmentInputError =
  | InvalidAlignmentInputError
  | UnsupportedAlignmentVersionError
  | ValidateAlignmentError

export type ParseAlignmentJsonError = InputParseError | ParseAlignmentInputError
export type ReadAlignmentFileError = InputReadError | ParseAlignmentJsonError
