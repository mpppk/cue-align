import { Result } from '@praha/byethrow'

import { asTimelinePosition } from '@mpppk/cue-align-core'
import type { Alignment, CueId, TimelinePosition } from '@mpppk/cue-align-core'
import {
  InvalidFramesPerSecondError,
  InvalidRemotionFrameError,
  MissingMarkError,
} from './errors'
import type {
  FrameToTimelinePositionError,
  GetCueFrameMarkError,
} from './errors'

declare const remotionFrameBrand: unique symbol
declare const framesPerSecondBrand: unique symbol

export type RemotionFrame = number & {
  readonly [remotionFrameBrand]: 'RemotionFrame'
}

export type FramesPerSecond = number & {
  readonly [framesPerSecondBrand]: 'FramesPerSecond'
}

export type RemotionFrameMark = {
  cueId: CueId
  at: TimelinePosition
  frame: RemotionFrame
}

export const asRemotionFrame = (value: number): RemotionFrame =>
  value as RemotionFrame

const asFramesPerSecond = (value: number): FramesPerSecond =>
  value as FramesPerSecond

export const validateFramesPerSecond = (
  fps: number,
): Result.Result<FramesPerSecond, InvalidFramesPerSecondError> => {
  if (!Number.isFinite(fps) || fps <= 0) {
    return Result.fail(new InvalidFramesPerSecondError({ fps }))
  }

  return Result.succeed(asFramesPerSecond(fps))
}

export const validateRemotionFrame = (
  frame: number,
): Result.Result<RemotionFrame, InvalidRemotionFrameError> => {
  if (!Number.isFinite(frame) || frame < 0 || !Number.isInteger(frame)) {
    return Result.fail(
      new InvalidRemotionFrameError({ frame: asRemotionFrame(frame) }),
    )
  }

  return Result.succeed(asRemotionFrame(frame))
}

const toFrame = (at: TimelinePosition, fps: FramesPerSecond): RemotionFrame =>
  asRemotionFrame(Math.round(at * fps))

/**
 * Converts a canonical TimelinePosition to the nearest Remotion frame.
 *
 * The rounding rule is deliberately owned by this adapter rather than Core:
 * `Math.round(at * fps)`.
 */
export const timelinePositionToFrame = (
  at: TimelinePosition,
  fps: number,
): Result.Result<RemotionFrame, InvalidFramesPerSecondError> =>
  Result.pipe(
    validateFramesPerSecond(fps),
    Result.map((validFps) => toFrame(at, validFps)),
  )

export const frameToTimelinePosition = (
  frame: number,
  fps: number,
): Result.Result<TimelinePosition, FrameToTimelinePositionError> =>
  Result.pipe(
    validateFramesPerSecond(fps),
    Result.andThen((validFps) =>
      Result.pipe(
        validateRemotionFrame(frame),
        Result.map((validFrame) => asTimelinePosition(validFrame / validFps)),
      ),
    ),
  )

export const alignmentToFrameMarks = (
  alignment: Alignment,
  fps: number,
): Result.Result<
  ReadonlyArray<RemotionFrameMark>,
  InvalidFramesPerSecondError
> =>
  Result.pipe(
    validateFramesPerSecond(fps),
    Result.map((validFps) =>
      alignment.marks.map((mark) => ({
        cueId: mark.cueId,
        at: mark.at,
        frame: toFrame(mark.at, validFps),
      })),
    ),
  )

export const getCueFrameMark = (
  alignment: Alignment,
  cueId: CueId,
  fps: number,
): Result.Result<RemotionFrameMark, GetCueFrameMarkError> =>
  Result.pipe(
    validateFramesPerSecond(fps),
    Result.andThen((validFps) => {
      const mark = alignment.marks.find(
        (candidate) => candidate.cueId === cueId,
      )
      if (mark === undefined) {
        return Result.fail(new MissingMarkError({ cueId }))
      }

      return Result.succeed({
        cueId: mark.cueId,
        at: mark.at,
        frame: toFrame(mark.at, validFps),
      })
    }),
  )
