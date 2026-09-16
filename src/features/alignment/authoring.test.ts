import { describe, expect, expectTypeOf, it } from 'vite-plus/test'

import type { Result } from '@praha/byethrow'
import { asCueId, asTimelinePosition, asTrackId } from '@mpppk/cue-align-core'
import type { MultiTrackAlignment } from '@mpppk/cue-align-core'
import { readAuthoringInput } from './authoring'
import type { AuthoringInput, ReadAuthoringInputError } from './authoring'
import { InputReadError } from './errors'
import type { TextFile } from './input'

const textFile = (text: string): TextFile => ({
  text: () => Promise.resolve(text),
})

describe('readAuthoringInput', () => {
  it('exposes a precise async Result type', () => {
    expectTypeOf(readAuthoringInput(textFile('[]'))).toEqualTypeOf<
      Result.ResultAsync<AuthoringInput, ReadAuthoringInputError>
    >()
  })

  it('normalizes a legacy Cue array into one default track', async () => {
    const result = await readAuthoringInput(
      textFile('[{"id":"a","label":"Alpha"}]'),
    )

    expect(result).toBeSuccess((input) => {
      expect(input).toEqual({
        tracks: [
          {
            id: 'default',
            cues: [{ id: 'a', label: 'Alpha' }],
          },
        ],
      })
    })
  })

  it('normalizes a legacy v1 Alignment for a single track', async () => {
    const result = await readAuthoringInput(
      textFile('[{"id":"a"}]'),
      textFile('{"version":1,"marks":[{"cueId":"a","at":1.5}]}'),
    )

    expect(result).toBeSuccess((input) => {
      const expected: MultiTrackAlignment = {
        version: 2,
        tracks: [
          {
            trackId: asTrackId('default'),
            marks: [{ cueId: asCueId('a'), at: asTimelinePosition(1.5) }],
          },
        ],
      }
      expect(input.alignment).toEqual(expected)
    })
  })

  it('reads independent version 2 Cue tracks and Alignments', async () => {
    const result = await readAuthoringInput(
      textFile(
        JSON.stringify({
          version: 2,
          tracks: [
            { id: 'lyrics', label: 'Lyrics', cues: [{ id: 'a' }] },
            { id: 'scenes', label: 'Scenes', cues: [{ id: 'a' }] },
          ],
        }),
      ),
      textFile(
        JSON.stringify({
          version: 2,
          tracks: [
            { trackId: 'lyrics', marks: [{ cueId: 'a', at: 1 }] },
            { trackId: 'scenes', marks: [{ cueId: 'a', at: 2 }] },
          ],
        }),
      ),
    )

    expect(result).toBeSuccess((input) => {
      expect(input.tracks).toHaveLength(2)
      expect(input.tracks[0]?.cues[0]?.id).toBe('a')
      expect(input.tracks[1]?.cues[0]?.id).toBe('a')
      expect(input.alignment?.tracks[0]?.marks[0]?.at).toBe(1)
      expect(input.alignment?.tracks[1]?.marks[0]?.at).toBe(2)
    })
  })

  it('returns Cue read failures without attempting later input', async () => {
    const cause = new Error('cue read failed')
    const cueFile: TextFile = {
      text: () => Promise.reject(cause),
    }
    let alignmentRead = false
    const alignmentFile: TextFile = {
      text: () => {
        alignmentRead = true
        return Promise.resolve('{"version":1,"marks":[]}')
      },
    }

    const result = await readAuthoringInput(cueFile, alignmentFile)

    expect(result).toBeFailure((error) => {
      expect(error).toBeInstanceOf(InputReadError)
      if (error instanceof InputReadError) {
        expect(error.source).toBe('cue')
        expect(error.cause).toBe(cause)
      }
    })
    expect(alignmentRead).toBe(false)
  })
})
