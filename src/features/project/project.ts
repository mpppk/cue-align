import type { CueId, MultiTrackAlignment, TrackId } from '@mpppk/cue-align-core'
import type { ReferenceTrack } from '../alignment/multiTrackInput'
import type { JsonValue } from '../alignment/input'

declare const projectIdBrand: unique symbol

export type ProjectId = string & { readonly [projectIdBrand]: 'ProjectId' }

export const asProjectId = (value: string): ProjectId => value as ProjectId

export const createProjectId = (): ProjectId => {
  const cryptoObject =
    typeof globalThis.crypto !== 'undefined' ? globalThis.crypto : undefined
  if (
    cryptoObject !== undefined &&
    typeof cryptoObject.randomUUID === 'function'
  ) {
    return asProjectId(cryptoObject.randomUUID())
  }

  return asProjectId(
    `project-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  )
}

export const PROJECT_DB_NAME = 'cue-align'
export const PROJECT_DB_VERSION = 1
export const PROJECT_SCHEMA_VERSION = 1 as const

export const PROJECTS_STORE = 'projects'
export const PROJECT_DOCUMENTS_STORE = 'projectDocuments'
export const PROJECT_MEDIA_STORE = 'projectMedia'

export type ProjectRecord = {
  id: ProjectId
  version: typeof PROJECT_SCHEMA_VERSION
  name: string
  createdAt: number
  updatedAt: number
}

export type ProjectDocumentRecord = {
  projectId: ProjectId
  cueInput: JsonValue
  alignment: JsonValue
  currentTrackId: string
  currentCueId?: string
}

export type ProjectMediaRecord = {
  projectId: ProjectId
  blob: Blob
  name: string
  type: string
  size: number
  lastModified: number
}

export type ProjectMediaIdentity = {
  name: string
  type: string
  size: number
  lastModified: number
}

export type ProjectSummary = {
  id: ProjectId
  name: string
  createdAt: number
  updatedAt: number
  mediaName: string
  mediaType: string
}

export type LoadedProject = {
  project: {
    id: ProjectId
    name: string
    createdAt: number
    updatedAt: number
  }
  tracks: ReadonlyArray<ReferenceTrack>
  alignment: MultiTrackAlignment
  mediaFile: File
  media: ProjectMediaIdentity
  currentTrackId: TrackId
  currentCueId?: CueId
}

export type CreateProjectInput = {
  name: string
  tracks: ReadonlyArray<ReferenceTrack>
  alignment?: MultiTrackAlignment
  mediaFile: File
  currentTrackId: TrackId
  currentCueId?: CueId
}

export type SaveProjectSessionInput = {
  alignment: MultiTrackAlignment
  currentTrackId: TrackId
  currentCueId?: CueId
}

export const toCueInputJson = (
  tracks: ReadonlyArray<ReferenceTrack>,
): JsonValue => ({
  version: 2,
  tracks: tracks.map((track) => ({
    id: track.id,
    ...(track.label === undefined ? {} : { label: track.label }),
    cues: track.cues.map((cue) => ({ ...cue })),
  })),
})

export const toAlignmentJson = (alignment: MultiTrackAlignment): JsonValue =>
  JSON.parse(JSON.stringify(alignment)) as JsonValue

export const getProjectMediaIdentity = (
  file: Pick<File, 'name' | 'type' | 'size' | 'lastModified'>,
): ProjectMediaIdentity => ({
  name: file.name,
  type: file.type,
  size: file.size,
  lastModified: file.lastModified,
})

export const restoreProjectMediaFile = (
  record: Pick<ProjectMediaRecord, 'blob' | 'name' | 'type' | 'lastModified'>,
): File =>
  new File([record.blob], record.name, {
    type: record.type,
    lastModified: record.lastModified,
  })
