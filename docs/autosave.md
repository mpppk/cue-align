# Local autosave / recovery

This document defines the reference app's local-only recovery contract. It is intentionally outside the Core domain model and does not replace the canonical Alignment import/export formats.

## Storage schema

The reference app stores one recovery record under a private browser-storage key.

- schema `version`: `1`
- `savedAt`: epoch milliseconds
- `media`: `{ name, type, size, lastModified }`
- `cueInput`: a version 2 track container containing the parsed Cue input
- `alignment`: the current version 2 multi-track Alignment used internally by the editor
- `currentTrackId`: the active Track
- `currentCueId`: the active Cue when one exists

Cue and Alignment data are validated through the same input/domain validation used by normal authoring. The local record may therefore be discarded without changing the canonical exported Alignment contract.

## Media recovery

Media bytes are never persisted implicitly. Recovery shows the saved media identity and requires the user to re-select a local file whose `name`, `type`, `size`, and `lastModified` all match. A mismatched file is reported as stale recovery data and cannot be resumed accidentally.

## Lifetime and failures

A record older than 30 days, or one whose timestamp is materially in the future, is stale. Malformed JSON/data, unsupported schema versions, stale data, browser-storage read/write failures, and quota exhaustion are represented by typed errors. None of these failures may block the normal Setup flow.

## Autosave timing

Editor changes are debounced for 750 ms. The debounce scheduler is independent from browser storage and exposes `schedule`, `flush`, and `cancel` so its timing can be unit tested. The editor flushes pending work when it unmounts.
