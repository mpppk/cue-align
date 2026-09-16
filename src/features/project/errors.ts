import { ErrorFactory } from '@praha/error-factory'

export class ProjectStoreUnsupportedError extends ErrorFactory({
  name: 'ProjectStoreUnsupportedError',
  message: 'IndexedDB is not available in this browser',
}) {}

export class ProjectStoreOpenError extends ErrorFactory({
  name: 'ProjectStoreOpenError',
  message: 'Failed to open the project database',
}) {}

export class ProjectReadError extends ErrorFactory({
  name: 'ProjectReadError',
  message: 'Failed to read project data',
}) {}

export class ProjectWriteError extends ErrorFactory({
  name: 'ProjectWriteError',
  message: 'Failed to write project data',
}) {}

export class ProjectQuotaError extends ErrorFactory({
  name: 'ProjectQuotaError',
  message: 'Browser storage quota was exceeded while saving the project',
}) {}

export class ProjectNotFoundError extends ErrorFactory({
  name: 'ProjectNotFoundError',
  message: 'The project was not found',
  fields: ErrorFactory.fields<{ projectId: string }>(),
}) {}

export class MalformedProjectError extends ErrorFactory({
  name: 'MalformedProjectError',
  message: 'The stored project is malformed',
  fields: ErrorFactory.fields<{ projectId?: string; reason: string }>(),
}) {}

export class UnsupportedProjectVersionError extends ErrorFactory({
  name: 'UnsupportedProjectVersionError',
  message: 'The stored project version is not supported',
  fields: ErrorFactory.fields<{ projectId?: string; version: unknown }>(),
}) {}

export class InvalidProjectInputError extends ErrorFactory({
  name: 'InvalidProjectInputError',
  message: 'The project input is invalid',
  fields: ErrorFactory.fields<{ reason: string }>(),
}) {}

export type ListProjectsError =
  | ProjectStoreUnsupportedError
  | ProjectStoreOpenError
  | ProjectReadError
  | MalformedProjectError
  | UnsupportedProjectVersionError

export type CreateProjectError =
  | ProjectStoreUnsupportedError
  | ProjectStoreOpenError
  | ProjectReadError
  | ProjectWriteError
  | ProjectQuotaError
  | InvalidProjectInputError

export type LoadProjectError =
  | ProjectStoreUnsupportedError
  | ProjectStoreOpenError
  | ProjectReadError
  | ProjectNotFoundError
  | MalformedProjectError
  | UnsupportedProjectVersionError

export type SaveProjectSessionError =
  | ProjectStoreUnsupportedError
  | ProjectStoreOpenError
  | ProjectReadError
  | ProjectWriteError
  | ProjectQuotaError
  | ProjectNotFoundError
  | MalformedProjectError
  | UnsupportedProjectVersionError
  | InvalidProjectInputError

export type RenameProjectError =
  | ProjectStoreUnsupportedError
  | ProjectStoreOpenError
  | ProjectReadError
  | ProjectWriteError
  | ProjectQuotaError
  | ProjectNotFoundError
  | MalformedProjectError
  | UnsupportedProjectVersionError
  | InvalidProjectInputError

export type DeleteProjectError =
  | ProjectStoreUnsupportedError
  | ProjectStoreOpenError
  | ProjectReadError
  | ProjectWriteError
  | ProjectQuotaError
  | ProjectNotFoundError
