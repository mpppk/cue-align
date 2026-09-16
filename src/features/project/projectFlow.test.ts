import { beforeEach, describe, expect, it } from 'vite-plus/test'
import 'fake-indexeddb/auto'

import { Result } from '@praha/byethrow'
import { asCueId, asTimelinePosition, asTrackId } from '@mpppk/cue-align-core'
import { ProjectQuotaError, ProjectWriteError } from './errors'
import { isQuotaError, toWriteError } from './indexedDb'
import {
  createProject,
  listProjects,
  loadProject,
  saveProjectSession,
} from './repository'

const unwrap = <T, E>(result: Result.Result<T, E>): T => {
  if (Result.isFailure(result)) {
    throw new Error('expected success but got failure')
  }

  return result.value
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

const audioTracks = [
  {
    id: asTrackId('lyrics'),
    cues: [{ id: asCueId('a'), label: 'Alpha' }, { id: asCueId('b') }],
  },
]

const videoTracks = [
  {
    id: asTrackId('scenes'),
    cues: [{ id: asCueId('s1') }, { id: asCueId('s2') }],
  },
]

describe('project authoring flow', () => {
  it('creates, opens, edits, and reopens an Audio project without reselecting media', async () => {
    const mediaFile = new File(['audio-bytes'], 'song.mp3', {
      type: 'audio/mpeg',
      lastModified: 7,
    })
    const created = await createProject({
      name: 'Audio project',
      tracks: audioTracks,
      mediaFile,
      currentTrackId: asTrackId('lyrics'),
    })
    expect(created).toBeSuccess()
    const projectId = unwrap(created).id

    // Open.
    const opened = await loadProject(projectId)
    expect(opened).toBeSuccess()
    expect(unwrap(opened).mediaFile.name).toBe('song.mp3')

    // Edit: mark both cues (complete Alignment).
    expect(
      await saveProjectSession(projectId, {
        alignment: {
          version: 2,
          tracks: [
            {
              trackId: asTrackId('lyrics'),
              marks: [
                { cueId: asCueId('a'), at: asTimelinePosition(1) },
                { cueId: asCueId('b'), at: asTimelinePosition(2) },
              ],
            },
          ],
        },
        currentTrackId: asTrackId('lyrics'),
        currentCueId: asCueId('b'),
      }),
    ).toBeSuccess()

    // Reload / browser restart: fresh open without the original File.
    expect(await loadProject(projectId)).toBeSuccess(async (reloaded) => {
      expect(reloaded.alignment.tracks[0]?.marks).toHaveLength(2)
      expect(reloaded.currentCueId).toBe('b')
      expect(await reloaded.mediaFile.text()).toBe('audio-bytes')
    })

    expect(await listProjects()).toBeSuccess((summaries) => {
      expect(summaries).toHaveLength(1)
      expect(summaries[0]?.mediaName).toBe('song.mp3')
    })
  })

  it('keeps Video authoring working alongside Audio projects', async () => {
    const audio = await createProject(
      {
        name: 'Audio',
        tracks: audioTracks,
        mediaFile: new File(['a'], 'a.mp3', { type: 'audio/mpeg' }),
        currentTrackId: asTrackId('lyrics'),
      },
      { now: 1000 },
    )
    expect(audio).toBeSuccess()

    const video = await createProject(
      {
        name: 'Video',
        tracks: videoTracks,
        mediaFile: new File(['v'], 'clip.mp4', { type: 'video/mp4' }),
        currentTrackId: asTrackId('scenes'),
      },
      { now: 2000 },
    )
    expect(video).toBeSuccess()

    expect(await listProjects()).toBeSuccess((summaries) => {
      expect(summaries.map((summary) => summary.name)).toEqual([
        'Video',
        'Audio',
      ])
    })

    expect(await loadProject(unwrap(video).id)).toBeSuccess(async (loaded) => {
      expect(loaded.mediaFile.type).toBe('video/mp4')
      expect(await loaded.mediaFile.text()).toBe('v')
    })
  })

  it('maps quota exhaustion to a typed error without throwing', () => {
    expect(isQuotaError({ name: 'QuotaExceededError' })).toBe(true)
    expect(isQuotaError({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true)
    expect(isQuotaError(new Error('other'))).toBe(false)

    const quota = toWriteError({ name: 'QuotaExceededError' })
    expect(quota).toBeInstanceOf(ProjectQuotaError)

    const other = toWriteError(new Error('disk'))
    expect(other).toBeInstanceOf(ProjectWriteError)
  })
})
