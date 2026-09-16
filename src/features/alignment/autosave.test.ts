import { describe, expect, it, vi } from 'vite-plus/test'

import {
  asCueId,
  asTimelinePosition,
  asTrackId,
} from '@mpppk/cue-align-core'
import {
  AUTOSAVE_MAX_AGE_MS,
  AUTOSAVE_STORAGE_KEY,
  AutosaveQuotaError,
  MalformedAutosaveError,
  StaleAutosaveError,
  UnsupportedAutosaveVersionError,
  createAutosaveScheduler,
  loadAutosave,
  saveAutosave,
  validateRecoveryMedia,
} from './autosave'
import type { AutosaveSnapshot, AutosaveStorage } from './autosave'

const createStorage = (): AutosaveStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>()
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value)
    },
    removeItem: (key) => {
      values.delete(key)
    },
  }
}

const snapshot: AutosaveSnapshot = {
  authoring: {
    tracks: [
      {
        id: asTrackId('lyrics'),
        label: 'Lyrics',
        cues: [
          { id: asCueId('a'), label: 'Alpha' },
          { id: asCueId('b'), label: 'Beta' },
        ],
      },
    ],
    alignment: {
      version: 2,
      tracks: [
        {
          trackId: asTrackId('lyrics'),
          marks: [
            { cueId: asCueId('a'), at: asTimelinePosition(1) },
          ],
        },
      ],
    },
  },
  media: {
    name: 'song.mp3',
    type: 'audio/mpeg',
    size: 1234,
    lastModified: 42,
  },
  currentTrackId: asTrackId('lyrics'),
  currentCueId: asCueId('b'),
}

describe('autosave persistence', () => {
  it('round-trips recovery state including current Cue', () => {
    const storage = createStorage()
    expect(saveAutosave(storage, snapshot, 1000)).toBeSuccess()

    expect(loadAutosave(storage, 2000)).toBeSuccess((recovered) => {
      expect(recovered?.savedAt).toBe(1000)
      expect(recovered?.media.name).toBe('song.mp3')
      expect(recovered?.currentTrackId).toBe('lyrics')
      expect(recovered?.currentCueId).toBe('b')
      expect(recovered?.authoring.alignment.tracks[0]?.marks[0]?.cueId).toBe(
        'a',
      )
    })
  })

  it('returns typed failures for malformed, unsupported, and stale data', () => {
    const storage = createStorage()
    storage.values.set(AUTOSAVE_STORAGE_KEY, '{')
    expect(loadAutosave(storage, 0)).toBeFailure((error) => {
      expect(error).toBeInstanceOf(MalformedAutosaveError)
    })

    storage.values.set(
      AUTOSAVE_STORAGE_KEY,
      JSON.stringify({ version: 999, savedAt: 0 }),
    )
    expect(loadAutosave(storage, 0)).toBeFailure((error) => {
      expect(error).toBeInstanceOf(UnsupportedAutosaveVersionError)
    })

    expect(saveAutosave(storage, snapshot, 0)).toBeSuccess()
    expect(loadAutosave(storage, AUTOSAVE_MAX_AGE_MS + 1)).toBeFailure(
      (error) => {
        expect(error).toBeInstanceOf(StaleAutosaveError)
      },
    )
  })

  it('reports quota failures distinctly', () => {
    const storage: AutosaveStorage = {
      getItem: () => null,
      setItem: () => {
        throw { name: 'QuotaExceededError' }
      },
      removeItem: () => undefined,
    }

    expect(saveAutosave(storage, snapshot)).toBeFailure((error) => {
      expect(error).toBeInstanceOf(AutosaveQuotaError)
    })
  })

  it('rejects a different media file during recovery', () => {
    expect(
      validateRecoveryMedia(
        {
          name: 'other.mp3',
          type: snapshot.media.type,
          size: snapshot.media.size,
          lastModified: snapshot.media.lastModified,
        },
        snapshot.media,
      ),
    ).toBeFailure((error) => {
      expect(error).toBeInstanceOf(StaleAutosaveError)
    })
  })
})

describe('createAutosaveScheduler', () => {
  it('debounces writes and flushes the latest value', () => {
    vi.useFakeTimers()
    const saved: Array<number> = []
    const scheduler = createAutosaveScheduler((value: number) => {
      saved.push(value)
    }, 100)

    scheduler.schedule(1)
    scheduler.schedule(2)
    vi.advanceTimersByTime(99)
    expect(saved).toEqual([])
    vi.advanceTimersByTime(1)
    expect(saved).toEqual([2])

    scheduler.schedule(3)
    scheduler.flush()
    expect(saved).toEqual([2, 3])

    scheduler.schedule(4)
    scheduler.cancel()
    vi.runAllTimers()
    expect(saved).toEqual([2, 3])
    vi.useRealTimers()
  })
})
