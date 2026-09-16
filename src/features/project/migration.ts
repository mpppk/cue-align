import { Result } from '@praha/byethrow'

import { discardAutosave, validateRecoveryMedia } from '../alignment/autosave'
import type {
  AutosaveDiscardError,
  AutosaveStorage,
  RecoveredAuthoringSession,
  StaleAutosaveError,
} from '../alignment/autosave'
import { createProject, loadProject } from './repository'
import type { CreateProjectError, LoadProjectError } from './errors'
import type { ProjectRepositoryOptions } from './repository'
import type { LoadedProject, ProjectSummary } from './project'

export type MigrateLegacyAutosaveError =
  | StaleAutosaveError
  | CreateProjectError
  | LoadProjectError
  | AutosaveDiscardError

export const migrateLegacyAutosaveToProject = async (
  storage: AutosaveStorage,
  legacy: RecoveredAuthoringSession,
  mediaFile: File,
  name: string,
  options: ProjectRepositoryOptions = {},
): Result.ResultAsync<LoadedProject, MigrateLegacyAutosaveError> => {
  const mediaValidation = validateRecoveryMedia(mediaFile, legacy.media)
  if (Result.isFailure(mediaValidation)) {
    return Result.fail(mediaValidation.error)
  }

  const trimmed = name.trim()
  const projectName =
    trimmed.length > 0
      ? trimmed
      : legacy.media.name.replace(/\.[^/.]+$/, '') || 'Recovered project'

  const created: Result.Result<ProjectSummary, CreateProjectError> =
    await createProject(
      {
        name: projectName,
        tracks: legacy.authoring.tracks,
        alignment: legacy.authoring.alignment,
        mediaFile,
        currentTrackId: legacy.currentTrackId,
        ...(legacy.currentCueId === undefined
          ? {}
          : { currentCueId: legacy.currentCueId }),
      },
      options,
    )
  if (Result.isFailure(created)) {
    return Result.fail(created.error)
  }

  const loaded: Result.Result<LoadedProject, LoadProjectError> =
    await loadProject(created.value.id, options)
  if (Result.isFailure(loaded)) {
    return Result.fail(loaded.error)
  }

  // Only discard the legacy record after the Project transaction succeeded.
  const discardResult = discardAutosave(storage)
  if (Result.isFailure(discardResult)) {
    return Result.fail(discardResult.error)
  }

  return Result.succeed(loaded.value)
}
