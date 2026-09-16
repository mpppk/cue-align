import { Result } from '@praha/byethrow'

import {
  UnsupportedAlignmentVersionError,
  alignmentToTrackAlignment,
  asTrackId,
  validateCueTracks,
  validateMultiTrackAlignment,
} from '@mpppk/cue-align-core'
import type {
  CueTrack,
  MultiTrackAlignment,
  TrackAlignment,
  TrackId,
  ValidateMultiTrackAlignmentError,
} from '@mpppk/cue-align-core'
import {
  InputParseError,
  InputReadError,
  InvalidAlignmentInputError,
  InvalidCueInputError,
} from './errors'
import { parseAlignmentInput, parseCueInput } from './input'
import type {
  JsonObject,
  JsonValue,
  ReferenceCue,
  TextFile,
} from './input'
import type {
  ParseAlignmentInputError,
  ParseCueInputError,
} from './errors'

export const DEFAULT_TRACK_ID = asTrackId('default')

export type ReferenceTrack = CueTrack<ReferenceCue> & {
  label?: string
}

export type ParseCueTracksInputError =
  | InvalidCueInputError
  | ParseCueInputError
  | ReturnType<typeof validateCueTracks<ReferenceCue>> extends Result.Result<
        void,
        infer TError
      >
    ? TError
    : never

export type ParseCueTracksJsonError = InputParseError | ParseCueTracksInputError
export type ReadCueTracksFileError = InputReadError | ParseCueTracksJsonError

export type ParseAlignmentDocumentInputError =
  | InvalidAlignmentInputError
  | UnsupportedAlignmentVersionError
  | ParseAlignmentInputError
  | ValidateMultiTrackAlignmentError

export type ParseAlignmentDocumentJsonError =
  | InputParseError
  | ParseAlignmentDocumentInputError
export type ReadAlignmentDocumentFileError =
  | InputReadError
  | ParseAlignmentDocumentJsonError

const isJsonObject = (value: JsonValue): value is JsonObject =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const parseJson = (
  text: string,
  source: 'cue' | 'alignment',
): Result.Result<JsonValue, InputParseError> =>
  Result.try({
    try: (): JsonValue => JSON.parse(text) as JsonValue,
    catch: (cause) => new InputParseError({ source, cause }),
  })

const readText = (
  file: TextFile,
  source: 'cue' | 'alignment',
): Result.ResultAsync<string, InputReadError> =>
  Result.try({
    try: () => file.text(),
    catch: (cause) => new InputReadError({ source, cause }),
  })

export const parseCueTracksInput = (
  value: JsonValue,
): Result.Result<ReadonlyArray<ReferenceTrack>, ParseCueTracksInputError> => {
  if (Array.isArray(value)) {
    return Result.pipe(
      parseCueInput(value),
      Result.map((cues) => [{ id: DEFAULT_TRACK_ID, cues }]),
    )
  }

  if (!isJsonObject(value) || value.version !== 2) {
    return Result.fail(
      new InvalidCueInputError({
        path: '$',
        reason: 'Expected a Cue array or a version 2 track document',
      }),
    )
  }

  if (!Array.isArray(value.tracks)) {
    return Result.fail(
      new InvalidCueInputError({
        path: '$.tracks',
        reason: 'Expected an array',
      }),
    )
  }

  const tracks: Array<ReferenceTrack> = []

  for (const [index, rawTrack] of value.tracks.entries()) {
    if (!isJsonObject(rawTrack)) {
      return Result.fail(
        new InvalidCueInputError({
          path: `$.tracks[${index}]`,
          reason: 'Expected an object',
        }),
      )
    }

    const id = rawTrack.id
    if (typeof id !== 'string') {
      return Result.fail(
        new InvalidCueInputError({
          path: `$.tracks[${index}].id`,
          reason: 'Expected a string',
        }),
      )
    }

    const label = rawTrack.label
    if (label !== undefined && typeof label !== 'string') {
      return Result.fail(
        new InvalidCueInputError({
          path: `$.tracks[${index}].label`,
          reason: 'Expected a string when present',
        }),
      )
    }

    if (!Array.isArray(rawTrack.cues)) {
      return Result.fail(
        new InvalidCueInputError({
          path: `$.tracks[${index}].cues`,
          reason: 'Expected an array',
        }),
      )
    }

    const cueResult = parseCueInput(rawTrack.cues)
    if (Result.isFailure(cueResult)) {
      return Result.fail(cueResult.error)
    }

    tracks.push({
      id: asTrackId(id),
      cues: cueResult.value,
      ...(label === undefined ? {} : { label }),
    })
  }

  const validation = validateCueTracks(tracks)
  if (Result.isFailure(validation)) {
    return Result.fail(validation.error)
  }

  return Result.succeed(tracks)
}

export const parseCueTracksJson = (
  text: string,
): Result.Result<ReadonlyArray<ReferenceTrack>, ParseCueTracksJsonError> =>
  Result.pipe(
    parseJson(text, 'cue'),
    Result.andThen((value) => parseCueTracksInput(value)),
  )

export const readCueTracksFile = (
  file: TextFile,
): Result.ResultAsync<ReadonlyArray<ReferenceTrack>, ReadCueTracksFileError> =>
  Result.pipe(
    readText(file, 'cue'),
    Result.andThen((text) => parseCueTracksJson(text)),
  )

const parseVersionTwoTrackAlignment = (
  tracks: ReadonlyArray<ReferenceTrack>,
  rawTrack: JsonValue,
  index: number,
): Result.Result<TrackAlignment, ParseAlignmentDocumentInputError> => {
  if (!isJsonObject(rawTrack)) {
    return Result.fail(
      new InvalidAlignmentInputError({
        path: `$.tracks[${index}]`,
        reason: 'Expected an object',
      }),
    )
  }

  const rawTrackId = rawTrack.trackId
  if (typeof rawTrackId !== 'string') {
    return Result.fail(
      new InvalidAlignmentInputError({
        path: `$.tracks[${index}].trackId`,
        reason: 'Expected a string',
      }),
    )
  }

  const trackId = asTrackId(rawTrackId)
  const track = tracks.find((candidate) => candidate.id === trackId)
  if (track === undefined) {
    const candidate: MultiTrackAlignment = {
      version: 2,
      tracks: [{ trackId, marks: [] }],
    }
    const validation = validateMultiTrackAlignment(tracks, candidate)
    if (Result.isFailure(validation)) {
      return Result.fail(validation.error)
    }
  }

  const nestedAlignment: JsonObject = {
    version: 1,
    marks: rawTrack.marks,
    ...(rawTrack.ranges === undefined ? {} : { ranges: rawTrack.ranges }),
  }
  const parsed = parseAlignmentInput(track!.cues, nestedAlignment)
  if (Result.isFailure(parsed)) {
    return Result.fail(parsed.error)
  }

  return Result.succeed(alignmentToTrackAlignment(trackId, parsed.value))
}

export const parseAlignmentDocumentInput = (
  tracks: ReadonlyArray<ReferenceTrack>,
  value: JsonValue,
): Result.Result<MultiTrackAlignment, ParseAlignmentDocumentInputError> => {
  if (!isJsonObject(value)) {
    return Result.fail(
      new InvalidAlignmentInputError({
        path: '$',
        reason: 'Expected an object',
      }),
    )
  }

  if (value.version === 1) {
    const track = tracks[0]
    if (tracks.length !== 1 || track === undefined) {
      return Result.fail(
        new InvalidAlignmentInputError({
          path: '$.version',
          reason: 'Version 1 Alignment requires exactly one Cue track',
        }),
      )
    }

    const parsed = parseAlignmentInput(track.cues, value)
    if (Result.isFailure(parsed)) {
      return Result.fail(parsed.error)
    }

    return Result.succeed({
      version: 2,
      tracks: [alignmentToTrackAlignment(track.id, parsed.value)],
    })
  }

  if (value.version !== 2) {
    return Result.fail(
      new UnsupportedAlignmentVersionError({ version: value.version }),
    )
  }

  if (!Array.isArray(value.tracks)) {
    return Result.fail(
      new InvalidAlignmentInputError({
        path: '$.tracks',
        reason: 'Expected an array',
      }),
    )
  }

  const parsedTracks: Array<TrackAlignment> = []
  for (const [index, rawTrack] of value.tracks.entries()) {
    const parsed = parseVersionTwoTrackAlignment(tracks, rawTrack, index)
    if (Result.isFailure(parsed)) {
      return Result.fail(parsed.error)
    }
    parsedTracks.push(parsed.value)
  }

  const alignment: MultiTrackAlignment = { version: 2, tracks: parsedTracks }
  const validation = validateMultiTrackAlignment(tracks, alignment)
  if (Result.isFailure(validation)) {
    return Result.fail(validation.error)
  }

  return Result.succeed(alignment)
}

export const parseAlignmentDocumentJson = (
  tracks: ReadonlyArray<ReferenceTrack>,
  text: string,
): Result.Result<MultiTrackAlignment, ParseAlignmentDocumentJsonError> =>
  Result.pipe(
    parseJson(text, 'alignment'),
    Result.andThen((value) => parseAlignmentDocumentInput(tracks, value)),
  )

export const readAlignmentDocumentFile = (
  tracks: ReadonlyArray<ReferenceTrack>,
  file: TextFile,
): Result.ResultAsync<MultiTrackAlignment, ReadAlignmentDocumentFileError> =>
  Result.pipe(
    readText(file, 'alignment'),
    Result.andThen((text) => parseAlignmentDocumentJson(tracks, text)),
  )

export const getTrackById = (
  tracks: ReadonlyArray<ReferenceTrack>,
  trackId: TrackId,
): ReferenceTrack | undefined =>
  tracks.find((track) => track.id === trackId)
