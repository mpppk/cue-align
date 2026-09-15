import { describe, expect, it } from 'vite-plus/test'

import { asCueId } from '@mpppk/cue-align-core'
import { getCueMetadataEntries } from './CueViewer'

describe('getCueMetadataEntries', () => {
  it('excludes identity fields and preserves additional Cue metadata', () => {
    expect(
      getCueMetadataEntries({
        id: asCueId('cue-1'),
        label: 'First cue',
        speaker: 'Alice',
        order: 1,
        tags: ['intro', 'verse'],
      }),
    ).toEqual([
      ['speaker', 'Alice'],
      ['order', '1'],
      ['tags', '["intro","verse"]'],
    ])
  })

  it('returns no metadata for a missing Cue', () => {
    expect(getCueMetadataEntries(undefined)).toEqual([])
  })
})
