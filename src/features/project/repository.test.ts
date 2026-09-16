import { beforeEach, describe, expect, it } from 'vite-plus/test'
import 'fake-indexeddb/auto'

import { Result } from '@praha/byethrow'
import { asCueId, asTimelinePosition, asTrackId } from '@mpppk/cue-align-core'
import {
  MalformedProjectError,
  ProjectNotFoundError,
  ProjectStoreUnsupportedError,
  UnsupportedProjectVersionError,
} from './errors'
import {
  PROJECT_DB_NAME,
  PROJECT_DOCUMENTS_STORE,
  PROJECT_MEDIA_STORE,
  PROJECTS_STORE,
  asProjectId,
} from './project'
import {
  createProject,
  deleteProject,
  listProjects,
  loadProject,
  renameProject,
  saveProjectSession,
} from './repository'

const mediaFile = (
  name = 'song.mp3',
  type = 'audio/mpeg',
  content = 'audio-bytes',
): File => new File([content], name, { type, lastModified: 42 })

const tracks = [
  {
    id: asTrackId('lyrics'),
    label: 'Lyrics',
    cues: [
      { id: asCueId('a'), label: 'Alpha' },
      { id: asCueId('b'), label: 'Beta' },
    ],
  },
] as const

const toInputTracks = () =>
  tracks.map((track) => ({
    id: track.id,
    label: track.label,
    cues: track.cues.map((cue) => ({ ...cue })),
  }))

const alignment = {
  version: 2 as const,
  tracks: [
    {
      trackId: asTrackId('lyrics'),
      marks: [{ cueId: asCueId('a'), at: asTimelinePosition(1.5) }],
    },
  ],
}

const deleteDatabase = async (): Promise<void> => {
  await new Promise<void>((resolve, reject) => {
    const request = indexedDB.deleteDatabase(PROJECT_DB_NAME)
    request.onsuccess = () => resolve(undefined)
    request.onerror = () => reject(request.error)
    request.onblocked = () => resolve(undefined)
  })
}

const unwrap = <T, E>(result: Result.Result<T, E>): T => {
  if (Result.isFailure(result)) {
    throw new Error('expected success but got failure')
  }

  return result.value
}

beforeEach(async () => {
  await deleteDatabase()
})

describe('project repository', () => {
  it('round-trips Blob media and session state', async () => {
    const created = await createProject({
      name: 'First',
      tracks: toInputTracks(),
      alignment,
      mediaFile: mediaFile(),
      currentTrackId: asTrackId('lyrics'),
      currentCueId: asCueId('b'),
    })
    expect(created).toBeSuccess()

    const projectId = unwrap(created).id
    const loaded = await loadProject(projectId)
    expect(loaded).toBeSuccess((value) => {
      expect(value.project.name).toBe('First')
      expect(value.mediaFile.name).toBe('song.mp3')
      expect(value.mediaFile.type).toBe('audio/mpeg')
      expect(value.currentTrackId).toBe('lyrics')
      expect(value.currentCueId).toBe('b')
      expect(value.alignment.tracks[0]?.marks[0]?.cueId).toBe('a')
    })

    const loadedValue = unwrap(loaded)
    expect(await loadedValue.mediaFile.text()).toBe('audio-bytes')
  })

  it('lists projects in updatedAt descending order', async () => {
    const first = await createProject(
      {
        name: 'First',
        tracks: toInputTracks(),
        mediaFile: mediaFile('a.mp3', 'audio/mpeg', 'a'),
        currentTrackId: asTrackId('lyrics'),
      },
      { now: 1000 },
    )
    expect(first).toBeSuccess()
    const second = await createProject(
      {
        name: 'Second',
        tracks: toInputTracks(),
        mediaFile: mediaFile('b.mp4', 'video/mp4', 'b'),
        currentTrackId: asTrackId('lyrics'),
      },
      { now: 2000 },
    )
    expect(second).toBeSuccess()

    expect(await listProjects()).toBeSuccess((summaries) => {
      expect(summaries.map((summary) => summary.name)).toEqual([
        'Second',
        'First',
      ])
      expect(summaries[0]?.mediaName).toBe('b.mp4')
      expect(summaries[1]?.mediaName).toBe('a.mp3')
    })
  })

  it('updates documents without rewriting media Blob', async () => {
    const created = await createProject({
      name: 'Session',
      tracks: toInputTracks(),
      alignment,
      mediaFile: mediaFile('song.mp3', 'audio/mpeg', 'original'),
      currentTrackId: asTrackId('lyrics'),
    })
    expect(created).toBeSuccess()
    const projectId = unwrap(created).id

    const nextAlignment = {
      version: 2 as const,
      tracks: [
        {
          trackId: asTrackId('lyrics'),
          marks: [
            { cueId: asCueId('a'), at: asTimelinePosition(1.5) },
            { cueId: asCueId('b'), at: asTimelinePosition(2.5) },
          ],
        },
      ],
    }
    expect(
      await saveProjectSession(
        projectId,
        {
          alignment: nextAlignment,
          currentTrackId: asTrackId('lyrics'),
          currentCueId: asCueId('b'),
        },
        { now: 5000 },
      ),
    ).toBeSuccess()

    expect(await loadProject(projectId)).toBeSuccess(async (value) => {
      expect(value.alignment.tracks[0]?.marks).toHaveLength(2)
      expect(value.currentCueId).toBe('b')
      expect(value.project.updatedAt).toBe(5000)
      expect(await value.mediaFile.text()).toBe('original')
    })

    expect(await listProjects()).toBeSuccess((summaries) => {
      expect(summaries[0]?.updatedAt).toBe(5000)
    })
  })

  it('renames and deletes without leaving orphan records', async () => {
    const created = await createProject({
      name: 'Old',
      tracks: toInputTracks(),
      mediaFile: mediaFile(),
      currentTrackId: asTrackId('lyrics'),
    })
    expect(created).toBeSuccess()
    const projectId = unwrap(created).id

    expect(await renameProject(projectId, 'New')).toBeSuccess((summary) => {
      expect(summary.name).toBe('New')
    })
    expect(await loadProject(projectId)).toBeSuccess((value) => {
      expect(value.project.name).toBe('New')
    })

    expect(await deleteProject(projectId)).toBeSuccess()
    expect(await loadProject(projectId)).toBeFailure((error) => {
      expect(error).toBeInstanceOf(ProjectNotFoundError)
    })

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(PROJECT_DB_NAME, 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      const transaction = database.transaction(
        [PROJECTS_STORE, PROJECT_DOCUMENTS_STORE, PROJECT_MEDIA_STORE],
        'readonly',
      )
      const get = <T>(store: string, key: string): Promise<T | undefined> =>
        new Promise<T | undefined>((resolve, reject) => {
          const request = transaction.objectStore(store).get(key)
          request.onsuccess = () => resolve(request.result as T | undefined)
          request.onerror = () => reject(request.error)
        })
      expect(await get(PROJECTS_STORE, projectId)).toBeUndefined()
      expect(await get(PROJECT_DOCUMENTS_STORE, projectId)).toBeUndefined()
      expect(await get(PROJECT_MEDIA_STORE, projectId)).toBeUndefined()
    } finally {
      database.close()
    }
  })

  it('round-trips partial/complete Alignments, explicit ranges, and multiple tracks', async () => {
    const multiTracks = [
      {
        id: asTrackId('lyrics'),
        cues: [{ id: asCueId('a') }, { id: asCueId('b') }],
      },
      {
        id: asTrackId('scenes'),
        cues: [{ id: asCueId('a') }],
      },
    ]
    const multiAlignment = {
      version: 2 as const,
      tracks: [
        {
          trackId: asTrackId('lyrics'),
          marks: [{ cueId: asCueId('a'), at: asTimelinePosition(1) }],
          ranges: [{ cueId: asCueId('a'), end: asTimelinePosition(1.5) }],
        },
        {
          trackId: asTrackId('scenes'),
          marks: [{ cueId: asCueId('a'), at: asTimelinePosition(2) }],
        },
      ],
    }
    const created = await createProject({
      name: 'Multi',
      tracks: multiTracks,
      alignment: multiAlignment,
      mediaFile: mediaFile('scene.mp4', 'video/mp4', 'video-bytes'),
      currentTrackId: asTrackId('scenes'),
      currentCueId: asCueId('a'),
    })
    expect(created).toBeSuccess()

    // Simulate reload by loading through a fresh open.
    expect(await loadProject(unwrap(created).id)).toBeSuccess(async (value) => {
      expect(value.tracks).toHaveLength(2)
      expect(value.alignment.tracks).toHaveLength(2)
      expect(value.alignment.tracks[0]?.ranges?.[0]?.end).toBe(1.5)
      expect(value.currentTrackId).toBe('scenes')
      expect(await value.mediaFile.text()).toBe('video-bytes')
    })
  })

  it('returns typed errors for missing, malformed, and unsupported records', async () => {
    expect(await loadProject(asProjectId('missing'))).toBeFailure((error) => {
      expect(error).toBeInstanceOf(ProjectNotFoundError)
    })

    const created = await createProject({
      name: 'Corrupt me',
      tracks: toInputTracks(),
      mediaFile: mediaFile(),
      currentTrackId: asTrackId('lyrics'),
    })
    expect(created).toBeSuccess()
    const projectId = unwrap(created).id

    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(PROJECT_DB_NAME, 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = database.transaction(
          PROJECT_DOCUMENTS_STORE,
          'readwrite',
        )
        transaction.objectStore(PROJECT_DOCUMENTS_STORE).put({
          projectId,
          cueInput: { version: 2, tracks: [] },
          alignment: { version: 2, tracks: [] },
          currentTrackId: 'gone',
        })
        transaction.oncomplete = () => resolve(undefined)
        transaction.onerror = () => reject(transaction.error)
      })
    } finally {
      database.close()
    }

    expect(await loadProject(projectId)).toBeFailure((error) => {
      expect(error).toBeInstanceOf(MalformedProjectError)
    })

    const unsupported = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(PROJECT_DB_NAME, 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    try {
      await new Promise<void>((resolve, reject) => {
        const transaction = unsupported.transaction(PROJECTS_STORE, 'readwrite')
        transaction.objectStore(PROJECTS_STORE).put({
          id: projectId,
          version: 999,
          name: 'Bad',
          createdAt: 0,
          updatedAt: 0,
        })
        transaction.oncomplete = () => resolve(undefined)
        transaction.onerror = () => reject(transaction.error)
      })
    } finally {
      unsupported.close()
    }
    expect(await loadProject(projectId)).toBeFailure((error) => {
      expect(error).toBeInstanceOf(UnsupportedProjectVersionError)
    })
  })

  it('reports unsupported IndexedDB environments without throwing', async () => {
    const result = await listProjects({
      factory: undefined,
    })
    // In the test environment IndexedDB exists via fake-indexeddb, so this
    // path is only a type-level guard. Directly exercise the resolver with a
    // missing global by passing an explicit check.
    expect(Result.isSuccess(result) || Result.isFailure(result)).toBe(true)

    const original = globalThis.indexedDB
    // @ts-expect-error - simulate an environment without IndexedDB.
    globalThis.indexedDB = undefined
    try {
      expect(await listProjects()).toBeFailure((error) => {
        expect(error).toBeInstanceOf(ProjectStoreUnsupportedError)
      })
    } finally {
      globalThis.indexedDB = original
    }
  })
})
