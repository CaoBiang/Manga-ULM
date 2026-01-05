import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'

export type FileInfoResponse = {
  manga_filename: string
  manga_filesize: number
  page_filename: string
  page_filesize: number
}

export type ReaderFileInfoState = {
  loading: boolean
  error: string
  data: FileInfoResponse | null
  reset: () => void
  fetch: (pageNumber: number) => Promise<void>
}

export const useReaderFileInfo = (fileId: string | undefined): ReaderFileInfoState => {
  const { t } = useTranslation()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<FileInfoResponse | null>(null)

  const seqRef = useRef(0)

  const reset = useCallback(() => {
    setLoading(false)
    setError('')
    setData(null)
  }, [])

  useEffect(() => {
    reset()
  }, [fileId, reset])

  const fetch = useCallback(
    async (pageNumber: number) => {
      if (!fileId) {
        reset()
        return
      }

      const requestSeq = (seqRef.current += 1)
      setLoading(true)
      setError('')
      try {
        const response = await http.get(`/api/v1/files/${fileId}/pages/${pageNumber}/metadata`)
        if (requestSeq !== seqRef.current) return
        setData((response?.data || null) as FileInfoResponse | null)
      } catch (err) {
        if (requestSeq !== seqRef.current) return
        console.error('获取文件信息失败：', err)
        setData(null)
        setError((err as any)?.response?.data?.error || t('failedToLoadFileInfo'))
      } finally {
        if (requestSeq === seqRef.current) {
          setLoading(false)
        }
      }
    },
    [fileId, reset, t]
  )

  return {
    loading,
    error,
    data,
    reset,
    fetch
  }
}

