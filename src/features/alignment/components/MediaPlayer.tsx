import type { RefObject } from 'react'

import { useLocalMediaUrl } from '../useMedia'

export type MediaKind = 'audio' | 'video'

export const getMediaKind = (file: Pick<File, 'name' | 'type'>): MediaKind => {
  if (
    file.type.startsWith('video/') ||
    /\.(mp4|m4v|mov|webm|ogv)$/i.test(file.name)
  ) {
    return 'video'
  }

  return 'audio'
}

type MediaPlayerProps = {
  file: File
  mediaRef?: RefObject<HTMLMediaElement | null>
  onTimeChange?: (currentTime: number) => void
}

export function MediaPlayer({
  file,
  mediaRef,
  onTimeChange,
}: MediaPlayerProps) {
  const url = useLocalMediaUrl(file)
  const kind = getMediaKind(file)

  const setMediaRef = (element: HTMLMediaElement | null) => {
    if (mediaRef !== undefined) {
      mediaRef.current = element
    }
  }

  const emitCurrentTime = (element: HTMLMediaElement) => {
    onTimeChange?.(element.currentTime)
  }

  const sharedProps = {
    className: 'media-player',
    src: url,
    controls: true,
    preload: 'metadata' as const,
    onLoadedMetadata: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      emitCurrentTime(event.currentTarget),
    onSeeked: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      emitCurrentTime(event.currentTarget),
    onTimeUpdate: (event: React.SyntheticEvent<HTMLMediaElement>) =>
      emitCurrentTime(event.currentTarget),
  }

  if (kind === 'video') {
    return <video ref={setMediaRef} {...sharedProps} />
  }

  return <audio ref={setMediaRef} {...sharedProps} />
}
