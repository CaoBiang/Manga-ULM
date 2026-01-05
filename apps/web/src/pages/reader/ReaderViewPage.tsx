import { ArrowLeftOutlined } from '@ant-design/icons'
import { Alert, Spin, Tag, message } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import ReaderTapZonesConfigurator from '@/components/reader/tapZones/ReaderTapZonesConfigurator'
import ReaderTapZonesLayer from '@/components/reader/tapZones/ReaderTapZonesLayer'
import ReaderButton from '@/components/reader/ui/ReaderButton'
import ReaderToolbar, { type ReaderPanelKey } from '@/pages/reader/ReaderToolbar'
import { type BookmarkRecord, useReaderBookmarks } from '@/pages/reader/hooks/useReaderBookmarks'
import { useReaderFileInfo } from '@/pages/reader/hooks/useReaderFileInfo'
import { useReaderManga } from '@/pages/reader/hooks/useReaderManga'
import { useReaderStyleVars } from '@/pages/reader/hooks/useReaderStyleVars'
import { DEFAULT_READER_TAP_ZONES, type ReaderTapZoneAction, type ReaderTapZoneKey, type ReaderTapZonesConfig } from '@/store/appSettings'
import { useAppSettingsStore } from '@/store/appSettings'

const formatBytes = (bytes: number, units: string[], decimals = 2) => {
  if (!bytes) {
    return `0 ${units[0]}`
  }
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
  const unit = units[i] || units[units.length - 1]
  return `${value} ${unit}`
}

export default function ReaderViewPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()

  const readerPreloadAhead = useAppSettingsStore((state) => state.readerPreloadAhead)
  const readerSplitDefaultEnabled = useAppSettingsStore((state) => state.readerSplitDefaultEnabled)
  const readerWideRatioThreshold = useAppSettingsStore((state) => state.readerWideRatioThreshold)
  const readerToolbarKeepStateOnPaging = useAppSettingsStore((state) => state.readerToolbarKeepStateOnPaging)
  const readerToolbarCenterClickToggleEnabled = useAppSettingsStore((state) => state.readerToolbarCenterClickToggleEnabled)
  const readerTapZones = useAppSettingsStore((state) => state.readerTapZones)
  const setReaderTapZones = useAppSettingsStore((state) => state.setReaderTapZones)

  const [collapsedToolbarWidthPx, setCollapsedToolbarWidthPx] = useState<number | null>(null)
  const { style: toolbarStyleVars } = useReaderStyleVars(collapsedToolbarWidthPx)

  const { currentPage, totalPages, isLoading, error, imageUrl, setCurrentPage, refresh } = useReaderManga({ fileId: id, preloadAhead: readerPreloadAhead })
  const { bookmarks: bookmarkList, refresh: refreshBookmarks, isBookmarked, add: addBookmark, update: updateBookmark, remove: removeBookmark } =
    useReaderBookmarks(id)
  const { loading: fileInfoLoading, error: fileInfoError, data: fileInfoData, reset: resetFileInfo, fetch: fetchFileInfo } = useReaderFileInfo(id)

  const [isPagingEnabled, setIsPagingEnabled] = useState(() => Boolean(readerSplitDefaultEnabled))
  const [isCurrentImageWide, setIsCurrentImageWide] = useState(false)
  const [showRightHalf, setShowRightHalf] = useState(false)

  const [isToolbarExpanded, setIsToolbarExpanded] = useState(false)
  const [activePanel, setActivePanel] = useState<ReaderPanelKey>('')

  const [newBookmarkNote, setNewBookmarkNote] = useState('')
  const [editingBookmarkId, setEditingBookmarkId] = useState<number | null>(null)
  const [editBookmarkNote, setEditBookmarkNote] = useState('')

  const [isTapZonesConfiguratorOpen, setIsTapZonesConfiguratorOpen] = useState(false)
  const [tapZonesSaving, setTapZonesSaving] = useState(false)
  const [tapZonesDraft, setTapZonesDraft] = useState<ReaderTapZonesConfig>(readerTapZones)

  const fileInfoDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevPageRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.body.classList.remove('app-is-manager')
    document.body.classList.add('app-is-reader')
    return () => {
      document.body.classList.remove('app-is-reader')
    }
  }, [])

  useEffect(() => {
    if (!id) return
    if (typeof document !== 'undefined') {
      document.title = `${t('reader')} - ${t('appName')}`
    }
  }, [id, t])

  useEffect(() => {
    if (!isTapZonesConfiguratorOpen) {
      setTapZonesDraft(readerTapZones)
    }
  }, [isTapZonesConfiguratorOpen, readerTapZones])

  useEffect(() => {
    // 仅处理“翻页”带来的副作用，避免 fileInfo 状态变化引发重复 reset。
    const prev = prevPageRef.current
    if (prev === currentPage) {
      return
    }
    prevPageRef.current = currentPage

    setShowRightHalf(false)

    if (fileInfoDebounceRef.current) {
      clearTimeout(fileInfoDebounceRef.current)
      fileInfoDebounceRef.current = null
    }

    if (!readerToolbarKeepStateOnPaging) {
      if (activePanel) {
        setActivePanel('')
      }
      resetFileInfo()
      return
    }

    if (activePanel === 'fileInfo') {
      resetFileInfo()
      fileInfoDebounceRef.current = setTimeout(() => {
        fetchFileInfo(currentPage).catch(() => {})
      }, 250)
    }
  }, [activePanel, currentPage, fetchFileInfo, readerToolbarKeepStateOnPaging, resetFileInfo])

  useEffect(() => {
    return () => {
      if (fileInfoDebounceRef.current) {
        clearTimeout(fileInfoDebounceRef.current)
        fileInfoDebounceRef.current = null
      }
    }
  }, [])

  const isSplitActive = useMemo(() => isPagingEnabled && isCurrentImageWide, [isCurrentImageWide, isPagingEnabled])

  const nextPage = useCallback(() => {
    if (isSplitActive && !showRightHalf) {
      setShowRightHalf(true)
      return
    }
    setCurrentPage(currentPage + 1)
  }, [currentPage, isSplitActive, setCurrentPage, showRightHalf])

  const prevPage = useCallback(() => {
    if (isSplitActive && showRightHalf) {
      setShowRightHalf(false)
      return
    }
    setCurrentPage(currentPage - 1)
  }, [currentPage, isSplitActive, setCurrentPage, showRightHalf])

  const togglePagingMode = useCallback(() => {
    setIsPagingEnabled((prev) => !prev)
    setShowRightHalf(false)
  }, [])

  const handleBookmarkButtonClick = useCallback(async () => {
    setIsToolbarExpanded(true)
    if (isBookmarked(currentPage)) {
      setActivePanel('bookmarks')
      refreshBookmarks().catch(() => {})
      message.info(t('bookmarkAlreadyExists'))
      return
    }
    setNewBookmarkNote('')
    setActivePanel('addBookmark')
  }, [currentPage, isBookmarked, refreshBookmarks, t])

  const saveNewBookmark = useCallback(async () => {
    try {
      await addBookmark({ pageNumber: currentPage, note: newBookmarkNote || null })
      message.success(t('bookmarkSaved'))
      setNewBookmarkNote('')
      setActivePanel('')
    } catch (err) {
      console.error('保存书签失败：', err)
      message.error((err as any)?.message || t('failedToSaveBookmark'))
    }
  }, [addBookmark, currentPage, newBookmarkNote, t])

  const startEditBookmark = useCallback((record: BookmarkRecord) => {
    setIsToolbarExpanded(true)
    setEditingBookmarkId(record.id)
    setEditBookmarkNote(record.note || '')
    setActivePanel('editBookmark')
  }, [])

  const cancelEditBookmark = useCallback(() => {
    setEditingBookmarkId(null)
    setEditBookmarkNote('')
    setActivePanel('bookmarks')
  }, [])

  const saveEditedBookmark = useCallback(async () => {
    if (!editingBookmarkId) {
      cancelEditBookmark()
      return
    }
    try {
      await updateBookmark({ bookmarkId: editingBookmarkId, note: editBookmarkNote || null })
      message.success(t('bookmarkUpdated'))
      setEditingBookmarkId(null)
      setEditBookmarkNote('')
      setActivePanel('bookmarks')
      refreshBookmarks().catch(() => {})
    } catch (err) {
      console.error('更新书签失败：', err)
      message.error((err as any)?.response?.data?.error || t('failedToUpdateBookmark'))
    }
  }, [cancelEditBookmark, editBookmarkNote, editingBookmarkId, refreshBookmarks, t, updateBookmark])

  const deleteBookmark = useCallback(
    (bookmarkId: number) => {
      removeBookmark(bookmarkId)
        .then(() => {
          message.success(t('remove'))
        })
        .catch((err) => {
          console.error('删除书签失败：', err)
          message.error((err as any)?.response?.data?.error || t('failedToDeleteBookmark'))
        })
    },
    [removeBookmark, t]
  )

  const jumpToBookmark = useCallback(
    (pageNumber: number) => {
      setCurrentPage(pageNumber)
      if (!readerToolbarKeepStateOnPaging) {
        setActivePanel('')
      }
    },
    [readerToolbarKeepStateOnPaging, setCurrentPage]
  )

  const togglePanel = useCallback(
    (panel: ReaderPanelKey) => {
      setIsToolbarExpanded(true)
      if (activePanel === panel) {
        setActivePanel('')
        return
      }
      setActivePanel(panel)
      if (panel === 'bookmarks') {
        refreshBookmarks().catch(() => {})
      } else if (panel === 'fileInfo') {
        fetchFileInfo(currentPage).catch(() => {})
      }
    },
    [activePanel, currentPage, fetchFileInfo, refreshBookmarks]
  )

  const handleToolbarTogglePanel = useCallback(
    (panel: ReaderPanelKey) => {
      if (panel === 'addBookmark') {
        handleBookmarkButtonClick().catch(() => {})
        return
      }
      togglePanel(panel)
    },
    [handleBookmarkButtonClick, togglePanel]
  )

  const handleTapZoneTrigger = useCallback(
    ({ zoneKey, action }: { zoneKey: ReaderTapZoneKey; action: ReaderTapZoneAction }) => {
      if (isTapZonesConfiguratorOpen) return

      const centerToggleDisabled = zoneKey === 'middle' && !readerToolbarCenterClickToggleEnabled
      if (centerToggleDisabled && ['toggle_toolbar', 'expand_toolbar', 'collapse_toolbar'].includes(action)) {
        return
      }

      if (action === 'prev_page') {
        prevPage()
        return
      }
      if (action === 'next_page') {
        nextPage()
        return
      }
      if (action === 'toggle_toolbar') {
        setIsToolbarExpanded((prev) => !prev)
        return
      }
      if (action === 'expand_toolbar') {
        setIsToolbarExpanded(true)
        return
      }
      if (action === 'collapse_toolbar') {
        setIsToolbarExpanded(false)
      }
    },
    [isTapZonesConfiguratorOpen, nextPage, prevPage, readerToolbarCenterClickToggleEnabled]
  )

  useEffect(() => {
    const handleKeydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const tagName = target?.tagName || ''
      if (tagName === 'INPUT' || tagName === 'TEXTAREA') return

      if (event.key === 'ArrowLeft') {
        prevPage()
        return
      }
      if (event.key === 'ArrowRight') {
        nextPage()
        return
      }

      const key = event.key.toLowerCase()
      if (key === 'b') {
        handleBookmarkButtonClick().catch(() => {})
        return
      }
      if (key === 'f') {
        togglePanel('fileInfo')
        return
      }
      if (key === 'l') {
        togglePanel('bookmarks')
        return
      }
      if (key === 'p') {
        togglePagingMode()
        return
      }
      if (event.key === 'Escape') {
        if (activePanel) {
          setActivePanel('')
          return
        }
        if (isToolbarExpanded) {
          setIsToolbarExpanded(false)
          return
        }
        navigate(-1)
      }
    }

    window.addEventListener('keydown', handleKeydown)
    return () => {
      window.removeEventListener('keydown', handleKeydown)
    }
  }, [activePanel, handleBookmarkButtonClick, isToolbarExpanded, navigate, nextPage, prevPage, togglePagingMode, togglePanel])

  const openTapZonesConfigurator = useCallback(() => {
    setTapZonesDraft(JSON.parse(JSON.stringify(readerTapZones || DEFAULT_READER_TAP_ZONES)))
    setIsTapZonesConfiguratorOpen(true)
  }, [readerTapZones])

  const saveTapZonesDraft = useCallback(
    async (draft: ReaderTapZonesConfig) => {
      setTapZonesSaving(true)
      try {
        await setReaderTapZones(draft)
        message.success(t('settingsSavedSuccessfully'))
        setIsTapZonesConfiguratorOpen(false)
      } catch (err) {
        console.error('保存阅读器点击区域配置失败：', err)
        message.error(t('failedToSaveSettings'))
      } finally {
        setTapZonesSaving(false)
      }
    },
    [setReaderTapZones, t]
  )

  const onImageLoad = useCallback(
    (event: React.SyntheticEvent<HTMLImageElement>) => {
      const img = event.currentTarget
      const ratio = img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1
      const threshold = Number(readerWideRatioThreshold || 1.0) || 1.0
      setIsCurrentImageWide(ratio >= threshold)
    },
    [readerWideRatioThreshold]
  )

  const sizeUnits = useMemo(() => [t('sizeUnitB'), t('sizeUnitKB'), t('sizeUnitMB'), t('sizeUnitGB'), t('sizeUnitTB')], [t])
  const fileInfoRows = useMemo(() => {
    if (!fileInfoData) return []
    return [
      {
        key: 'manga',
        label: t('mangaFile'),
        filename: fileInfoData.manga_filename,
        filesize: formatBytes(fileInfoData.manga_filesize, sizeUnits)
      },
      {
        key: 'page',
        label: t('currentPageFile'),
        filename: fileInfoData.page_filename,
        filesize: formatBytes(fileInfoData.page_filesize, sizeUnits)
      }
    ]
  }, [fileInfoData, sizeUnits, t])

  if (error) {
    return (
      <div className="reader-view" style={toolbarStyleVars}>
        <div className="reader-view__top">
          <ReaderButton
            variant="default"
            shape="circle"
            size="lg"
            className="reader-view__back-button reader-view__glass-control"
            ariaLabel={t('back')}
            onClick={() => navigate(-1)}
            icon={<ArrowLeftOutlined />}
          />
        </div>

        <Alert className="reader-view__alert" type="error" showIcon message={t('failedToLoadMangaDetails')} description={error} />

        <div className="reader-view__spinner">
          <ReaderButton variant="primary" onClick={() => refresh().catch(() => {})}>
            {t('retry')}
          </ReaderButton>
        </div>
      </div>
    )
  }

  return (
    <div className="reader-view" style={toolbarStyleVars}>
      <div className="reader-view__top">
        <ReaderButton
          variant="default"
          shape="circle"
          size="lg"
          className="reader-view__back-button reader-view__glass-control"
          ariaLabel={t('back')}
          onClick={() => navigate(-1)}
          icon={<ArrowLeftOutlined />}
        />
        {isCurrentImageWide ? <Tag color="purple">{t('spread')}</Tag> : null}
      </div>

      {isLoading ? (
        <div className="reader-view__spinner">
          <Spin size="large" tip={t('loading')} />
        </div>
      ) : (
        <div className="reader-view__canvas">
          <img
            src={imageUrl}
            alt={`${t('page')} ${currentPage + 1}`}
            className={`reader-view__image${isSplitActive ? ' reader-view__image--split' : ''}`}
            style={{ transform: isSplitActive ? `translateX(${showRightHalf ? '-25%' : '25%'})` : 'translateX(0)' }}
            onLoad={onImageLoad}
          />
          <ReaderTapZonesLayer config={readerTapZones} disabled={isTapZonesConfiguratorOpen} onTrigger={handleTapZoneTrigger} />
        </div>
      )}

      <ReaderToolbar
        style={toolbarStyleVars}
        currentPage={currentPage}
        totalPages={totalPages}
        isExpanded={isToolbarExpanded}
        setExpanded={setIsToolbarExpanded}
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        onTogglePanel={handleToolbarTogglePanel}
        isPagingEnabled={isPagingEnabled}
        onTogglePaging={togglePagingMode}
        onOpenTapZonesConfigurator={openTapZonesConfigurator}
        onPageChange={setCurrentPage}
        onCollapsedWidthChange={setCollapsedToolbarWidthPx}
        bookmarks={bookmarkList}
        onJumpToBookmark={jumpToBookmark}
        onStartEditBookmark={startEditBookmark}
        onDeleteBookmark={deleteBookmark}
        newBookmarkNote={newBookmarkNote}
        setNewBookmarkNote={setNewBookmarkNote}
        onSaveNewBookmark={() => saveNewBookmark().catch(() => {})}
        editBookmarkNote={editBookmarkNote}
        setEditBookmarkNote={setEditBookmarkNote}
        onSaveEditedBookmark={() => saveEditedBookmark().catch(() => {})}
        onCancelEditBookmark={cancelEditBookmark}
        fileInfo={{ loading: fileInfoLoading, error: fileInfoError, rows: fileInfoRows }}
        onRetryFileInfo={() => fetchFileInfo(currentPage).catch(() => {})}
      />

      <ReaderTapZonesConfigurator
        open={isTapZonesConfiguratorOpen}
        value={tapZonesDraft}
        saving={tapZonesSaving}
        onChange={setTapZonesDraft}
        onClose={() => setIsTapZonesConfiguratorOpen(false)}
        onSave={(draft) => saveTapZonesDraft(draft).catch(() => {})}
      />
    </div>
  )
}
