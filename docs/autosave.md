# Projects / local persistence

This document defines the reference app's local-only Project contract. It is intentionally outside the Core domain model and does not replace the canonical Cue / Alignment import/export formats.

## Responsibilities

Project is a reference-app aggregate that owns browser persistence and media. `@mpppk/cue-align-core` does not know about Projects.

- `ProjectId` is the identity. Project names may duplicate.
- A Project owns at minimum:
  - metadata: `name` / `createdAt` / `updatedAt`
  - Cue input: single-track input is normalized internally to the existing version 2 track container
  - media: `Blob` plus the original file metadata (`name` / `type` / `size` / `lastModified`)
  - current Alignment: the same version 2 multi-track form used internally by the editor
  - recovery state: `currentTrackId` / `currentCueId` (when present)
- `media` covers both Audio and Video. Audio persistence is the required use case; existing Video authoring must not regress.

## IndexedDB schema

DB name is `cue-align`, initial DB version is `1`. The DB version and the stored record schema version are managed separately for future migrations.

### `projects`

Lightweight metadata so the Project list does not retain Blobs.

type ProjectRecord = {
id: ProjectId
version: 1
name: string
createdAt: number
updatedAt: number
}

- key: `id`
- index: `updatedAt` (list is updatedAt descending)

### `projectDocuments`

type ProjectDocumentRecord = {
projectId: ProjectId
cueInput: JsonValue
alignment: JsonValue
currentTrackId: string
currentCueId?: string
}

- key: `projectId`
- load does not trust stored values; it runs the existing `parseCueTracksInput` / `parseAlignmentDocumentInput` plus domain validation
- editor debounce autosave updates this store and `projects.updatedAt` in one transaction

### `projectMedia`

type ProjectMediaRecord = {
projectId: ProjectId
blob: Blob
name: string
type: string
size: number
lastModified: number
}

- key: `projectId`
- media Blob is written at Project creation and is not rewritten on Alignment autosave
- open restores a playback `File` from the Blob plus metadata and reuses the existing object URL lifecycle

Project create/delete spans all three stores in one transaction so partial Projects are never left behind. Document autosave updates `projectDocuments` and `projects` in one transaction.

## Lifetime and locality

Saved Projects do not expire after 30 days and are kept until explicitly deleted. Browser storage is device- and origin-local and may be erased by browser operation; the UI states this explicitly.

Malformed / unsupported / missing-record Projects, IndexedDB open/read/write failures, and quota exhaustion are typed errors. Storage failures must not unnecessarily block new input or Alignment export.

## Autosave timing

Editor changes are debounced for 750 ms. The debounce scheduler is independent from browser storage and exposes `schedule`, `flush`, and `cancel` so its timing can be unit tested. The editor flushes pending work when it unmounts. Autosave rewrites only the document plus `updatedAt`; media Blob is never rewritten.

## Legacy localStorage transition

The previous `localStorage` autosave (`cue-align:authoring-autosave`) has no media bytes and cannot be migrated automatically.

- When a legacy record is detected, the UI asks for the same media file to be reselected, as before.
- On successful recovery, the session is saved as a new IndexedDB Project.
- The legacy record is deleted only after the Project creation transaction succeeds. If Project saving fails, the original autosave is kept.
- After the migration period, the legacy path can be removed. Normal autosave is now unified on the Project repository.

## Legacy local autosave / recovery (pre-Project)

The reference app previously stored one recovery record under a private browser-storage key.

- schema `version`: `1`
- `savedAt`: epoch milliseconds
- `media`: `{ name, type, size, lastModified }`
- `cueInput`: a version 2 track container containing the parsed Cue input
- `alignment`: the current version 2 multi-track Alignment used internally by the editor
- `currentTrackId`: the active Track
- `currentCueId`: the active Cue when one exists

Cue and Alignment data are validated through the same input/domain validation used by normal authoring. The local record may therefore be discarded without changing the canonical exported Alignment contract.

### Media recovery

Media bytes were never persisted implicitly. Recovery showed the saved media identity and required the user to re-select a local file whose `name`, `type`, `size`, and `lastModified` all matched. A mismatched file was reported as stale recovery data and could not be resumed accidentally.

### Lifetime and failures

A record older than 30 days, or one whose timestamp was materially in the future, was stale. Malformed JSON/data, unsupported schema versions, stale data, browser-storage read/write failures, and quota exhaustion were represented by typed errors. None of these failures blocked the normal Setup flow.
