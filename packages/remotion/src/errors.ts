import { ErrorFactory } from '@praha/error-factory'

import type { CueId } from '@mpppk/cue-align-core'
import type { RemotionFrame } from './frames'

export class InvalidFramesPerSecondError extends ErrorFactory({
  name: 'InvalidFramesPerSecondError',
  message: 'Frames per second must be a finite positive number',
  fields: ErrorFactory.fields<{ fps: number }>(),
}) {}

export class InvalidRemotionFrameError extends ErrorFactory({
  name: 'InvalidRemotionFrameError',
  message: 'Remotion frame must be a finite non-negative integer',
  fields: ErrorFactory.fields<{ frame: RemotionFrame }>(),
}) {}

export class MissingMarkError extends ErrorFactory({
  name: 'MissingMarkError',
  message: 'Cue does not have a Mark in the Alignment',
  fields: ErrorFactory.fields<{ cueId: CueId }>(),
}) {}

export type FrameToTimelinePositionError =
  | InvalidFramesPerSecondError
  | InvalidRemotionFrameError

export type GetCueFrameMarkError =
  | InvalidFramesPerSecondError
  | MissingMarkError
