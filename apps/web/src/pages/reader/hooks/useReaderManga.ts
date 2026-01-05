import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'

type MangaFile = {
  id: number
  file_path: string
  total_pages: number
  last_read_page: number | null
}

type DebouncedFn = (() => void) & { flush: () => void; cancel: () => void }

const debounce = (fn: () => void, delayMs: number): DebouncedFn => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debounced = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      timeoutId = null
      fn()
    }, delayMs)
  }

  debounced.flush = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
    fn()
  }

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debounced
}

export type ReaderMangaState = {
  currentPage: number
  totalPages: number
  isLoading: boolean
  error: string
  imageUrl: string
  setCurrentPage: (page: number) => void
  refresh: () => Promise<void>
}

export const useReaderManga = ({
  fileId,
  preloadAhead
}: {
  fileId: string | undefined
  preloadAhead: number
}): ReaderMangaState => {
  const { t } = useTranslation()

  const [currentPage, setCurrentPageInternal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const currentPageRef = useRef(currentPage)
  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  const preloadedImagesRef = useRef<Record<number, HTMLImageElement>>({})

  const clampPage = useCallback(
    (page: number) => {
      if (!Number.isFinite(page)) return 0
      if (!totalPages) return 0
      return Math.min(totalPages - 1, Math.max(0, Math.floor(page)))
    },
    [totalPages]
  )

  const setCurrentPage = useCallback(
    (page: number) => {
      setCurrentPageInternal(clampPage(page))
    },
    [clampPage]
  )

  const refresh = useCallback(async () => {
    if (!fileId) return
    setIsLoading(true)
    setError('')
    try {
      const response = await http.get(`/api/v1/files/${fileId}`)
      const fileData = response?.data as MangaFile | null
      if (!fileData) {
        throw new Error(t('mangaNotFound'))
      }
      const pageCount = Number(fileData.total_pages || 0)
      const last = Number(fileData.last_read_page || 0)
      setTotalPages(pageCount)
      setCurrentPageInternal(pageCount ? Math.min(pageCount - 1, Math.max(0, last)) : 0)
    } catch (err) {
      console.error('获取漫画详情失败：', err)
      setError((err as any)?.response?.data?.error || t('failedToLoadMangaDetails'))
    } finally {
      setIsLoading(false)
    }
  }, [fileId, t])

  useEffect(() => {
    setCurrentPageInternal(0)
    setTotalPages(0)
    setIsLoading(true)
    setError('')
    preloadedImagesRef.current = {}
    if (!fileId) {
      setIsLoading(false)
      return
    }
    refresh().catch(() => {})
  }, [fileId, refresh])

  const updateProgress = useCallback(() => {
    if (!fileId) return
    http
      .patch(`/api/v1/files/${fileId}`, { last_read_page: currentPageRef.current })
      .catch((err) => console.error('保存阅读进度失败：', err))
  }, [fileId])

  const debouncedUpdateProgress = useMemo(() => debounce(updateProgress, 1500), [updateProgress])

  useEffect(() => {
    if (!fileId) return
    debouncedUpdateProgress()
  }, [currentPage, debouncedUpdateProgress, fileId])

  useEffect(() => {
    return () => {
      debouncedUpdateProgress.flush()
    }
  }, [debouncedUpdateProgress])

  useEffect(() => {
    if (!fileId) return
    if (!totalPages) return

    const ahead = Math.max(0, Number(preloadAhead) || 0)
    if (!ahead) return

    for (let i = 1; i <= ahead; i += 1) {
      const pageToLoad = currentPageRef.current + i
      if (pageToLoad < totalPages && !preloadedImagesRef.current[pageToLoad]) {
        const img = new Image()
        img.src = `/api/v1/files/${fileId}/pages/${pageToLoad}`
        preloadedImagesRef.current[pageToLoad] = img
      }
    }
  }, [currentPage, fileId, preloadAhead, totalPages])

  const imageUrl = useMemo(() => {
    if (!fileId || !totalPages) return ''
    return `/api/v1/files/${fileId}/pages/${currentPage}`
  }, [currentPage, fileId, totalPages])

  return {
    currentPage,
    totalPages,
    isLoading,
    error,
    imageUrl,
    setCurrentPage,
    refresh
  }
}

