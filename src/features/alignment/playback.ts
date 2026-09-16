import { ErrorFactory } from '@praha/error-factory'

export class PlaybackToggleError extends ErrorFactory({
  name: 'PlaybackToggleError',
  message: 'Failed to toggle media playback',
}) {}
