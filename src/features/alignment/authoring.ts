import { Result } from '@praha/byethrow'

import type { MultiTrackAlignment } from '@mpppk/cue-align-core'
import { readAlignmentDocumentFile, readCueTracksFile } from './multiTrackInput'
import type {
  ReadAlignmentDocumentFileError,
  ReadCueTracksFileError,
  ReferenceTrack,
} from './multiTrackInput'
import type { TextFile } from './input'

export type AuthoringInput = {
  tracks: ReadonlyArray<ReferenceTrack>
  alignment?: MultiTrackAlignment
}

export type ReadAuthoringInputError =
  | ReadCueTracksFileError
  | ReadAlignmentDocumentFileError

export const readAuthoringInput = (
  cueFile: TextFile,
  alignmentFile?: TextFile,
): Result.ResultAsync<AuthoringInput, ReadAuthoringInputError> =>
  Result.pipe(
    readCueTracksFile(cueFile),
    Result.andThen((tracks) => {
      if (alignmentFile === undefined) {
        return Result.succeed({ tracks })
      }

      return Result.pipe(
        readAlignmentDocumentFile(tracks, alignmentFile),
        Result.map((alignment) => ({ tracks, alignment })),
      )
    }),
  )
