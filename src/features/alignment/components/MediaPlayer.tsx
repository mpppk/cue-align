import type { Ref } from 'react'

import { useLocalMediaUrl } from '../useMedia'

type MediaPlayerProps = {
  file: File
  mediaRef?: Ref<HTMLAudioElement>
  onTimeChange?: (currentTime: number) => void
}

export function MediaPlayer({
  file,
  mediaRef,
  onTimeChange,
}: MediaPlayerProps) {
  const url = useLocalMediaUrl(file)

  const emitCurrentTime = (element: HTMLAudioElement) => {
    onTimeChange?.(element.currentTime)
  }

  return (
    <audio
      ref={mediaRef}
      className="media-player"
      src={url}
      controls
      preload="metadata"
      onLoadedMetadata={(event) => emitCurrentTime(event.currentTarget)}
      onSeeked={(event) => emitCurrentTime(event.currentTarget)}
      onTimeUpdate={(event) => emitCurrentTime(event.currentTarget)}
    />
  )
}
