import { describe, expect, it } from 'vite-plus/test'

import { getMediaKind } from './MediaPlayer'

describe('getMediaKind', () => {
  it('detects video from MIME type', () => {
    expect(getMediaKind({ name: 'clip.bin', type: 'video/mp4' })).toBe('video')
  })

  it('detects video from extension when MIME type is empty', () => {
    expect(getMediaKind({ name: 'clip.webm', type: '' })).toBe('video')
  })

  it('defaults to audio for audio and unknown files', () => {
    expect(getMediaKind({ name: 'track.mp3', type: 'audio/mpeg' })).toBe('audio')
    expect(getMediaKind({ name: 'track.bin', type: '' })).toBe('audio')
  })
})
