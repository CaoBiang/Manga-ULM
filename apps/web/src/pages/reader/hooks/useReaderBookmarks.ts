import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'

export type BookmarkRecord = {
  id: number
  page_number: number
  note: string | null
}

export type ReaderBookmarksState = {
  bookmarks: BookmarkRecord[]
  refresh: () => Promise<void>
  isBookmarked: (pageNumber: number) => boolean
  add: (payload: { pageNumber: number; note: string | null }) => Promise<BookmarkRecord>
  update: (payload: { bookmarkId: number; note: string | null }) => Promise<void>
  remove: (bookmarkId: number) => Promise<void>
}

export const useReaderBookmarks = (fileId: string | undefined): ReaderBookmarksState => {
  const { t } = useTranslation()
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([])

  const refresh = useCallback(async () => {
    if (!fileId) {
      setBookmarks([])
      return
    }
    try {
      const response = await http.get(`/api/v1/files/${fileId}/bookmarks`)
      const list = (response?.data || []) as BookmarkRecord[]
      setBookmarks(list.slice().sort((a, b) => a.page_number - b.page_number))
    } catch (err) {
      console.error('获取书签失败：', err)
      setBookmarks([])
      throw new Error((err as any)?.response?.data?.error || t('failedToFetchBookmarks'))
    }
  }, [fileId, t])

  useEffect(() => {
    setBookmarks([])
    if (fileId) {
      refresh().catch(() => {})
    }
  }, [fileId, refresh])

  const isBookmarked = useMemo(() => {
    const set = new Set(bookmarks.map((b) => b.page_number))
    return (pageNumber: number) => set.has(pageNumber)
  }, [bookmarks])

  const add = useCallback(
    async ({ pageNumber, note }: { pageNumber: number; note: string | null }) => {
      if (!fileId) {
        throw new Error(t('mangaNotFound'))
      }
      const response = await http.post(`/api/v1/files/${fileId}/bookmarks`, {
        page_number: pageNumber,
        note: note || null
      })
      const record = response?.data as BookmarkRecord
      setBookmarks((prev) => prev.concat([record]).slice().sort((a, b) => a.page_number - b.page_number))
      return record
    },
    [fileId, t]
  )

  const update = useCallback(async ({ bookmarkId, note }: { bookmarkId: number; note: string | null }) => {
    await http.put(`/api/v1/bookmarks/${bookmarkId}`, { note: note || null })
  }, [])

  const remove = useCallback(
    async (bookmarkId: number) => {
      await http.delete(`/api/v1/bookmarks/${bookmarkId}`)
      setBookmarks((prev) => prev.filter((b) => b.id !== bookmarkId))
    },
    []
  )

  return {
    bookmarks,
    refresh,
    isBookmarked,
    add,
    update,
    remove
  }
}

