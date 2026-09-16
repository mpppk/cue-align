import { describe, expect, expectTypeOf, it } from 'vite-plus/test'

import type { Result } from '@praha/byethrow'
import {
  DuplicateCueIdError,
  InvalidRangeError,
  InvalidTimeError,
  UnsupportedAlignmentVersionError,
  UnknownCueIdError,
  asCueId,
} from '@mpppk/cue-align-core'
import type { Alignment } from '@mpppk/cue-align-core'
import {
  InputParseError,
  InputReadError,
  InvalidAlignmentInputError,
  InvalidCueInputError,
} from './errors'
import type {
  ParseAlignmentJsonError,
  ParseCueJsonError,
  ReadAlignmentFileError,
  ReadCueFileError,
} from './errors'
import {
  parseAlignmentJson,
  parseCueJson,
  readAlignmentFile,
  readCueFile,
} from './input'
import type { ReferenceCue, TextFile } from './input'

const cues: ReadonlyArray<ReferenceCue> = [
  { id: asCueId('a'), label: 'Alpha' },
  { id: asCueId('b'), label: 'Beta' },
]

const textFile = (text: string): TextFile => ({
  text: () => Promise.resolve(text),
})

describe('authoring input pipeline', () => {
  it('exposes precise Result types', () => {
    expectTypeOf(parseCueJson('[]')).toEqualTypeOf<
      Result.Result<ReadonlyArray<ReferenceCue>, ParseCueJsonError>
    >()
    expectTypeOf(readCueFile(textFile('[]'))).toEqualTypeOf<
      Result.ResultAsync<ReadonlyArray<ReferenceCue>, ReadCueFileError>
    >()
    expectTypeOf(
      parseAlignmentJson(cues, '{"version":1,"marks":[]}'),
    ).toEqualTypeOf<Result.Result<Alignment, ParseAlignmentJsonError>>()
    expectTypeOf(
      readAlignmentFile(cues, textFile('{"version":1,"marks":[]}')),
    ).toEqualTypeOf<Result.ResultAsync<Alignment, ReadAlignmentFileError>>()
  })

  it('parses cue JSON, brands IDs, and preserves metadata', () => {
    const result = parseCueJson(
      JSON.stringify([
        { id: 'a', label: 'Alpha', speaker: 'Alice' },
        { id: 'b', custom: { nested: true } },
      ]),
    )

    expect(result).toBeSuccess((parsedCues) => {
      expect(parsedCues).toEqual([
        { id: 'a', label: 'Alpha', speaker: 'Alice' },
        { id: 'b', custom: { nested: true } },
      ])
    })
  })

  it('converts invalid cue JSON syntax to InputParseError', () => {
    const result = parseCueJson('[{')

    expect(result).toBeFailure((error) => {
      expect(error).toBeInstanceOf(InputParseError)
      if (error instanceof InputParseError) {
        expect(error.source).toBe('cue')
        expect(error.cause).toBeInstanceOf(SyntaxError)
      }
    })
  })

  it('rejects malformed cue structure before branding', () => {
    const result = parseCueJson('[{"id":42}]')

    expect(result).toBeFailure((error) => {
      expect(error).toBeInstanceOf(InvalidCueInputError)
      if (error instanceof InvalidCueInputError) {
        expect(error.path).toBe('$[0].id')
      }
    })
  })

  it('delegates cue invariants to the core validator', () => {
    const result = parseCueJson('[{"id":"a"},{"id":"a"}]')

    expect(result).toBeFailure((error) => {
      expect(error).toBeInstanceOf(DuplicateCueIdError)
    })
  })

  it('parses and validates Alignment JSON against the cue sequence', () => {
    const result = parseAlignmentJson(
      cues,
      JSON.stringify({
        version: 1,
        marks: [
          { cueId: 'a', at: 1.25 },
          { cueId: 'b', at: 2.5 },
        ],
      }),
    )

    expect(result).toBeSuccess((alignment) => {
      expect(alignment).toEqual({
        version: 1,
        marks: [
          { cueId: 'a', at: 1.25 },
          { cueId: 'b', at: 2.5 },
        ],
      })
    })
  })

  it('parses explicit range ends without changing start Marks', () => {
    const result = parseAlignmentJson(
      cues,
      JSON.stringify({
        version: 1,
        marks: [
          { cueId: 'a', at: 1.25 },
          { cueId: 'b', at: 4 },
        ],
        ranges: [{ cueId: 'a', end: 3.5 }],
      }),
    )

    expect(result).toBeSuccess((alignment) => {
      expect(alignment).toEqual({
        version: 1,
        marks: [
          { cueId: 'a', at: 1.25 },
          { cueId: 'b', at: 4 },
        ],
        ranges: [{ cueId: 'a', end: 3.5 }],
      })
    })
  })

  it('rejects explicit range ends before their start Mark', () => {
    const result = parseAlignmentJson(
      cues,
      JSON.stringify({
        version: 1,
        marks: [{ cueId: 'a', at: 2 }],
        ranges: [{ cueId: 'a', end: 1 }],
      }),
    )

    expect(result).toBeFailure((error) => {
      expect(error).toBeInstanceOf(InvalidRangeError)
    })
  })

  it('rejects unsupported Alignment versions', () => {
    const result = parseAlignmentJson(cues, '{"version":2,"marks":[]}')

    expect(result).toBeFailure((error) => {
      expect(error).toBeInstanceOf(UnsupportedAlignmentVersionError)
    })
  })

  it('rejects malformed Alignment structure', () => {
    const result = parseAlignmentJson(
      cues,
      '{"version":1,"marks":[{"cueId":"a","at":"1"}]}',
    )

    expect(result).toBeFailure((error) => {
      expect(error).toBeInstanceOf(InvalidAlignmentInputError)
      if (error instanceof InvalidAlignmentInputError) {
        expect(error.path).toBe('$.marks[0].at')
      }
    })
  })

  it('delegates Alignment domain invariants to the core validator', () => {
    const unknownCue = parseAlignmentJson(
      cues,
      '{"version":1,"marks":[{"cueId":"x","at":1}]}',
    )
    expect(unknownCue).toBeFailure((error) => {
      expect(error).toBeInstanceOf(UnknownCueIdError)
    })

    const invalidTime = parseAlignmentJson(
      cues,
      '{"version":1,"marks":[{"cueId":"a","at":-1}]}',
    )
    expect(invalidTime).toBeFailure((error) => {
      expect(error).toBeInstanceOf(InvalidTimeError)
    })
  })

  it('preserves file read errors and causes', async () => {
    const cause = new Error('read failed')
    const file: TextFile = {
      text: () => Promise.reject(cause),
    }

    const result = await readCueFile(file)

    expect(result).toBeFailure((error) => {
      expect(error).toBeInstanceOf(InputReadError)
      if (error instanceof InputReadError) {
        expect(error.source).toBe('cue')
        expect(error.cause).toBe(cause)
      }
    })
  })

  it('reads Alignment files through the pipeline', async () => {
    const result = await readAlignmentFile(
      cues,
      textFile('{"version":1,"marks":[{"cueId":"a","at":1}]}'),
    )

    expect(result).toBeSuccess((alignment) => {
      expect(alignment.marks).toEqual([{ cueId: 'a', at: 1 }])
    })
  })
})
