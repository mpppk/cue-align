import { Result } from '@praha/byethrow'

import {
  UnsupportedAlignmentVersionError,
  asCueId,
  asTimelinePosition,
  validateAlignment,
  validateCues,
} from '#/core'
import type { Alignment, Cue, Mark } from '#/core'
import {
  InputParseError,
  InputReadError,
  InvalidAlignmentInputError,
  InvalidCueInputError,
} from './errors'
import type {
  InputSource,
  ParseAlignmentInputError,
  ParseAlignmentJsonError,
  ParseCueInputError,
  ParseCueJsonError,
  ReadAlignmentFileError,
  ReadCueFileError,
} from './errors'

export type JsonPrimitive = null | boolean | number | string
export type JsonValue = JsonPrimitive | JsonObject | Array<JsonValue>
export type JsonObject = { [key: string]: JsonValue | undefined }

export type ReferenceCue = Cue & {
  label?: string
  [key: string]: JsonValue | undefined
}

export type TextFile = Pick<File, 'text'>

const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseJson = (
  text: string,
  source: InputSource,
): Result.Result<JsonValue, InputParseError> =>
  Result.try({
    try: (): JsonValue => JSON.parse(text) as JsonValue,
    catch: (cause) => new InputParseError({ source, cause }),
  })

const readText = (
  file: TextFile,
  source: InputSource,
): Result.ResultAsync<string, InputReadError> =>
  Result.try({
    try: () => file.text(),
    catch: (cause) => new InputReadError({ source, cause }),
  })

export const parseCueInput = (
  value: JsonValue,
): Result.Result<ReadonlyArray<ReferenceCue>, ParseCueInputError> => {
  if (!Array.isArray(value)) {
    return Result.fail(
      new InvalidCueInputError({
        path: '$',
        reason: 'Expected an array of cue objects',
      }),
    )
  }

  const cues: Array<ReferenceCue> = []

  for (const [index, rawCue] of value.entries()) {
    if (!isJsonObject(rawCue)) {
      return Result.fail(
        new InvalidCueInputError({
          path: `$[${index}]`,
          reason: 'Expected an object',
        }),
      )
    }

    const id = rawCue.id
    if (typeof id !== 'string') {
      return Result.fail(
        new InvalidCueInputError({
          path: `$[${index}].id`,
          reason: 'Expected a string',
        }),
      )
    }

    const label = rawCue.label
    if (label !== undefined && typeof label !== 'string') {
      return Result.fail(
        new InvalidCueInputError({
          path: `$[${index}].label`,
          reason: 'Expected a string when present',
        }),
      )
    }

    cues.push({ ...rawCue, id: asCueId(id) })
  }

  return Result.pipe(
    Result.succeed(cues as ReadonlyArray<ReferenceCue>),
    Result.andThrough((parsedCues) => validateCues(parsedCues)),
  )
}

export const parseCueJson = (
  text: string,
): Result.Result<ReadonlyArray<ReferenceCue>, ParseCueJsonError> =>
  Result.pipe(
    parseJson(text, 'cue'),
    Result.andThen((value) => parseCueInput(value)),
  )

export const readCueFile = (
  file: TextFile,
): Result.ResultAsync<ReadonlyArray<ReferenceCue>, ReadCueFileError> =>
  Result.pipe(
    readText(file, 'cue'),
    Result.andThen((text) => parseCueJson(text)),
  )

export const parseAlignmentInput = (
  cues: ReadonlyArray<Cue>,
  value: JsonValue,
): Result.Result<Alignment, ParseAlignmentInputError> => {
  if (!isJsonObject(value)) {
    return Result.fail(
      new InvalidAlignmentInputError({
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
      new InvalidAlignmentInputError({
        path: '$.marks',
        reason: 'Expected an array',
      }),
    )
  }

  const marks: Array<Mark> = []

  for (const [index, rawMark] of value.marks.entries()) {
    if (!isJsonObject(rawMark)) {
      return Result.fail(
        new InvalidAlignmentInputError({
          path: `$.marks[${index}]`,
          reason: 'Expected an object',
        }),
      )
    }

    const cueId = rawMark.cueId
    if (typeof cueId !== 'string') {
      return Result.fail(
        new InvalidAlignmentInputError({
          path: `$.marks[${index}].cueId`,
          reason: 'Expected a string',
        }),
      )
    }

    const at = rawMark.at
    if (typeof at !== 'number') {
      return Result.fail(
        new InvalidAlignmentInputError({
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
    Result.andThrough((parsedAlignment) =>
      validateAlignment(cues, parsedAlignment),
    ),
  )
}

export const parseAlignmentJson = (
  cues: ReadonlyArray<Cue>,
  text: string,
): Result.Result<Alignment, ParseAlignmentJsonError> =>
  Result.pipe(
    parseJson(text, 'alignment'),
    Result.andThen((value) => parseAlignmentInput(cues, value)),
  )

export const readAlignmentFile = (
  cues: ReadonlyArray<Cue>,
  file: TextFile,
): Result.ResultAsync<Alignment, ReadAlignmentFileError> =>
  Result.pipe(
    readText(file, 'alignment'),
    Result.andThen((text) => parseAlignmentJson(cues, text)),
  )
