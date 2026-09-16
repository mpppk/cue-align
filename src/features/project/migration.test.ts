import { beforeEach, describe, expect, it } from 'vite-plus/test'
import 'fake-indexeddb/auto'

import { Result } from '@praha/byethrow'
import { asCueId, asTimelinePosition, asTrackId } from '@mpppk/cue-align-core'
import {
  AUTOSAVE_STORAGE_KEY,
  loadAutosave,
  saveAutosave,
} from '../alignment/autosave'
import type { AutosaveStorage } from '../alignment/autosave'
import { loadProject } from './repository'
import { migrateLegacyAutosaveToProject } from './migration'

const unwrap = <T, E>(result: Result.Result<T, E>): T => {
  if (Result.isFailure(result)) {
    throw new Error('expected success but got failure')
  }

  return result.value
}

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

const deleteDatabase = async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase('cue-align')
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve(undefined)
  })
}

beforeEach(async () => {
  await deleteDatabase()
})

describe('legacy autosave migration', () => {
  it('migrates recovery state into a Project and discards legacy only on success', async () => {
    const storage = createStorage()
    const snapshot = {
      authoring: {
        tracks: [
          {
            id: asTrackId('lyrics'),
            cues: [
              { id: asCueId('a'), label: 'Alpha' },
              { id: asCueId('b'), label: 'Beta' },
            ],
          },
        ],
        alignment: {
          version: 2 as const,
          tracks: [
            {
              trackId: asTrackId('lyrics'),
              marks: [{ cueId: asCueId('a'), at: asTimelinePosition(1) }],
            },
          ],
        },
      },
      media: {
        name: 'song.mp3',
        type: 'audio/mpeg',
        size: 11,
        lastModified: 42,
      },
      currentTrackId: asTrackId('lyrics'),
      currentCueId: asCueId('b'),
    }
    expect(saveAutosave(storage, snapshot, 1000)).toBeSuccess()
    const legacy = loadAutosave(storage, 2000)
    expect(legacy).toBeSuccess()
    const legacySession = unwrap(legacy)
    if (legacySession === undefined) {
      throw new Error('expected legacy autosave')
    }

    const mediaFile = new File(['audio-bytes'], 'song.mp3', {
      type: 'audio/mpeg',
      lastModified: 42,
    })
    // Align size with the stored identity for the test.
    Object.defineProperty(mediaFile, 'size', { value: 11 })

    const migrated = await migrateLegacyAutosaveToProject(
      storage,
      legacySession,
      mediaFile,
      'Migrated project',
    )
    expect(migrated).toBeSuccess(async (loaded) => {
      expect(loaded.project.name).toBe('Migrated project')
      expect(loaded.currentCueId).toBe('b')
      expect(await loaded.mediaFile.text()).toBe('audio-bytes')
      expect(storage.values.get(AUTOSAVE_STORAGE_KEY)).toBeUndefined()
    })

    // Reload after a simulated restart.
    expect(await loadProject(unwrap(migrated).project.id)).toBeSuccess(
      (reloaded) => {
        expect(reloaded.alignment.tracks[0]?.marks[0]?.cueId).toBe('a')
      },
    )
  })

  it('keeps the legacy autosave when Project creation fails', async () => {
    const storage = createStorage()
    const snapshot = {
      authoring: {
        tracks: [
          {
            id: asTrackId('lyrics'),
            cues: [{ id: asCueId('a') }],
          },
        ],
        alignment: {
          version: 2 as const,
          tracks: [
            {
              trackId: asTrackId('lyrics'),
              marks: [{ cueId: asCueId('a'), at: asTimelinePosition(1) }],
            },
          ],
        },
      },
      media: {
        name: 'song.mp3',
        type: 'audio/mpeg',
        size: 11,
        lastModified: 42,
      },
      currentTrackId: asTrackId('lyrics'),
    }
    expect(saveAutosave(storage, snapshot, 1000)).toBeSuccess()
    const legacy = loadAutosave(storage, 2000)
    expect(legacy).toBeSuccess()
    const legacySession = unwrap(legacy)
    if (legacySession === undefined) {
      throw new Error('expected legacy autosave')
    }

    const mediaFile = new File(['audio-bytes'], 'song.mp3', {
      type: 'audio/mpeg',
      lastModified: 42,
    })
    Object.defineProperty(mediaFile, 'size', { value: 11 })

    // Empty name falls back to a default, so force failure via media mismatch.
    const mismatched = new File(['other'], 'other.mp3', {
      type: 'audio/mpeg',
      lastModified: 99,
    })
    const failed = await migrateLegacyAutosaveToProject(
      storage,
      legacySession,
      mismatched,
      'Will fail',
    )
    expect(failed).toBeFailure()
    expect(storage.values.get(AUTOSAVE_STORAGE_KEY)).not.toBeUndefined()
  })
})
