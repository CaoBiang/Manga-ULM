import { EditOutlined, HeartFilled, HeartOutlined, ReadOutlined } from '@ant-design/icons'
import { Button, Card, Progress, Segmented, Space, Tag, Typography, message } from 'antd'
import type { SegmentedProps } from 'antd'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { http } from '@/api/http'
import { useAppSettingsStore } from '@/store/appSettings'
import type { LibraryCardFieldKey } from '@/store/uiSettings'
import { useUiSettingsStore } from '@/store/uiSettings'

export type MangaTag = {
  id: number
  name: string
  type_id: number
}

export type MangaItem = {
  id: number
  file_path?: string | null
  display_name?: string | null
  folder_name?: string | null
  cover_url?: string | null
  file_size?: number | null
  total_pages?: number | null
  last_read_page?: number | null
  last_read_date?: string | null
  add_date?: string | null
  liked_at?: string | null
  reading_status?: 'unread' | 'in_progress' | 'finished' | string | null
  progress_percent?: number | null
  is_liked?: boolean | null
  tags?: MangaTag[] | null
}

export type MangaCardProps = {
  manga: MangaItem
  hideWishlistButton?: boolean
  viewMode?: 'grid' | 'list'
  onMetadataUpdated?: (next: MangaItem) => void
}

const statusOrder = ['unread', 'in_progress', 'finished'] as const

const escapeXml = (value: unknown) =>
  String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')

const formatDateTime = (value: string | null | undefined) => {
  if (!value) {
    return ''
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return date.toLocaleString()
}

export default function MangaCard({ manga, hideWishlistButton = false, viewMode = 'grid', onMetadataUpdated }: MangaCardProps) {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const libraryLazyRootMarginPx = useAppSettingsStore((state) => state.libraryLazyRootMarginPx)
  const libraryCardFields = useUiSettingsStore((state) => state.libraryCardFields)
  const libraryAuthorTagTypeId = useUiSettingsStore((state) => state.libraryAuthorTagTypeId)

  const visibleFields = useMemo<LibraryCardFieldKey[]>(
    () => (viewMode === 'list' ? libraryCardFields.list : libraryCardFields.grid),
    [libraryCardFields.grid, libraryCardFields.list, viewMode]
  )

  const hasField = (key: LibraryCardFieldKey) => visibleFields.includes(key)
  const hasAnyField = (keys: LibraryCardFieldKey[]) => keys.some((key) => hasField(key))

  const sizeUnits = useMemo(() => [t('sizeUnitB'), t('sizeUnitKB'), t('sizeUnitMB'), t('sizeUnitGB'), t('sizeUnitTB')], [t])

  const formatBytes = (bytes: number | null | undefined, decimals = 2) => {
    if (!bytes) {
      return `0 ${sizeUnits[0]}`
    }
    const k = 1024
    const dm = decimals < 0 ? 0 : decimals
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    const value = Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
    const unit = sizeUnits[i] || sizeUnits[sizeUnits.length - 1]
    return `${value} ${unit}`
  }

  const fallbackCover = useMemo(() => {
    const label = escapeXml(t('noCoverPlaceholder'))
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="300" height="400" viewBox="0 0 300 400">
        <rect width="300" height="400" fill="#1f1f1f"/>
        <rect x="18" y="18" width="264" height="364" rx="16" fill="#2a2a2a" stroke="#3a3a3a"/>
        <text x="150" y="206" text-anchor="middle" dominant-baseline="middle"
          fill="#9b9b9b" font-size="18" font-family="system-ui, -apple-system, Segoe UI, sans-serif">
          ${label}
        </text>
      </svg>
    `.trim()
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
  }, [t])

  const coverHostRef = useRef<HTMLDivElement | null>(null)
  const coverObserverRef = useRef<IntersectionObserver | null>(null)
  const [shouldLoadCover, setShouldLoadCover] = useState(false)

  const [isLiked, setIsLiked] = useState(Boolean(manga.is_liked))
  const [localStatus, setLocalStatus] = useState((manga.reading_status as any) || 'unread')
  const [progressPercent, setProgressPercent] = useState<number>(manga.progress_percent ?? 0)
  const [localLastReadPage, setLocalLastReadPage] = useState<number>(manga.last_read_page ?? 0)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [updatingLike, setUpdatingLike] = useState(false)

  useEffect(() => {
    setIsLiked(Boolean(manga.is_liked))
  }, [manga.is_liked])

  useEffect(() => {
    setLocalStatus((manga.reading_status as any) || 'unread')
  }, [manga.reading_status])

  useEffect(() => {
    setProgressPercent(manga.progress_percent ?? 0)
  }, [manga.progress_percent])

  useEffect(() => {
    setLocalLastReadPage(manga.last_read_page ?? 0)
  }, [manga.last_read_page])

  useEffect(() => {
    setShouldLoadCover(false)
  }, [manga.cover_url, viewMode])

  useEffect(() => {
    if (shouldLoadCover) {
      return
    }
    if (typeof window === 'undefined') {
      setShouldLoadCover(true)
      return
    }
    const host = coverHostRef.current
    if (!host) {
      return
    }
    if (!('IntersectionObserver' in window)) {
      setShouldLoadCover(true)
      return
    }

    coverObserverRef.current?.disconnect()
    coverObserverRef.current = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoadCover(true)
          coverObserverRef.current?.disconnect()
          coverObserverRef.current = null
        }
      },
      { rootMargin: `${libraryLazyRootMarginPx}px 0px` }
    )
    coverObserverRef.current.observe(host)

    return () => {
      coverObserverRef.current?.disconnect()
      coverObserverRef.current = null
    }
  }, [libraryLazyRootMarginPx, shouldLoadCover])

  const fileName = useMemo(() => (manga.file_path ? manga.file_path.split(/[\\/]/).pop() || '' : ''), [manga.file_path])
  const displayName = useMemo(() => manga.display_name || fileName || `#${manga.id}`, [fileName, manga.display_name, manga.id])
  const folderName = useMemo(() => manga.folder_name || '', [manga.folder_name])
  const tags = useMemo(() => (Array.isArray(manga.tags) ? manga.tags : []), [manga.tags])
  const authorTags = useMemo(() => {
    if (!libraryAuthorTagTypeId) {
      return []
    }
    return tags.filter((tag) => tag.type_id === libraryAuthorTagTypeId)
  }, [libraryAuthorTagTypeId, tags])

  const normalizedProgress = useMemo(() => Math.min(100, Math.max(0, progressPercent ?? 0)), [progressPercent])
  const progressPercentDisplay = useMemo(() => `${Math.round(normalizedProgress)}%`, [normalizedProgress])

  const statusMetaMap = useMemo(
    () => ({
      unread: { label: t('statusUnread'), short: t('statusUnreadShort'), color: 'default' as const, progress: '#bfbfbf' },
      in_progress: { label: t('statusInProgress'), short: t('statusInProgressShort'), color: 'orange' as const, progress: '#faad14' },
      finished: { label: t('statusFinished'), short: t('statusFinishedShort'), color: 'green' as const, progress: '#52c41a' }
    }),
    [t]
  )

  const resolvedStatusKey = useMemo(() => {
    const raw = String(localStatus || '').trim().toLowerCase()
    return (raw === 'in_progress' || raw === 'finished' || raw === 'unread' ? raw : 'unread') as 'unread' | 'in_progress' | 'finished'
  }, [localStatus])

  const statusMeta = statusMetaMap[resolvedStatusKey]

  const totalPages = useMemo(() => Number(manga.total_pages || 0), [manga.total_pages])
  const lastReadPage = useMemo(() => Number(localLastReadPage || 0), [localLastReadPage])

  const progressSummary = useMemo(() => {
    const total = Math.max(0, totalPages)
    if (resolvedStatusKey === 'finished') {
      return t('progressFinished')
    }
    if (resolvedStatusKey === 'unread') {
      return t('progressUnread')
    }
    return t('progressCurrent', { page: Math.min(total, lastReadPage + 1), total })
  }, [lastReadPage, resolvedStatusKey, t, totalPages])

  const applyServerUpdate = (payload: Partial<MangaItem> | null | undefined) => {
    if (!payload) {
      return
    }
    setLocalStatus((payload.reading_status as any) || localStatus)
    setProgressPercent(payload.progress_percent ?? progressPercent)
    setLocalLastReadPage(payload.last_read_page ?? localLastReadPage)
    setIsLiked(payload.is_liked ?? isLiked)
    onMetadataUpdated?.({ ...manga, ...payload })
  }

  const updateStatus = async (status: string) => {
    if (updatingStatus || !status) {
      return
    }
    setUpdatingStatus(true)
    try {
      const response = await http.patch(`/api/v1/files/${manga.id}`, { reading_status: status })
      applyServerUpdate(response.data)
    } catch (error) {
      console.error('更新阅读状态失败：', error)
      message.error(t('failedToUpdateStatus'))
    } finally {
      setUpdatingStatus(false)
    }
  }

  const cycleStatus = async (event?: { stopPropagation?: () => void; preventDefault?: () => void }) => {
    event?.stopPropagation?.()
    event?.preventDefault?.()
    const currentIndex = Math.max(0, statusOrder.indexOf(resolvedStatusKey))
    const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length]
    await updateStatus(nextStatus)
  }

  const setStatus: SegmentedProps['onChange'] = async (value) => {
    await updateStatus(String(value))
  }

  const toggleLike = async (event?: { stopPropagation?: () => void; preventDefault?: () => void }) => {
    event?.stopPropagation?.()
    event?.preventDefault?.()
    if (updatingLike) {
      return
    }

    const originalLikedState = isLiked
    const next = !isLiked
    setIsLiked(next)
    setUpdatingLike(true)

    try {
      if (next) {
        await http.put(`/api/v1/likes/${manga.id}`)
      } else {
        await http.delete(`/api/v1/likes/${manga.id}`)
      }
      onMetadataUpdated?.({
        ...manga,
        is_liked: next,
        liked_at: next ? new Date().toISOString() : null
      })
    } catch (error) {
      setIsLiked(originalLikedState)
      console.error('更新喜欢状态失败：', error)
      message.error(t('failedToToggleLike'))
    } finally {
      setUpdatingLike(false)
    }
  }

  const openReader = () => {
    navigate(`/reader/${manga.id}`)
  }

  const openEdit = (event?: { stopPropagation?: () => void; preventDefault?: () => void }) => {
    event?.stopPropagation?.()
    event?.preventDefault?.()
    navigate(`/edit/${manga.id}`)
  }

  const readButton = (
    <Button type="primary" icon={<ReadOutlined />} onClick={(event) => openReader()}>
      {t('read')}
    </Button>
  )

  const editButton = (
    <Button icon={<EditOutlined />} onClick={(event) => openEdit(event as any)}>
      {t('edit')}
    </Button>
  )

  const statusButtons = useMemo<SegmentedProps['options']>(
    () => [
      { value: 'unread', label: statusMetaMap.unread.short },
      { value: 'in_progress', label: statusMetaMap.in_progress.short },
      { value: 'finished', label: statusMetaMap.finished.short }
    ],
    [statusMetaMap]
  )

  const statsLine = useMemo(() => {
    const parts: string[] = []
    if (hasField('file_size')) {
      parts.push(formatBytes(manga.file_size ?? 0))
    }
    if (hasField('total_pages') && typeof manga.total_pages === 'number') {
      parts.push(`${manga.total_pages} ${t('pages')}`)
    }
    if (hasField('last_read_date')) {
      const value = formatDateTime(manga.last_read_date)
      if (value) {
        parts.push(`${t('lastReadAt')}: ${value}`)
      }
    }
    if (hasField('add_date')) {
      const value = formatDateTime(manga.add_date)
      if (value) {
        parts.push(`${t('addedAtLabel')}: ${value}`)
      }
    }
    if (hasField('liked_at') && isLiked) {
      const value = formatDateTime(manga.liked_at)
      if (value) {
        parts.push(`${t('likedAtLabel')}: ${value}`)
      }
    }
    return parts
  }, [formatBytes, hasField, isLiked, manga.add_date, manga.file_size, manga.last_read_date, manga.liked_at, manga.total_pages, t])

  const coverImage = useMemo(() => {
    const coverUrl = manga.cover_url || ''
    if (!shouldLoadCover || !coverUrl) {
      return <div className="manga-card-cover__placeholder" />
    }
    return <img src={coverUrl} alt={displayName} loading="lazy" onError={(event) => ((event.currentTarget.src = fallbackCover), undefined)} />
  }, [displayName, fallbackCover, manga.cover_url, shouldLoadCover])

  const progressBar =
    hasField('progress_bar') && totalPages > 0 ? (
      <Progress percent={Math.round(normalizedProgress)} showInfo={false} strokeColor={statusMeta.progress} />
    ) : null

  const progressSummaryNode = hasField('progress_summary') ? (
    <Typography.Text type="secondary" className="manga-card-list__summary">
      {progressSummary}
    </Typography.Text>
  ) : null

  const authorNode =
    hasField('authors') && authorTags.length ? (
      <Space wrap className="manga-card-grid__tags">
        {authorTags.map((tag) => (
          <Tag key={`author-${tag.id}`}>{tag.name}</Tag>
        ))}
      </Space>
    ) : null

  if (viewMode === 'list') {
    return (
      <Card hoverable className="manga-card-list" onClick={openReader}>
        <div className="manga-card-list__grid">
          <div className="manga-card-list__cover" ref={coverHostRef}>
            {coverImage}
            {!hideWishlistButton ? (
              <Button
                type="text"
                shape="circle"
                size="small"
                className="manga-card-list__like"
                loading={updatingLike}
                onClick={(event) => toggleLike(event as any)}
              >
                {isLiked ? <HeartFilled style={{ color: '#f5222d' }} /> : <HeartOutlined />}
              </Button>
            ) : null}
          </div>

          <div className="manga-card-list__content">
            <div className="manga-card-list__header">
              <Typography.Text strong className="manga-card-list__title" onClick={(event) => (event.stopPropagation(), openReader())}>
                {displayName}
              </Typography.Text>
              {hasField('reading_status_tag') ? (
                <Tag className="manga-card-list__status" color={statusMeta.color} onClick={(event) => cycleStatus(event as any)}>
                  {statusMeta.label}
                </Tag>
              ) : null}
            </div>

            {hasField('folder_name') && folderName ? (
              <Typography.Text type="secondary" className="manga-card-list__folder">
                {folderName}
              </Typography.Text>
            ) : null}

            {hasAnyField(['progress_percent', 'progress_bar']) ? (
              <div className="manga-card-list__progress">
                {hasField('progress_percent') ? <Typography.Text>{progressPercentDisplay}</Typography.Text> : null}
                <div className="flex-1">{progressBar}</div>
              </div>
            ) : null}

            {progressSummaryNode}
            {authorNode}

            {statsLine.length ? (
              <Typography.Text type="secondary" className="manga-card-list__stats">
                {statsLine.join(' · ')}
              </Typography.Text>
            ) : null}

            {tags.length ? (
              <div className="manga-card-list__tags">
                {tags.map((tag) => (
                  <Tag key={`list-tag-${tag.id}`}>{tag.name}</Tag>
                ))}
              </div>
            ) : null}

            <div className="manga-card-list__actions">
              <Space wrap>
                {readButton}
                {editButton}
              </Space>
              <Segmented
                className="manga-card-list__status-switcher"
                size="small"
                block
                value={resolvedStatusKey}
                options={statusButtons}
                disabled={updatingStatus}
                onChange={setStatus}
              />
            </div>
          </div>
        </div>
      </Card>
    )
  }

  const coverEditOverlay = (
    <div className="manga-card-grid__cover-edit">
      <Button type="primary" size="small" block icon={<EditOutlined />} onClick={(event) => openEdit(event as any)}>
        {t('edit')}
      </Button>
    </div>
  )

  const cardBodyStyle = useMemo(() => ({ padding: '12px' } as CSSProperties), [])

  return (
    <div className="manga-card-grid">
      <Card hoverable className="manga-card-grid__card" bodyStyle={cardBodyStyle} onClick={openReader}>
        <div ref={coverHostRef} className="manga-card-grid__cover">
          {coverImage}
          {hasField('reading_status_tag') ? (
            <Tag className="manga-card-grid__status" color={statusMeta.color} onClick={(event) => cycleStatus(event as any)}>
              {statusMeta.label}
            </Tag>
          ) : null}
          {!hideWishlistButton ? (
            <Button
              type="text"
              shape="circle"
              size="small"
              className="manga-card-grid__like"
              loading={updatingLike}
              onClick={(event) => toggleLike(event as any)}
            >
              {isLiked ? <HeartFilled style={{ color: '#f5222d' }} /> : <HeartOutlined />}
            </Button>
          ) : null}
          {coverEditOverlay}
        </div>

        <div className="manga-card-grid__meta">
          <div className="manga-card-grid__row">
            <Typography.Text strong ellipsis title={displayName}>
              {displayName}
            </Typography.Text>
          </div>

          {hasAnyField(['progress_percent', 'progress_bar', 'progress_summary']) ? (
            <Space direction="vertical" size={4} className="w-full">
              {hasField('progress_percent') ? <Typography.Text type="secondary">{progressPercentDisplay}</Typography.Text> : null}
              {progressBar}
              {progressSummaryNode}
            </Space>
          ) : null}

          {hasField('folder_name') && folderName ? (
            <Typography.Text type="secondary" ellipsis title={folderName}>
              {folderName}
            </Typography.Text>
          ) : null}

          {authorNode}

          {statsLine.length ? (
            <Typography.Text type="secondary" className="manga-card-grid__stats">
              {statsLine.join(' · ')}
            </Typography.Text>
          ) : null}

          {tags.length ? (
            <Space wrap className="manga-card-grid__tags">
              {tags.slice(0, 6).map((tag) => (
                <Tag key={`grid-tag-${tag.id}`}>{tag.name}</Tag>
              ))}
            </Space>
          ) : null}
        </div>
      </Card>
    </div>
  )
}

