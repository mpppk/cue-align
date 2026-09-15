import { useEffect, useState } from 'react'

export const useLocalMediaUrl = (
  file: Blob | undefined,
): string | undefined => {
  const [url, setUrl] = useState<string>()

  useEffect(() => {
    if (file === undefined) {
      setUrl(undefined)
      return
    }

    const nextUrl = URL.createObjectURL(file)
    setUrl(nextUrl)

    return () => {
      URL.revokeObjectURL(nextUrl)
    }
  }, [file])

  return url
}
