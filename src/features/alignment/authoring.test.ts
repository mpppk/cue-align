import { describe, expect, expectTypeOf, it } from 'vite-plus/test'

import type { Result } from '@praha/byethrow'
import { asCueId, asTimelinePosition } from '#/core'
import type { Alignment } from '#/core'
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

  it('reads cues without requiring an Alignment file', async () => {
    const result = await readAuthoringInput(
      textFile('[{"id":"a","label":"Alpha"}]'),
    )

    expect(result).toBeSuccess((input) => {
      expect(input).toEqual({
        cues: [{ id: 'a', label: 'Alpha' }],
      })
    })
  })

  it('reads an optional Alignment after the Cue sequence', async () => {
    const result = await readAuthoringInput(
      textFile('[{"id":"a"}]'),
      textFile('{"version":1,"marks":[{"cueId":"a","at":1.5}]}'),
    )

    expect(result).toBeSuccess((input) => {
      const expected: Alignment = {
        version: 1,
        marks: [
          { cueId: asCueId('a'), at: asTimelinePosition(1.5) },
        ],
      }
      expect(input.alignment).toEqual(expected)
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
