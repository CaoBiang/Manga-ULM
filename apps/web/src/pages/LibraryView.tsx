import { Alert, Button, Card, Divider, Input, Select, Segmented, Space, Spin, Tag, Typography } from 'antd'
import type { SelectProps } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import MangaCard, { type MangaItem } from '@/components/library/MangaCard'
import MangaGrid from '@/components/library/MangaGrid'
import { useAppSettingsStore } from '@/store/appSettings'

type Pagination = {
  page: number
  per_page: number
  total_pages: number
  total_items: number
}

type LibraryQuery = {
  keyword: string
  likedFilter: 'all' | 'liked' | 'unliked'
  sortValue: string
  selectedStatuses: string[]
}

const parseSortValue = (value: string) => {
  const [by, order] = (value || '').split(':')
  return {
    by: by || 'add_date',
    order: order === 'asc' ? 'asc' : 'desc'
  }
}

export default function LibraryView() {
  const { t } = useTranslation()

  const libraryViewMode = useAppSettingsStore((state) => state.libraryViewMode)
  const setLibraryViewMode = useAppSettingsStore((state) => state.setLibraryViewMode)
  const libraryPerPage = useAppSettingsStore((state) => state.libraryPerPage)
  const setLibraryPerPage = useAppSettingsStore((state) => state.setLibraryPerPage)
  const libraryLazyRootMarginPx = useAppSettingsStore((state) => state.libraryLazyRootMarginPx)

  const [items, setItems] = useState<MangaItem[]>([])
  const [pagination, setPagination] = useState<Pagination>({ page: 1, per_page: libraryPerPage, total_pages: 1, total_items: 0 })
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  const [keyword, setKeyword] = useState('')
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [likedFilter, setLikedFilter] = useState<'all' | 'liked' | 'unliked'>('all')
  const [sortValue, setSortValue] = useState('add_date:desc')

  const loadingRef = useRef(false)
  const loadingMoreRef = useRef(false)
  const queryRef = useRef<LibraryQuery>({
    keyword: '',
    likedFilter: 'all',
    sortValue: 'add_date:desc',
    selectedStatuses: []
  })

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const keywordDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const keywordInitializedRef = useRef(false)

  const statusOptions = useMemo(
    () => [
      { value: 'all', label: t('statusAll'), color: 'default' as const },
      { value: 'unread', label: t('statusUnread'), color: 'blue' as const },
      { value: 'in_progress', label: t('statusInProgress'), color: 'orange' as const },
      { value: 'finished', label: t('statusFinished'), color: 'green' as const }
    ],
    [t]
  )

  const sortOptions = useMemo<SelectProps['options']>(
    () => [
      { label: t('sortNewest'), value: 'add_date:desc' },
      { label: t('sortOldest'), value: 'add_date:asc' },
      { label: t('sortTitleAsc'), value: 'file_path:asc' },
      { label: t('sortTitleDesc'), value: 'file_path:desc' },
      { label: t('sortLastRead'), value: 'last_read_date:desc' },
      { label: t('sortProgress'), value: 'last_read_page:desc' },
      { label: t('sortPageCountDesc'), value: 'total_pages:desc' },
      { label: t('sortPageCountAsc'), value: 'total_pages:asc' },
      { label: t('sortFileSizeDesc'), value: 'file_size:desc' },
      { label: t('sortFileSizeAsc'), value: 'file_size:asc' }
    ],
    [t]
  )

  const hasMore = useMemo(() => pagination.page < pagination.total_pages, [pagination.page, pagination.total_pages])

  useEffect(() => {
    queryRef.current = { keyword, likedFilter, sortValue, selectedStatuses }
  }, [keyword, likedFilter, selectedStatuses, sortValue])

  const fetchLibrary = useCallback(
    async ({ page, append }: { page: number; append: boolean }) => {
      if (append) {
        if (loadingRef.current || loadingMoreRef.current) return
        loadingMoreRef.current = true
        setLoadingMore(true)
      } else {
        if (loadingRef.current) return
        loadingRef.current = true
        setLoading(true)
      }

      setErrorMessage('')
      try {
        const query = queryRef.current
        const { by, order } = parseSortValue(query.sortValue)
        const params: Record<string, string | number> = {
          page,
          per_page: libraryPerPage,
          sort_by: by,
          sort_order: order
        }

        const trimmedKeyword = query.keyword.trim()
        if (trimmedKeyword) {
          params.keyword = trimmedKeyword
        }

        if (query.selectedStatuses.length) {
          params.statuses = query.selectedStatuses.join(',')
        }

        if (query.likedFilter === 'liked') {
          params.liked = 1
        } else if (query.likedFilter === 'unliked') {
          params.liked = 0
        }

        const response = await http.get('/api/v1/files', { params })
        const files = (response?.data?.files || []) as MangaItem[]
        const nextPagination = (response?.data?.pagination || {}) as Pagination

        setItems((prev) => (append ? [...prev, ...files] : files))
        setPagination({
          page: nextPagination.page || page,
          per_page: nextPagination.per_page || libraryPerPage,
          total_pages: nextPagination.total_pages || 1,
          total_items: nextPagination.total_items || files.length
        })
      } catch (error) {
        console.error('加载漫画库失败：', error)
        const messageText = (error as any)?.response?.data?.error || t('failedToLoadLibrary')
        setErrorMessage(String(messageText))
      } finally {
        if (append) {
          loadingMoreRef.current = false
          setLoadingMore(false)
        } else {
          loadingRef.current = false
          setLoading(false)
        }
      }
    },
    [libraryPerPage, t]
  )

  useEffect(() => {
    if (!keywordInitializedRef.current) {
      keywordInitializedRef.current = true
      return
    }
    if (keywordDebounceRef.current) {
      clearTimeout(keywordDebounceRef.current)
    }
    keywordDebounceRef.current = setTimeout(() => {
      setItems([])
      fetchLibrary({ page: 1, append: false }).catch(() => {})
    }, 300)
    return () => {
      if (keywordDebounceRef.current) {
        clearTimeout(keywordDebounceRef.current)
        keywordDebounceRef.current = null
      }
    }
  }, [keyword, fetchLibrary])

  useEffect(() => {
    setItems([])
    fetchLibrary({ page: 1, append: false }).catch(() => {})
  }, [likedFilter, selectedStatuses, sortValue, libraryPerPage, fetchLibrary])

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    if (!('IntersectionObserver' in window)) return

    observerRef.current?.disconnect()
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        if (!hasMore) return
        if (loading || loadingMore) return
        fetchLibrary({ page: pagination.page + 1, append: true }).catch(() => {})
      },
      { rootMargin: `${libraryLazyRootMarginPx}px 0px` }
    )
    observerRef.current.observe(sentinel)

    return () => {
      observerRef.current?.disconnect()
      observerRef.current = null
    }
  }, [fetchLibrary, hasMore, libraryLazyRootMarginPx, loading, loadingMore, pagination.page])

  const toggleStatus = (status: string) => {
    if (status === 'all') {
      setSelectedStatuses([])
      return
    }
    setSelectedStatuses((prev) => (prev.includes(status) ? prev.filter((value) => value !== status) : [...prev, status]))
  }

  const handleMetadataUpdated = (next: MangaItem) => {
    setItems((prev) => prev.map((item) => (item.id === next.id ? { ...item, ...next } : item)))
  }

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Space wrap>
            <Input
              style={{ width: 280 }}
              allowClear
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder={t('keywordPlaceholder')}
            />
            <Select style={{ width: 220 }} value={sortValue} options={sortOptions} onChange={setSortValue} />
            <Select
              style={{ width: 160 }}
              value={likedFilter}
              onChange={(value) => setLikedFilter(value)}
              options={[
                { value: 'all', label: t('likedFilterAll') },
                { value: 'liked', label: t('likedFilterOnly') },
                { value: 'unliked', label: t('likedFilterNot') }
              ]}
            />
            <Select
              style={{ width: 160 }}
              value={libraryPerPage}
              onChange={(value) => setLibraryPerPage(value).catch(() => {})}
              options={[20, 50, 100, 200].map((value) => ({ value, label: `${value}` }))}
            />
            <Segmented
              value={libraryViewMode}
              onChange={(value) => setLibraryViewMode(value as any).catch(() => {})}
              options={[
                { value: 'grid', label: t('viewGrid') },
                { value: 'list', label: t('viewList') }
              ]}
            />
          </Space>

          <Divider className="my-0" />

          <Space wrap>
            {statusOptions.map((option) => {
              const active = option.value === 'all' ? selectedStatuses.length === 0 : selectedStatuses.includes(option.value)
              return (
                <Tag
                  key={option.value}
                  color={active && option.value !== 'all' ? option.color : undefined}
                  className={active ? 'cursor-pointer' : 'cursor-pointer opacity-60'}
                  onClick={() => toggleStatus(option.value)}
                >
                  {option.label}
                </Tag>
              )
            })}
          </Space>
        </Space>
      </Card>

      {errorMessage ? <Alert type="error" showIcon message={errorMessage} /> : null}

      <Card>
        {loading ? (
          <div className="flex justify-center py-12">
            <Spin size="large" tip={t('loadingLibrary')} />
          </div>
        ) : items.length ? (
          libraryViewMode === 'grid' ? (
            <MangaGrid>
              {items.map((item) => (
                <MangaCard key={item.id} manga={item} viewMode="grid" onMetadataUpdated={handleMetadataUpdated} />
              ))}
            </MangaGrid>
          ) : (
            <Space direction="vertical" size="middle" className="w-full">
              {items.map((item) => (
                <MangaCard key={item.id} manga={item} viewMode="list" onMetadataUpdated={handleMetadataUpdated} />
              ))}
            </Space>
          )
        ) : (
          <Alert type="info" showIcon message={t('noMangaFound')} description={t('noMangaFoundTip')} />
        )}

        <div className="mt-6 flex flex-col items-center gap-3">
          {loadingMore ? <Spin tip={t('loadingMore')} /> : null}
          {!loadingMore && hasMore ? (
            <Button onClick={() => fetchLibrary({ page: pagination.page + 1, append: true }).catch(() => {})}>{t('loadMore')}</Button>
          ) : null}
          {!loadingMore && !hasMore && items.length ? <Typography.Text type="secondary">{t('noMoreManga')}</Typography.Text> : null}
          {items.length ? (
            <Typography.Text type="secondary">
              {t('loadedCount', { loaded: items.length, total: pagination.total_items || items.length })}
            </Typography.Text>
          ) : null}
          <div ref={sentinelRef} style={{ height: 1, width: 1 }} />
        </div>
      </Card>
    </Space>
  )
}
