import { Result } from '@praha/byethrow'
import { useCallback, useEffect, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'

import { readAuthoringInput } from '../../alignment/authoring'
import type { ReadAuthoringInputError } from '../../alignment/authoring'
import { discardAutosave, loadAutosave } from '../../alignment/autosave'
import type { RecoveredAuthoringSession } from '../../alignment/autosave'
import {
  InvalidAlignmentInputError,
  InvalidCueInputError,
} from '../../alignment/errors'
import { migrateLegacyAutosaveToProject } from '../migration'
import {
  createProject,
  deleteProject,
  listProjects,
  loadProject,
  renameProject,
} from '../repository'
import type {
  CreateProjectError,
  DeleteProjectError,
  ListProjectsError,
  LoadProjectError,
  RenameProjectError,
} from '../errors'
import type { LoadedProject, ProjectId, ProjectSummary } from '../project'

export type OpenedProject = {
  projectId: ProjectId
  projectName: string
  authoring: LoadedProject['tracks'] extends ReadonlyArray<infer T>
    ? { tracks: ReadonlyArray<T>; alignment: LoadedProject['alignment'] }
    : never
  mediaFile: File
  currentTrackId: LoadedProject['currentTrackId']
  currentCueId?: LoadedProject['currentCueId']
}

type ProjectStartScreenProps = {
  onOpen: (opened: OpenedProject) => void
}

type FileFieldProps = {
  label: string
  hint: string
  accept: string
  onChange: (file: File | undefined) => void
}

function FileField({ label, hint, accept, onChange }: FileFieldProps) {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.files?.[0])
  }

  return (
    <label className="file-field">
      <span>{label}</span>
      <small>{hint}</small>
      <input type="file" accept={accept} onChange={handleChange} />
    </label>
  )
}

const formatInputError = (error: ReadAuthoringInputError): string => {
  if (
    error instanceof InvalidCueInputError ||
    error instanceof InvalidAlignmentInputError
  ) {
    return `${error.message}: ${error.path} — ${error.reason}`
  }

  return error.message
}

const formatListError = (error: ListProjectsError): string => error.message
const formatLoadError = (error: LoadProjectError): string => error.message
const formatCreateError = (
  error: ReadAuthoringInputError | CreateProjectError,
): string =>
  'path' in error &&
  (error instanceof InvalidCueInputError ||
    error instanceof InvalidAlignmentInputError)
    ? `${error.message}: ${(error as { path: string }).path}`
    : error.message

export function ProjectStartScreen({ onOpen }: ProjectStartScreenProps) {
  const [projects, setProjects] = useState<Array<ProjectSummary>>([])
  const [listError, setListError] = useState<ListProjectsError>()
  const [isListing, setIsListing] = useState(true)

  const [projectName, setProjectName] = useState('')
  const [cueFile, setCueFile] = useState<File>()
  const [mediaFile, setMediaFile] = useState<File>()
  const [alignmentFile, setAlignmentFile] = useState<File>()
  const [inputError, setInputError] = useState<ReadAuthoringInputError>()
  const [createError, setCreateError] = useState<CreateProjectError>()
  const [isCreating, setIsCreating] = useState(false)

  const [openError, setOpenError] = useState<LoadProjectError>()
  const [openingId, setOpeningId] = useState<ProjectId>()
  const [renamingId, setRenamingId] = useState<ProjectId>()
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<RenameProjectError>()
  const [deleteConfirmId, setDeleteConfirmId] = useState<ProjectId>()
  const [deleteError, setDeleteError] = useState<DeleteProjectError>()

  const [legacy, setLegacy] = useState<RecoveredAuthoringSession>()
  const [legacyError, setLegacyError] = useState<Error>()
  const [legacyMediaFile, setLegacyMediaFile] = useState<File>()
  const [legacyName, setLegacyName] = useState('')
  const [isMigrating, setIsMigrating] = useState(false)

  const refreshList = useCallback(async () => {
    setIsListing(true)
    const result = await listProjects()
    setIsListing(false)
    if (Result.isFailure(result)) {
      setListError(result.error)
      return
    }

    setListError(undefined)
    setProjects(result.value)
  }, [])

  useEffect(() => {
    void refreshList()
  }, [refreshList])

  useEffect(() => {
    const result = loadAutosave(window.localStorage)
    if (Result.isFailure(result)) {
      setLegacyError(result.error)
      return
    }

    setLegacy(result.value)
    if (result.value !== undefined) {
      setLegacyName(result.value.media.name.replace(/\.[^/.]+$/, ''))
    }
  }, [])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (
      cueFile === undefined ||
      mediaFile === undefined ||
      projectName.trim().length === 0 ||
      isCreating
    ) {
      return
    }

    setIsCreating(true)
    setInputError(undefined)
    setCreateError(undefined)

    const inputResult = await readAuthoringInput(cueFile, alignmentFile)
    if (Result.isFailure(inputResult)) {
      setInputError(inputResult.error)
      setIsCreating(false)
      return
    }

    const firstTrack = inputResult.value.tracks.at(0)
    if (firstTrack === undefined) {
      setIsCreating(false)
      return
    }

    const created = await createProject({
      name: projectName.trim(),
      tracks: inputResult.value.tracks,
      ...(inputResult.value.alignment === undefined
        ? {}
        : { alignment: inputResult.value.alignment }),
      mediaFile,
      currentTrackId: firstTrack.id,
    })
    setIsCreating(false)
    if (Result.isFailure(created)) {
      setCreateError(created.error)
      return
    }

    const loaded = await loadProject(created.value.id)
    if (Result.isFailure(loaded)) {
      setCreateError(undefined)
      setOpenError(loaded.error)
      void refreshList()
      return
    }

    onOpen({
      projectId: loaded.value.project.id,
      projectName: loaded.value.project.name,
      authoring: {
        tracks: loaded.value.tracks,
        alignment: loaded.value.alignment,
      },
      mediaFile: loaded.value.mediaFile,
      currentTrackId: loaded.value.currentTrackId,
      ...(loaded.value.currentCueId === undefined
        ? {}
        : { currentCueId: loaded.value.currentCueId }),
    })
  }

  const handleOpen = async (projectId: ProjectId) => {
    setOpeningId(projectId)
    setOpenError(undefined)
    const result = await loadProject(projectId)
    setOpeningId(undefined)
    if (Result.isFailure(result)) {
      setOpenError(result.error)
      return
    }

    onOpen({
      projectId: result.value.project.id,
      projectName: result.value.project.name,
      authoring: {
        tracks: result.value.tracks,
        alignment: result.value.alignment,
      },
      mediaFile: result.value.mediaFile,
      currentTrackId: result.value.currentTrackId,
      ...(result.value.currentCueId === undefined
        ? {}
        : { currentCueId: result.value.currentCueId }),
    })
  }

  const handleRename = async (projectId: ProjectId) => {
    if (renameValue.trim().length === 0) {
      return
    }

    const result = await renameProject(projectId, renameValue.trim())
    if (Result.isFailure(result)) {
      setRenameError(result.error)
      return
    }

    setRenameError(undefined)
    setRenamingId(undefined)
    setRenameValue('')
    void refreshList()
  }

  const handleDelete = async (projectId: ProjectId) => {
    const result = await deleteProject(projectId)
    if (Result.isFailure(result)) {
      setDeleteError(result.error)
      return
    }

    setDeleteError(undefined)
    setDeleteConfirmId(undefined)
    void refreshList()
  }

  const handleLegacyMigrate = async () => {
    if (legacy === undefined || legacyMediaFile === undefined || isMigrating) {
      return
    }

    setIsMigrating(true)
    setLegacyError(undefined)
    const migrated = await migrateLegacyAutosaveToProject(
      window.localStorage,
      legacy,
      legacyMediaFile,
      legacyName,
    )
    if (Result.isFailure(migrated)) {
      // Keep the legacy autosave when the Project transaction fails.
      setLegacyError(migrated.error)
      setIsMigrating(false)
      return
    }

    const loaded = migrated.value
    setLegacy(undefined)
    setLegacyMediaFile(undefined)
    setIsMigrating(false)
    void refreshList()
    onOpen({
      projectId: loaded.project.id,
      projectName: loaded.project.name,
      authoring: {
        tracks: loaded.tracks,
        alignment: loaded.alignment,
      },
      mediaFile: loaded.mediaFile,
      currentTrackId: loaded.currentTrackId,
      ...(loaded.currentCueId === undefined
        ? {}
        : { currentCueId: loaded.currentCueId }),
    })
  }

  const handleLegacyDiscard = () => {
    const result = discardAutosave(window.localStorage)
    if (Result.isFailure(result)) {
      setLegacyError(result.error)
      return
    }

    setLegacy(undefined)
    setLegacyMediaFile(undefined)
    setLegacyError(undefined)
  }

  const canCreate =
    projectName.trim().length > 0 &&
    cueFile !== undefined &&
    mediaFile !== undefined &&
    !isCreating

  return (
    <section className="panel setup-panel" aria-labelledby="setup-title">
      <div className="section-heading">
        <p className="eyebrow">Reference authoring tool</p>
        <h1 id="setup-title">Cue sequence をメディアへ合わせる</h1>
        <p>
          Project は Cue・media・Alignment
          をひとまとめにしてこのブラウザ内に保存します。保存に期限はなく、明示的に削除するまで残ります。ただし
          browser storage は端末・origin
          ローカルであり、ブラウザ操作により消去され得ます。
        </p>
        <p>選択したファイルはブラウザ内だけで扱います。</p>
      </div>

      <div className="setup-form" aria-label="Saved projects">
        <div>
          <strong>保存済み Project</strong>
          <p>
            {isListing
              ? '読み込み中…'
              : projects.length === 0
                ? 'まだ Project がありません。下のフォームから作成してください。'
                : `${projects.length} 件の Project`}
          </p>
        </div>

        {listError === undefined ? null : (
          <div className="error-message" role="status">
            <strong>{listError.name}</strong>
            <span>
              {formatListError(listError)}
              。一覧の読み込み失敗は新規 Project 作成を阻害しません。
            </span>
          </div>
        )}

        {projects.map((project) => (
          <div
            key={project.id}
            className="file-field"
            aria-label={`Project ${project.name}`}
          >
            <span>{project.name}</span>
            <small>
              {project.mediaName} —{' '}
              {new Date(project.updatedAt).toLocaleString()}
            </small>
            <div className="editor-actions">
              <button
                className="primary-button"
                type="button"
                disabled={openingId === project.id}
                onClick={() => handleOpen(project.id)}
              >
                {openingId === project.id ? '読み込み中…' : '開く'}
              </button>
              {renamingId === project.id ? (
                <>
                  <input
                    aria-label="New project name"
                    value={renameValue}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setRenameValue(event.currentTarget.value)
                    }
                  />
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => handleRename(project.id)}
                  >
                    保存
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setRenamingId(undefined)
                      setRenameValue('')
                      setRenameError(undefined)
                    }}
                  >
                    取消
                  </button>
                </>
              ) : (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setRenamingId(project.id)
                    setRenameValue(project.name)
                    setRenameError(undefined)
                  }}
                >
                  Rename
                </button>
              )}
              {deleteConfirmId === project.id ? (
                <>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => handleDelete(project.id)}
                  >
                    削除を確定
                  </button>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => setDeleteConfirmId(undefined)}
                  >
                    取消
                  </button>
                </>
              ) : (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => setDeleteConfirmId(project.id)}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}

        {renameError === undefined ? null : (
          <div className="error-message" role="alert">
            <strong>{renameError.name}</strong>
            <span>{renameError.message}</span>
          </div>
        )}
        {deleteError === undefined ? null : (
          <div className="error-message" role="alert">
            <strong>{deleteError.name}</strong>
            <span>{deleteError.message}</span>
          </div>
        )}
        {openError === undefined ? null : (
          <div className="error-message" role="alert">
            <strong>{openError.name}</strong>
            <span>{formatLoadError(openError)}</span>
          </div>
        )}
      </div>

      {legacy === undefined ? null : (
        <div className="setup-form" aria-label="Legacy autosave migration">
          <div>
            <strong>旧 autosave からの移行</strong>
            <p>
              {legacy.media.name} — {new Date(legacy.savedAt).toLocaleString()}
            </p>
            <small>
              旧 autosave には media
              本体がないため、同じファイルを再選択してください。Project
              保存成功後に旧 autosave を削除します。
            </small>
          </div>
          <label className="file-field">
            <span>Project name</span>
            <small>移行後の Project 名</small>
            <input
              value={legacyName}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                setLegacyName(event.currentTarget.value)
              }
            />
          </label>
          <FileField
            label="Audio / Video file"
            hint={`移行用・${legacy.media.name}`}
            accept="audio/*,video/*"
            onChange={setLegacyMediaFile}
          />
          <div className="editor-actions">
            <button
              className="primary-button"
              type="button"
              disabled={legacyMediaFile === undefined || isMigrating}
              onClick={handleLegacyMigrate}
            >
              {isMigrating ? '移行中…' : 'Project へ移行'}
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={handleLegacyDiscard}
            >
              旧 autosave を破棄
            </button>
          </div>
        </div>
      )}

      {legacyError === undefined ? null : (
        <div className="error-message" role="status">
          <strong>{legacyError.name}</strong>
          <span>
            {legacyError.message}。通常の Project 作成から新しく開始できます。
          </span>
        </div>
      )}

      <form className="setup-form" onSubmit={handleCreate}>
        <div>
          <strong>新規 Project</strong>
          <p>Cue JSON と media から名前付き Project を作成します。</p>
        </div>
        <label className="file-field">
          <span>Project name</span>
          <small>必須・重複可</small>
          <input
            value={projectName}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              setProjectName(event.currentTarget.value)
            }
          />
        </label>
        <FileField
          label="Cue JSON"
          hint="必須"
          accept="application/json,.json"
          onChange={setCueFile}
        />
        <FileField
          label="Audio / Video file"
          hint="必須"
          accept="audio/*,video/*"
          onChange={setMediaFile}
        />
        <FileField
          label="Alignment JSON"
          hint="任意・作業再開用"
          accept="application/json,.json"
          onChange={setAlignmentFile}
        />

        {inputError === undefined ? null : (
          <div className="error-message" role="alert">
            <strong>{inputError.name}</strong>
            <span>{formatInputError(inputError)}</span>
          </div>
        )}
        {createError === undefined ? null : (
          <div className="error-message" role="alert">
            <strong>{createError.name}</strong>
            <span>
              {formatCreateError(createError)}
              。入力内容は保持されているため、再試行や Alignment export
              が可能です。
            </span>
          </div>
        )}

        <button className="primary-button" type="submit" disabled={!canCreate}>
          {isCreating ? '保存中…' : 'Project を作成して開く'}
        </button>
      </form>
    </section>
  )
}
