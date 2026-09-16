import { Result } from '@praha/byethrow'
import { ErrorFactory } from '@praha/error-factory'

import type { AlignmentDocument } from '@mpppk/cue-align-core'

export class AlignmentExportError extends ErrorFactory({
  name: 'AlignmentExportError',
  message: 'Failed to export Alignment JSON',
}) {}

export const serializeAlignment = (alignment: AlignmentDocument): string =>
  `${JSON.stringify(alignment, null, 2)}\n`

export const downloadAlignment = (
  alignment: AlignmentDocument,
  filename = 'alignment.json',
): Result.Result<void, AlignmentExportError> =>
  Result.try({
    try: () => {
      const blob = new Blob([serializeAlignment(alignment)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = filename
      anchor.click()
      URL.revokeObjectURL(url)
    },
    catch: (cause) => new AlignmentExportError({ cause }),
  })
