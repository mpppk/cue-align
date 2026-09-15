import { describe, expect, it } from 'vite-plus/test'

import { asCueId, asTimelinePosition } from '#/core'
import { parseAlignmentJson } from './input'
import { serializeAlignment } from './export'

const cues = [
  { id: asCueId('a'), label: 'Alpha' },
  { id: asCueId('b'), label: 'Beta' },
]

describe('alignment export', () => {
  it('serializes partial alignment deterministically', () => {
    expect(
      serializeAlignment({
        version: 1,
        marks: [{ cueId: asCueId('a'), at: asTimelinePosition(1.25) }],
      }),
    ).toBe(
      '{\n  "version": 1,\n  "marks": [\n    {\n      "cueId": "a",\n      "at": 1.25\n    }\n  ]\n}\n',
    )
  })

  it('round-trips exported alignment through the import pipeline', () => {
    const alignment = {
      version: 1 as const,
      marks: [
        { cueId: asCueId('a'), at: asTimelinePosition(1.25) },
        { cueId: asCueId('b'), at: asTimelinePosition(2.5) },
      ],
    }

    const result = parseAlignmentJson(cues, serializeAlignment(alignment))

    expect(result).toBeSuccess((value) => expect(value).toEqual(alignment))
  })
})
