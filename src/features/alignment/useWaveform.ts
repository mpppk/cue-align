import { useEffect, useState } from 'react'

import { createWaveformPeaks } from './waveform'

const DEFAULT_PEAK_COUNT = 192

type WaveformLoadingState = {
  status: 'loading'
}

type WaveformReadyState = {
  status: 'ready'
  duration: number
  peaks: ReadonlyArray<number>
}

type WaveformErrorState = {
  status: 'error'
  message: string
}

export type WaveformState =
  | WaveformLoadingState
  | WaveformReadyState
  | WaveformErrorState

export const useWaveform = (
  file: File,
  peakCount = DEFAULT_PEAK_COUNT,
): WaveformState => {
  const [state, setState] = useState<WaveformState>({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    let audioContext: AudioContext | undefined

    setState({ status: 'loading' })

    const decode = async () => {
      try {
        audioContext = new AudioContext()
        const encoded = await file.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(encoded)
        const channels = Array.from(
          { length: audioBuffer.numberOfChannels },
          (_, channelIndex) => audioBuffer.getChannelData(channelIndex),
        )

        if (!cancelled) {
          setState({
            status: 'ready',
            duration: audioBuffer.duration,
            peaks: createWaveformPeaks(channels, peakCount),
          })
        }
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'error',
            message:
              error instanceof Error
                ? error.message
                : 'The media could not be decoded for waveform display.',
          })
        }
      } finally {
        if (audioContext !== undefined && audioContext.state !== 'closed') {
          await audioContext.close().catch(() => undefined)
        }
      }
    }

    void decode()

    return () => {
      cancelled = true
      if (audioContext !== undefined && audioContext.state !== 'closed') {
        void audioContext.close().catch(() => undefined)
      }
    }
  }, [file, peakCount])

  return state
}
