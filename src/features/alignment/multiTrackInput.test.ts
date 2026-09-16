import { describe, expect, it } from 'vite-plus/test'

import { UnknownTrackIdError } from '@mpppk/cue-align-core'
import {
  parseAlignmentDocumentJson,
  parseCueTracksJson,
} from './multiTrackInput'

describe('multi-track input', () => {
  it('accepts the same Cue ID in independent tracks', () => {
    const tracksResult = parseCueTracksJson(
      JSON.stringify({
        version: 2,
        tracks: [
          { id: 'lyrics', cues: [{ id: 'a' }] },
          { id: 'scenes', cues: [{ id: 'a' }] },
        ],
      }),
    )

    expect(tracksResult).toBeSuccess((tracks) => {
      expect(tracks.map((track) => track.id)).toEqual(['lyrics', 'scenes'])
      expect(tracks[0]?.cues[0]?.id).toBe('a')
      expect(tracks[1]?.cues[0]?.id).toBe('a')
    })
  })

  it('normalizes legacy Cue and Alignment JSON into one track', () => {
    const tracksResult = parseCueTracksJson('[{"id":"a"}]')

    expect(tracksResult).toBeSuccess((tracks) => {
      const alignmentResult = parseAlignmentDocumentJson(
        tracks,
        '{"version":1,"marks":[{"cueId":"a","at":1}]}',
      )
      expect(alignmentResult).toBeSuccess((alignment) => {
        expect(alignment).toEqual({
          version: 2,
          tracks: [
            {
              trackId: 'default',
              marks: [{ cueId: 'a', at: 1 }],
            },
          ],
        })
      })
    })
  })

  it('rejects alignment data for an unknown track', () => {
    const tracksResult = parseCueTracksJson(
      '{"version":2,"tracks":[{"id":"lyrics","cues":[{"id":"a"}]}]}',
    )

    expect(tracksResult).toBeSuccess((tracks) => {
      const alignmentResult = parseAlignmentDocumentJson(
        tracks,
        '{"version":2,"tracks":[{"trackId":"missing","marks":[]}]}',
      )
      expect(alignmentResult).toBeFailure((error) => {
        expect(error).toBeInstanceOf(UnknownTrackIdError)
      })
    })
  })
})
