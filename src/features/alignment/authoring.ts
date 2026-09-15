import { Result } from '@praha/byethrow'

import type { Alignment } from '#/core'
import type { ReadAlignmentFileError, ReadCueFileError } from './errors'
import { readAlignmentFile, readCueFile } from './input'
import type { ReferenceCue, TextFile } from './input'

export type AuthoringInput = {
  cues: ReadonlyArray<ReferenceCue>
  alignment?: Alignment
}

export type ReadAuthoringInputError = ReadCueFileError | ReadAlignmentFileError

export const readAuthoringInput = (
  cueFile: TextFile,
  alignmentFile?: TextFile,
): Result.ResultAsync<AuthoringInput, ReadAuthoringInputError> =>
  Result.pipe(
    readCueFile(cueFile),
    Result.andThen((cues) => {
      if (alignmentFile === undefined) {
        return Result.succeed({ cues })
      }

      return Result.pipe(
        readAlignmentFile(cues, alignmentFile),
        Result.map((alignment) => ({ cues, alignment })),
      )
    }),
  )
