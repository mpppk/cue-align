import { Result } from '@praha/byethrow'

import { asCueId, asTrackId } from '@mpppk/cue-align-core'
import {
  parseAlignmentDocumentInput,
  parseCueTracksInput,
} from '../alignment/multiTrackInput'
import {
  InvalidProjectInputError,
  MalformedProjectError,
  ProjectNotFoundError,
  UnsupportedProjectVersionError,
} from './errors'
import type {
  CreateProjectError,
  DeleteProjectError,
  ListProjectsError,
  LoadProjectError,
  ProjectReadError,
  RenameProjectError,
  SaveProjectSessionError,
} from './errors'
import {
  openProjectDatabase,
  requestToPromise,
  resolveIdbFactory,
  toReadError,
  toWriteError,
  transactionToPromise,
} from './indexedDb'
import type { IDBFactoryLike } from './indexedDb'
import {
  PROJECT_DOCUMENTS_STORE,
  PROJECT_MEDIA_STORE,
  PROJECT_SCHEMA_VERSION,
  PROJECTS_STORE,
  createProjectId,
  getProjectMediaIdentity,
  restoreProjectMediaFile,
  toAlignmentJson,
  toCueInputJson,
} from './project'
import type {
  CreateProjectInput,
  LoadedProject,
  ProjectDocumentRecord,
  ProjectId,
  ProjectMediaRecord,
  ProjectRecord,
  ProjectSummary,
  SaveProjectSessionInput,
} from './project'

export type ProjectRepositoryOptions = {
  factory?: IDBFactoryLike
  now?: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const validateProjectRecord = (
  value: unknown,
): Result.Result<
  ProjectRecord,
  MalformedProjectError | UnsupportedProjectVersionError
> => {
  if (!isRecord(value)) {
    return Result.fail(
      new MalformedProjectError({ reason: 'Project record must be an object' }),
    )
  }

  const projectId = typeof value.id === 'string' ? value.id : undefined
  if (projectId === undefined) {
    return Result.fail(
      new MalformedProjectError({ reason: 'Project id must be a string' }),
    )
  }

  if (value.version !== PROJECT_SCHEMA_VERSION) {
    return Result.fail(
      new UnsupportedProjectVersionError({
        projectId,
        version: value.version,
      }),
    )
  }

  if (
    typeof value.name !== 'string' ||
    typeof value.createdAt !== 'number' ||
    !Number.isFinite(value.createdAt) ||
    typeof value.updatedAt !== 'number' ||
    !Number.isFinite(value.updatedAt)
  ) {
    return Result.fail(
      new MalformedProjectError({
        projectId,
        reason: 'Project record has invalid fields',
      }),
    )
  }

  return Result.succeed({
    id: projectId as ProjectId,
    version: PROJECT_SCHEMA_VERSION,
    name: value.name,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  })
}

const validateName = (
  name: string,
): Result.Result<string, InvalidProjectInputError> => {
  const trimmed = name.trim()
  if (trimmed.length === 0) {
    return Result.fail(
      new InvalidProjectInputError({
        reason: 'Project name must not be empty',
      }),
    )
  }

  return Result.succeed(trimmed)
}

const getAll = (
  database: IDBDatabase,
  storeName: string,
): Result.ResultAsync<Array<unknown>, ProjectReadError> =>
  Result.try({
    try: async () => {
      const transaction = database.transaction(storeName, 'readonly')
      const store = transaction.objectStore(storeName)
      const values = await requestToPromise(store.getAll())
      await transactionToPromise(transaction)
      return values as Array<unknown>
    },
    catch: (cause) => toReadError(cause),
  })

const getOne = <T>(
  database: IDBDatabase,
  storeName: string,
  key: string,
  mode: IDBTransactionMode = 'readonly',
): Result.ResultAsync<T | undefined, ProjectReadError> =>
  Result.try({
    try: async () => {
      const transaction = database.transaction(storeName, mode)
      const store = transaction.objectStore(storeName)
      const value = await requestToPromise<T | undefined>(store.get(key))
      await transactionToPromise(transaction)
      return value
    },
    catch: (cause) => toReadError(cause),
  })

const parseDocument = (
  projectId: ProjectId,
  document: ProjectDocumentRecord,
): Result.Result<
  Pick<
    LoadedProject,
    'tracks' | 'alignment' | 'currentTrackId' | 'currentCueId'
  >,
  MalformedProjectError | UnsupportedProjectVersionError
> => {
  const malformed = (
    reason: string,
    cause?: unknown,
  ): Result.Result<never, MalformedProjectError> =>
    Result.fail(new MalformedProjectError({ projectId, reason, cause }))

  const tracksResult = parseCueTracksInput(document.cueInput)
  if (Result.isFailure(tracksResult)) {
    return malformed('Cue input is invalid', tracksResult.error)
  }

  const alignmentResult = parseAlignmentDocumentInput(
    tracksResult.value,
    document.alignment,
  )
  if (Result.isFailure(alignmentResult)) {
    return malformed('Alignment is invalid', alignmentResult.error)
  }

  if (typeof document.currentTrackId !== 'string') {
    return malformed('currentTrackId must be a string')
  }

  const currentTrackId = asTrackId(document.currentTrackId)
  const currentTrack = tracksResult.value.find(
    (track) => track.id === currentTrackId,
  )
  if (currentTrack === undefined) {
    return malformed('current Track no longer exists')
  }

  let currentCueId = undefined as LoadedProject['currentCueId']
  if (document.currentCueId !== undefined) {
    if (typeof document.currentCueId !== 'string') {
      return malformed('currentCueId must be a string when present')
    }
    const parsed = asCueId(document.currentCueId)
    if (!currentTrack.cues.some((cue) => cue.id === parsed)) {
      return malformed('current Cue no longer exists')
    }
    currentCueId = parsed
  }

  return Result.succeed({
    tracks: tracksResult.value,
    alignment: alignmentResult.value,
    currentTrackId,
    ...(currentCueId === undefined ? {} : { currentCueId }),
  })
}

export const listProjects = async (
  options: ProjectRepositoryOptions = {},
): Result.ResultAsync<Array<ProjectSummary>, ListProjectsError> => {
  const factoryResult = resolveIdbFactory(options.factory)
  if (Result.isFailure(factoryResult)) {
    return Result.fail(factoryResult.error)
  }

  const run = async (
    database: IDBDatabase,
  ): Result.ResultAsync<Array<ProjectSummary>, ListProjectsError> => {
    try {
      const projectsResult = await getAll(database, PROJECTS_STORE)
      if (Result.isFailure(projectsResult)) {
        return Result.fail(projectsResult.error)
      }

      const summaries: Array<ProjectSummary> = []
      for (const raw of projectsResult.value) {
        const recordResult = validateProjectRecord(raw)
        if (Result.isFailure(recordResult)) {
          return Result.fail(recordResult.error)
        }
        const record = recordResult.value

        const mediaResult = await getOne(
          database,
          PROJECT_MEDIA_STORE,
          record.id,
        )
        if (Result.isFailure(mediaResult)) {
          return Result.fail(mediaResult.error)
        }
        const media = mediaResult.value as ProjectMediaRecord | undefined
        if (
          media === undefined ||
          typeof media.name !== 'string' ||
          typeof media.type !== 'string'
        ) {
          return Result.fail(
            new MalformedProjectError({
              projectId: record.id,
              reason: 'Project media record is missing or invalid',
            }),
          )
        }

        summaries.push({
          id: record.id,
          name: record.name,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
          mediaName: media.name,
          mediaType: media.type,
        })
      }

      summaries.sort((a, b) => b.updatedAt - a.updatedAt)
      return Result.succeed(summaries)
    } finally {
      database.close()
    }
  }

  return Result.pipe(
    openProjectDatabase(factoryResult.value),
    Result.andThen((database) => run(database)),
  )
}

export const createProject = async (
  input: CreateProjectInput,
  options: ProjectRepositoryOptions & { id?: ProjectId } = {},
): Result.ResultAsync<ProjectSummary, CreateProjectError> => {
  const factoryResult = resolveIdbFactory(options.factory)
  if (Result.isFailure(factoryResult)) {
    return Result.fail(factoryResult.error)
  }

  const nameResult = validateName(input.name)
  if (Result.isFailure(nameResult)) {
    return Result.fail(nameResult.error)
  }

  if (!input.tracks.some((track) => track.id === input.currentTrackId)) {
    return Result.fail(
      new InvalidProjectInputError({
        reason: 'currentTrackId must reference an existing track',
      }),
    )
  }

  if (input.currentCueId !== undefined) {
    const track = input.tracks.find(
      (candidate) => candidate.id === input.currentTrackId,
    )
    if (
      track === undefined ||
      !track.cues.some((cue) => cue.id === input.currentCueId)
    ) {
      return Result.fail(
        new InvalidProjectInputError({
          reason: 'currentCueId must reference an existing cue',
        }),
      )
    }
  }

  const factory = factoryResult.value
  const name = nameResult.value

  const run = async (
    database: IDBDatabase,
  ): Result.ResultAsync<ProjectSummary, CreateProjectError> => {
    const write = Result.try({
      try: async () => {
        const now = options.now ?? Date.now()
        const id = options.id ?? createProjectId()
        const alignment = input.alignment ?? { version: 2, tracks: [] }
        const mediaIdentity = getProjectMediaIdentity(input.mediaFile)

        const project: ProjectRecord = {
          id,
          version: PROJECT_SCHEMA_VERSION,
          name,
          createdAt: now,
          updatedAt: now,
        }
        const document: ProjectDocumentRecord = {
          projectId: id,
          cueInput: toCueInputJson(input.tracks),
          alignment: toAlignmentJson(alignment),
          currentTrackId: input.currentTrackId,
          ...(input.currentCueId === undefined
            ? {}
            : { currentCueId: input.currentCueId }),
        }
        const media: ProjectMediaRecord = {
          projectId: id,
          blob: input.mediaFile,
          name: mediaIdentity.name,
          type: mediaIdentity.type,
          size: mediaIdentity.size,
          lastModified: mediaIdentity.lastModified,
        }

        const transaction = database.transaction(
          [PROJECTS_STORE, PROJECT_DOCUMENTS_STORE, PROJECT_MEDIA_STORE],
          'readwrite',
        )
        transaction.objectStore(PROJECTS_STORE).put(project)
        transaction.objectStore(PROJECT_DOCUMENTS_STORE).put(document)
        transaction.objectStore(PROJECT_MEDIA_STORE).put(media)
        await transactionToPromise(transaction)

        return {
          id,
          name,
          createdAt: now,
          updatedAt: now,
          mediaName: mediaIdentity.name,
          mediaType: mediaIdentity.type,
        }
      },
      catch: (cause) => toWriteError(cause),
    })
    try {
      return await write
    } finally {
      database.close()
    }
  }

  return Result.pipe(
    openProjectDatabase(factory),
    Result.andThen((database) => run(database)),
  )
}

export const loadProject = async (
  projectId: ProjectId,
  options: ProjectRepositoryOptions = {},
): Result.ResultAsync<LoadedProject, LoadProjectError> => {
  const factoryResult = resolveIdbFactory(options.factory)
  if (Result.isFailure(factoryResult)) {
    return Result.fail(factoryResult.error)
  }

  const run = async (
    database: IDBDatabase,
  ): Result.ResultAsync<LoadedProject, LoadProjectError> => {
    try {
      const read = Result.try({
        try: async () => {
          const transaction = database.transaction(
            [PROJECTS_STORE, PROJECT_DOCUMENTS_STORE, PROJECT_MEDIA_STORE],
            'readonly',
          )
          const projectRaw = await requestToPromise(
            transaction.objectStore(PROJECTS_STORE).get(projectId),
          )
          const documentRaw = await requestToPromise(
            transaction.objectStore(PROJECT_DOCUMENTS_STORE).get(projectId),
          )
          const mediaRaw = await requestToPromise(
            transaction.objectStore(PROJECT_MEDIA_STORE).get(projectId),
          )
          await transactionToPromise(transaction)
          return { projectRaw, documentRaw, mediaRaw }
        },
        catch: (cause) => toReadError(cause),
      })
      const readResult = await read
      if (Result.isFailure(readResult)) {
        return Result.fail(readResult.error)
      }

      const { projectRaw, documentRaw, mediaRaw } = readResult.value
      if (
        projectRaw === undefined ||
        documentRaw === undefined ||
        mediaRaw === undefined
      ) {
        return Result.fail(new ProjectNotFoundError({ projectId }))
      }

      const recordResult = validateProjectRecord(projectRaw)
      if (Result.isFailure(recordResult)) {
        return Result.fail(recordResult.error)
      }
      const record = recordResult.value

      const document = documentRaw as ProjectDocumentRecord
      const media = mediaRaw as ProjectMediaRecord
      if (
        !(media.blob instanceof Blob) ||
        typeof media.name !== 'string' ||
        typeof media.type !== 'string' ||
        typeof media.size !== 'number' ||
        typeof media.lastModified !== 'number'
      ) {
        return Result.fail(
          new MalformedProjectError({
            projectId,
            reason: 'Project media record is invalid',
          }),
        )
      }

      const parsed = parseDocument(projectId, document)
      if (Result.isFailure(parsed)) {
        return Result.fail(parsed.error)
      }

      return Result.succeed({
        project: {
          id: record.id,
          name: record.name,
          createdAt: record.createdAt,
          updatedAt: record.updatedAt,
        },
        tracks: parsed.value.tracks,
        alignment: parsed.value.alignment,
        mediaFile: restoreProjectMediaFile(media),
        media: {
          name: media.name,
          type: media.type,
          size: media.size,
          lastModified: media.lastModified,
        },
        currentTrackId: parsed.value.currentTrackId,
        ...(parsed.value.currentCueId === undefined
          ? {}
          : { currentCueId: parsed.value.currentCueId }),
      })
    } finally {
      database.close()
    }
  }

  return Result.pipe(
    openProjectDatabase(factoryResult.value),
    Result.andThen((database) => run(database)),
  )
}

export const saveProjectSession = async (
  projectId: ProjectId,
  session: SaveProjectSessionInput,
  options: ProjectRepositoryOptions = {},
): Result.ResultAsync<void, SaveProjectSessionError> => {
  const factoryResult = resolveIdbFactory(options.factory)
  if (Result.isFailure(factoryResult)) {
    return Result.fail(factoryResult.error)
  }

  if (
    typeof session.currentTrackId !== 'string' ||
    session.currentTrackId.length === 0
  ) {
    return Result.fail(
      new InvalidProjectInputError({ reason: 'currentTrackId is required' }),
    )
  }

  const run = async (
    database: IDBDatabase,
  ): Result.ResultAsync<void, SaveProjectSessionError> => {
    try {
      const read = Result.try({
        try: async () => {
          const transaction = database.transaction(
            [PROJECTS_STORE, PROJECT_DOCUMENTS_STORE],
            'readonly',
          )
          const projectRaw = await requestToPromise(
            transaction.objectStore(PROJECTS_STORE).get(projectId),
          )
          const documentRaw = await requestToPromise(
            transaction.objectStore(PROJECT_DOCUMENTS_STORE).get(projectId),
          )
          await transactionToPromise(transaction)
          return { projectRaw, documentRaw }
        },
        catch: (cause) => toReadError(cause),
      })
      const readResult = await read
      if (Result.isFailure(readResult)) {
        return Result.fail(readResult.error)
      }

      const { projectRaw, documentRaw } = readResult.value
      if (projectRaw === undefined || documentRaw === undefined) {
        return Result.fail(new ProjectNotFoundError({ projectId }))
      }

      const recordResult = validateProjectRecord(projectRaw)
      if (Result.isFailure(recordResult)) {
        return Result.fail(recordResult.error)
      }

      const existing = documentRaw as ProjectDocumentRecord
      const now = options.now ?? Date.now()
      const updatedProject: ProjectRecord = {
        ...recordResult.value,
        updatedAt: now,
      }
      const updatedDocument: ProjectDocumentRecord = {
        projectId,
        cueInput: existing.cueInput,
        alignment: toAlignmentJson(session.alignment),
        currentTrackId: session.currentTrackId,
        ...(session.currentCueId === undefined
          ? {}
          : { currentCueId: session.currentCueId }),
      }

      const write = Result.try({
        try: async () => {
          const transaction = database.transaction(
            [PROJECTS_STORE, PROJECT_DOCUMENTS_STORE],
            'readwrite',
          )
          transaction.objectStore(PROJECTS_STORE).put(updatedProject)
          transaction.objectStore(PROJECT_DOCUMENTS_STORE).put(updatedDocument)
          await transactionToPromise(transaction)
        },
        catch: (cause) => toWriteError(cause),
      })
      const writeResult = await write
      if (Result.isFailure(writeResult)) {
        return Result.fail(writeResult.error)
      }

      return Result.succeed(undefined)
    } finally {
      database.close()
    }
  }

  return Result.pipe(
    openProjectDatabase(factoryResult.value),
    Result.andThen((database) => run(database)),
  )
}

export const renameProject = async (
  projectId: ProjectId,
  name: string,
  options: ProjectRepositoryOptions = {},
): Result.ResultAsync<ProjectSummary, RenameProjectError> => {
  const factoryResult = resolveIdbFactory(options.factory)
  if (Result.isFailure(factoryResult)) {
    return Result.fail(factoryResult.error)
  }

  const nameResult = validateName(name)
  if (Result.isFailure(nameResult)) {
    return Result.fail(nameResult.error)
  }
  const trimmed = nameResult.value

  const run = async (
    database: IDBDatabase,
  ): Result.ResultAsync<ProjectSummary, RenameProjectError> => {
    try {
      const read = Result.try({
        try: async () => {
          const transaction = database.transaction(
            [PROJECTS_STORE, PROJECT_MEDIA_STORE],
            'readonly',
          )
          const projectRaw = await requestToPromise(
            transaction.objectStore(PROJECTS_STORE).get(projectId),
          )
          const mediaRaw = await requestToPromise(
            transaction.objectStore(PROJECT_MEDIA_STORE).get(projectId),
          )
          await transactionToPromise(transaction)
          return { projectRaw, mediaRaw }
        },
        catch: (cause) => toReadError(cause),
      })
      const readResult = await read
      if (Result.isFailure(readResult)) {
        return Result.fail(readResult.error)
      }

      const { projectRaw, mediaRaw } = readResult.value
      if (projectRaw === undefined) {
        return Result.fail(new ProjectNotFoundError({ projectId }))
      }

      const recordResult = validateProjectRecord(projectRaw)
      if (Result.isFailure(recordResult)) {
        return Result.fail(recordResult.error)
      }

      const now = options.now ?? Date.now()
      const updated: ProjectRecord = {
        ...recordResult.value,
        name: trimmed,
        updatedAt: now,
      }

      const write = Result.try({
        try: async () => {
          const transaction = database.transaction(PROJECTS_STORE, 'readwrite')
          transaction.objectStore(PROJECTS_STORE).put(updated)
          await transactionToPromise(transaction)
        },
        catch: (cause) => toWriteError(cause),
      })
      const writeResult = await write
      if (Result.isFailure(writeResult)) {
        return Result.fail(writeResult.error)
      }

      const media = mediaRaw as ProjectMediaRecord | undefined
      return Result.succeed({
        id: updated.id,
        name: updated.name,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
        mediaName:
          media !== undefined && typeof media.name === 'string'
            ? media.name
            : '',
        mediaType:
          media !== undefined && typeof media.type === 'string'
            ? media.type
            : '',
      })
    } finally {
      database.close()
    }
  }

  return Result.pipe(
    openProjectDatabase(factoryResult.value),
    Result.andThen((database) => run(database)),
  )
}

export const deleteProject = async (
  projectId: ProjectId,
  options: ProjectRepositoryOptions = {},
): Result.ResultAsync<void, DeleteProjectError> => {
  const factoryResult = resolveIdbFactory(options.factory)
  if (Result.isFailure(factoryResult)) {
    return Result.fail(factoryResult.error)
  }

  const run = async (
    database: IDBDatabase,
  ): Result.ResultAsync<void, DeleteProjectError> => {
    try {
      const existingResult = await getOne(database, PROJECTS_STORE, projectId)
      if (Result.isFailure(existingResult)) {
        return Result.fail(existingResult.error)
      }
      if (existingResult.value === undefined) {
        return Result.fail(new ProjectNotFoundError({ projectId }))
      }

      const write = Result.try({
        try: async () => {
          const transaction = database.transaction(
            [PROJECTS_STORE, PROJECT_DOCUMENTS_STORE, PROJECT_MEDIA_STORE],
            'readwrite',
          )
          transaction.objectStore(PROJECTS_STORE).delete(projectId)
          transaction.objectStore(PROJECT_DOCUMENTS_STORE).delete(projectId)
          transaction.objectStore(PROJECT_MEDIA_STORE).delete(projectId)
          await transactionToPromise(transaction)
        },
        catch: (cause) => toWriteError(cause),
      })
      const writeResult = await write
      if (Result.isFailure(writeResult)) {
        return Result.fail(writeResult.error)
      }

      return Result.succeed(undefined)
    } finally {
      database.close()
    }
  }

  return Result.pipe(
    openProjectDatabase(factoryResult.value),
    Result.andThen((database) => run(database)),
  )
}
