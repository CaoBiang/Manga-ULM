import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'

type MangaFile = {
  id: number
  file_path: string
  file_size: number
  file_mtime: number
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
  preloadAhead,
  preloadConcurrency,
  isCurrentImageLoaded,
  renderOptions
}: {
  fileId: string | undefined
  preloadAhead: number
  preloadConcurrency: number
  isCurrentImageLoaded: boolean
  renderOptions: {
    maxSidePx: number
    format: string
    quality: number
    resample: string
  }
}): ReaderMangaState => {
  const { t } = useTranslation()

  const [currentPage, setCurrentPageInternal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [fileVersion, setFileVersion] = useState('')

  const currentPageRef = useRef(currentPage)
  useEffect(() => {
    currentPageRef.current = currentPage
  }, [currentPage])

  const preloadedImagesRef = useRef<Record<number, HTMLImageElement>>({})
  const preloadTokenRef = useRef(0)

  const renderQuery = useMemo(() => {
    const maxSidePx = Math.max(0, Math.floor(Number(renderOptions?.maxSidePx ?? 0)) || 0)
    const format = String(renderOptions?.format ?? 'webp')
      .trim()
      .toLowerCase()
    const quality = Math.max(1, Math.min(100, Math.floor(Number(renderOptions?.quality ?? 82)) || 82))
    const resample = String(renderOptions?.resample ?? 'lanczos')
      .trim()
      .toLowerCase()

    const params = new URLSearchParams()
    params.set('max_side_px', String(maxSidePx))
    params.set('format', format)
    params.set('quality', String(quality))
    params.set('resample', resample)
    if (fileVersion) {
      params.set('v', fileVersion)
    }
    return params.toString()
  }, [fileVersion, renderOptions?.format, renderOptions?.maxSidePx, renderOptions?.quality, renderOptions?.resample])

  const buildPageUrl = useCallback(
    (page: number) => {
      if (!fileId) return ''
      const baseUrl = `/api/v1/files/${fileId}/pages/${page}`
      return renderQuery ? `${baseUrl}?${renderQuery}` : baseUrl
    },
    [fileId, renderQuery]
  )

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
      const version = `${Number(fileData.file_mtime || 0)}-${Number(fileData.file_size || 0)}`
      const pageCount = Number(fileData.total_pages || 0)
      const last = Number(fileData.last_read_page || 0)
      setTotalPages(pageCount)
      setFileVersion(version)
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
    setFileVersion('')
    preloadedImagesRef.current = {}
    if (!fileId) {
      setIsLoading(false)
      return
    }
    refresh().catch(() => {})
  }, [fileId, refresh])

  useEffect(() => {
    // 切换渲染参数后，清空预加载缓存，避免复用旧 URL 对应的图片对象。
    preloadedImagesRef.current = {}
  }, [fileId, renderQuery])

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

    const around = Math.max(0, Number(preloadAhead) || 0)
    if (!around) return
    if (!isCurrentImageLoaded) return

    // 说明：缩放渲染会占用 CPU，若同时并发预加载太多页会明显拖慢“当前页”的出图速度。
    // 这里做两件事：
    // 1) 仅在当前页加载完成后再启动预加载；
    // 2) 通过并发上限对请求做节流，让预加载“悄悄跑在后台”。
    preloadTokenRef.current += 1
    const token = preloadTokenRef.current

    const resolvedConcurrency = Math.max(1, Math.min(6, Math.floor(Number(preloadConcurrency) || 1)))

    const pages: number[] = []
    // 优先预加载后续页（翻页最常见），再补全前面页（便于回退）。
    for (let i = 1; i <= around; i += 1) {
      pages.push(currentPageRef.current + i)
    }
    for (let i = 1; i <= around; i += 1) {
      pages.push(currentPageRef.current - i)
    }

    const seen = new Set<number>()
    const queue = pages.filter((page) => {
      if (page < 0 || page >= totalPages) return false
      if (seen.has(page)) return false
      seen.add(page)
      return !preloadedImagesRef.current[page]
    })

    if (!queue.length) return

    let inFlight = 0
    let cancelled = false

    const pump = () => {
      if (cancelled) return
      if (preloadTokenRef.current !== token) return

      while (inFlight < resolvedConcurrency && queue.length) {
        const nextPage = queue.shift()
        if (nextPage === undefined) break

        inFlight += 1
        const img = new Image()
        const done = () => {
          inFlight -= 1
          pump()
        }
        img.onload = done
        img.onerror = done
        img.src = buildPageUrl(nextPage)
        preloadedImagesRef.current[nextPage] = img
      }
    }

    const kickoffId = window.setTimeout(() => {
      pump()
    }, 120)

    return () => {
      cancelled = true
      window.clearTimeout(kickoffId)
    }
  }, [buildPageUrl, currentPage, fileId, isCurrentImageLoaded, preloadAhead, preloadConcurrency, totalPages])

  const imageUrl = useMemo(() => {
    if (!fileId || !totalPages) return ''
    return buildPageUrl(currentPage)
  }, [buildPageUrl, currentPage, fileId, totalPages])

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
