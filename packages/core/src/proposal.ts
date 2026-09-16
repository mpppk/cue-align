import { Result } from '@praha/byethrow'

import {
  InvalidAlignmentProposalError,
  UnsupportedAlignmentVersionError,
} from './errors'
import type {
  ParseAlignmentProposalError,
  RequestAlignmentProposalError,
} from './errors'
import { asCueId, asTimelinePosition } from './types'
import type { Alignment, Cue, Mark } from './types'
import { validateAlignment } from './validation'

export type AlignmentProposalProvider<
  TInput,
  TProviderError extends Error,
> = {
  propose: (input: TInput) => Result.ResultAsync<unknown, TProviderError>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

export const parseAlignmentProposal = <TCue extends Cue>(
  cues: ReadonlyArray<TCue>,
  value: unknown,
): Result.Result<Alignment, ParseAlignmentProposalError> => {
  if (!isRecord(value)) {
    return Result.fail(
      new InvalidAlignmentProposalError({
        path: '$',
        reason: 'Expected an object',
      }),
    )
  }

  if (value.version !== 1) {
    return Result.fail(
      new UnsupportedAlignmentVersionError({ version: value.version }),
    )
  }

  if (!Array.isArray(value.marks)) {
    return Result.fail(
      new InvalidAlignmentProposalError({
        path: '$.marks',
        reason: 'Expected an array',
      }),
    )
  }

  const marks: Array<Mark> = []

  for (const [index, rawMark] of value.marks.entries()) {
    if (!isRecord(rawMark)) {
      return Result.fail(
        new InvalidAlignmentProposalError({
          path: `$.marks[${index}]`,
          reason: 'Expected an object',
        }),
      )
    }

    const cueId = rawMark.cueId
    if (typeof cueId !== 'string') {
      return Result.fail(
        new InvalidAlignmentProposalError({
          path: `$.marks[${index}].cueId`,
          reason: 'Expected a string',
        }),
      )
    }

    const at = rawMark.at
    if (typeof at !== 'number') {
      return Result.fail(
        new InvalidAlignmentProposalError({
          path: `$.marks[${index}].at`,
          reason: 'Expected a number',
        }),
      )
    }

    marks.push({
      cueId: asCueId(cueId),
      at: asTimelinePosition(at),
    })
  }

  const alignment: Alignment = { version: 1, marks }

  return Result.pipe(
    Result.succeed(alignment),
    Result.andThrough((proposal) => validateAlignment(cues, proposal)),
  )
}

export const requestAlignmentProposal = <
  TCue extends Cue,
  TInput,
  TProviderError extends Error,
>(
  cues: ReadonlyArray<TCue>,
  provider: AlignmentProposalProvider<TInput, TProviderError>,
  input: TInput,
): Result.ResultAsync<Alignment, RequestAlignmentProposalError<TProviderError>> =>
  Result.pipe(
    provider.propose(input),
    Result.andThen((proposal) => parseAlignmentProposal(cues, proposal)),
  )
