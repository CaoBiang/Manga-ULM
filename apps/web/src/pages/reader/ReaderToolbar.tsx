import { BookOutlined, BorderOutlined, ColumnWidthOutlined, DeleteOutlined, EditOutlined, InfoCircleOutlined, UnorderedListOutlined } from '@ant-design/icons'
import { Result, Slider, Spin, Tooltip, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { CSSProperties } from 'react'
import { useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import ReaderTable from '@/components/reader/ReaderTable'
import ReaderButton from '@/components/reader/ui/ReaderButton'
import ReaderInput, { type ReaderInputHandle } from '@/components/reader/ui/ReaderInput'
import type { BookmarkRecord } from '@/pages/reader/hooks/useReaderBookmarks'

export type ReaderPanelKey = '' | 'bookmarks' | 'addBookmark' | 'editBookmark' | 'fileInfo'

export type FileInfoRow = { key: string; label: string; filename: string; filesize: string }

export type ReaderToolbarProps = {
  style: CSSProperties
  currentPage: number
  totalPages: number
  isExpanded: boolean
  setExpanded: (expanded: boolean) => void
  activePanel: ReaderPanelKey
  setActivePanel: (panel: ReaderPanelKey) => void
  onTogglePanel: (panel: ReaderPanelKey) => void
  isPagingEnabled: boolean
  onTogglePaging: () => void
  onOpenTapZonesConfigurator: () => void
  onPageChange: (page: number) => void
  onCollapsedWidthChange: (widthPx: number | null) => void

  bookmarks: BookmarkRecord[]
  onJumpToBookmark: (pageNumber: number) => void
  onStartEditBookmark: (record: BookmarkRecord) => void
  onDeleteBookmark: (bookmarkId: number) => void

  newBookmarkNote: string
  setNewBookmarkNote: (note: string) => void
  onSaveNewBookmark: () => void

  editBookmarkNote: string
  setEditBookmarkNote: (note: string) => void
  onSaveEditedBookmark: () => void
  onCancelEditBookmark: () => void

  fileInfo: { loading: boolean; error: string; rows: FileInfoRow[] }
  onRetryFileInfo: () => void
}

export default function ReaderToolbar({
  style,
  currentPage,
  totalPages,
  isExpanded,
  setExpanded,
  activePanel,
  setActivePanel,
  onTogglePanel,
  isPagingEnabled,
  onTogglePaging,
  onOpenTapZonesConfigurator,
  onPageChange,
  onCollapsedWidthChange,
  bookmarks,
  onJumpToBookmark,
  onStartEditBookmark,
  onDeleteBookmark,
  newBookmarkNote,
  setNewBookmarkNote,
  onSaveNewBookmark,
  editBookmarkNote,
  setEditBookmarkNote,
  onSaveEditedBookmark,
  onCancelEditBookmark,
  fileInfo,
  onRetryFileInfo
}: ReaderToolbarProps) {
  const { t } = useTranslation()
  const pageIndicatorRef = useRef<HTMLSpanElement | null>(null)
  const bookmarkNoteInputRef = useRef<ReaderInputHandle | null>(null)
  const bookmarkEditInputRef = useRef<ReaderInputHandle | null>(null)

  useEffect(() => {
    const indicatorEl = pageIndicatorRef.current
    if (!indicatorEl || typeof indicatorEl.getBoundingClientRect !== 'function') {
      onCollapsedWidthChange(null)
      return
    }

    const measure = () => {
      const rect = indicatorEl.getBoundingClientRect()
      const paddingX = 12 * 2
      const borderX = 1 * 2
      const width = Math.ceil(rect.width + paddingX + borderX)
      const maxWidth = Math.floor((window.innerWidth || 0) * 0.9)
      onCollapsedWidthChange(maxWidth > 0 ? Math.min(maxWidth, width) : width)
    }

    measure()
    window.addEventListener('resize', measure)
    const observer = typeof window.ResizeObserver === 'function' ? new ResizeObserver(measure) : null
    observer?.observe(indicatorEl)
    return () => {
      window.removeEventListener('resize', measure)
      observer?.disconnect()
    }
  }, [onCollapsedWidthChange])

  useEffect(() => {
    if (activePanel === 'addBookmark') {
      requestAnimationFrame(() => bookmarkNoteInputRef.current?.focus())
    } else if (activePanel === 'editBookmark') {
      requestAnimationFrame(() => bookmarkEditInputRef.current?.focus())
    }
  }, [activePanel])

  const bookmarkColumns: ColumnsType<BookmarkRecord> = useMemo(
    () => [
      {
        title: t('pageNumber'),
        dataIndex: 'page_number',
        key: 'page',
        width: 110,
        render: (value: number) => <strong>{Number(value) + 1}</strong>
      },
      {
        title: t('note'),
        dataIndex: 'note',
        key: 'note',
        render: (value: string | null) => <span className="reader-view__table-note">{value || '--'}</span>
      },
      {
        title: t('actions'),
        key: 'action',
        width: 96,
        align: 'center',
        render: (_value: unknown, record: BookmarkRecord) => (
          <div className="reader-view__bookmark-actions">
            <ReaderButton
              shape="circle"
              size="sm"
              className="reader-view__bookmark-edit"
              ariaLabel={t('edit')}
              onClick={(event) => {
                event.stopPropagation()
                onStartEditBookmark(record)
              }}
              icon={<EditOutlined />}
            />
            <ReaderButton
              variant="danger"
              shape="circle"
              size="sm"
              className="reader-view__bookmark-delete"
              ariaLabel={t('delete')}
              onClick={(event) => {
                event.stopPropagation()
                onDeleteBookmark(record.id)
              }}
              icon={<DeleteOutlined />}
            />
          </div>
        )
      }
    ],
    [onDeleteBookmark, onStartEditBookmark, t]
  )

  const fileInfoColumns: ColumnsType<FileInfoRow> = useMemo(
    () => [
      {
        title: '',
        dataIndex: 'label',
        key: 'label',
        width: 140,
        render: (value: string) => <strong>{value}</strong>
      },
      {
        title: '',
        key: 'value',
        render: (_value: unknown, record: FileInfoRow) => (
          <div className="reader-view__fileinfo-value">
            <div>{record.filename}</div>
            <Typography.Text type="secondary">{record.filesize}</Typography.Text>
          </div>
        )
      }
    ],
    []
  )

  return (
    <div className="reader-view__toolbar" onClick={(event) => event.stopPropagation()}>
      <div
        className={`reader-view__toolbar-shell${isExpanded ? ' is-expanded' : ''}`}
        style={style}
        onClick={() => {
          if (!isExpanded) {
            setExpanded(true)
          }
        }}
      >
        <div className="reader-view__toolbar-slider-row" aria-hidden={!isExpanded}>
          <Slider
            value={currentPage}
            min={0}
            max={totalPages > 0 ? totalPages - 1 : 0}
            tooltip={{ open: false }}
            disabled={!isExpanded}
            onChange={(value) => {
              const next = Array.isArray(value) ? value[0] : value
              onPageChange(Math.max(0, Number(next) || 0))
            }}
          />
        </div>

        <div className="reader-view__toolbar-controls-row">
          <span ref={pageIndicatorRef} className="reader-view__toolbar-page-indicator">
            <Typography.Text strong className="reader-view__toolbar-page-indicator-text">
              {currentPage + 1} / {totalPages}
            </Typography.Text>
          </span>

          <div className="reader-view__toolbar-actions-wrap" aria-hidden={!isExpanded}>
            <div className="reader-view__toolbar-actions">
              <Tooltip title={t('toggleSplitView')}>
                <ReaderButton
                  shape="circle"
                  active={isPagingEnabled}
                  className="reader-view__toolbar-action reader-view__glass-control"
                  ariaLabel={t('toggleSplitView')}
                  onClick={(event) => {
                    event.stopPropagation()
                    onTogglePaging()
                  }}
                  icon={<ColumnWidthOutlined />}
                />
              </Tooltip>

              <Tooltip title={t('bookmarks')}>
                <ReaderButton
                  shape="circle"
                  active={activePanel === 'bookmarks'}
                  className="reader-view__toolbar-action reader-view__glass-control"
                  ariaLabel={t('bookmarks')}
                  onClick={(event) => {
                    event.stopPropagation()
                    onTogglePanel('bookmarks')
                  }}
                  icon={<UnorderedListOutlined />}
                />
              </Tooltip>

              <Tooltip title={t('addBookmark')}>
                <ReaderButton
                  shape="circle"
                  active={activePanel === 'addBookmark'}
                  className="reader-view__toolbar-action reader-view__glass-control"
                  ariaLabel={t('addBookmark')}
                  onClick={(event) => {
                    event.stopPropagation()
                    onTogglePanel('addBookmark')
                  }}
                  icon={<BookOutlined />}
                />
              </Tooltip>

              <Tooltip title={t('fileInfo')}>
                <ReaderButton
                  shape="circle"
                  active={activePanel === 'fileInfo'}
                  className="reader-view__toolbar-action reader-view__glass-control"
                  ariaLabel={t('fileInfo')}
                  onClick={(event) => {
                    event.stopPropagation()
                    onTogglePanel('fileInfo')
                  }}
                  icon={<InfoCircleOutlined />}
                />
              </Tooltip>

              <Tooltip title={t('readerTapZonesConfigTitle')}>
                <ReaderButton
                  shape="circle"
                  className="reader-view__toolbar-action reader-view__glass-control"
                  ariaLabel={t('readerTapZonesConfigTitle')}
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpenTapZonesConfigurator()
                  }}
                  icon={<BorderOutlined />}
                />
              </Tooltip>
            </div>
          </div>
        </div>

        <div className="reader-view__panel" aria-hidden={!activePanel}>
          {activePanel ? (
            <div className="reader-view__panel-section">
              {activePanel === 'addBookmark' ? (
                <>
                  <Typography.Text strong>{t('addBookmark')}</Typography.Text>
                  <ReaderInput
                    ref={bookmarkNoteInputRef}
                    value={newBookmarkNote}
                    onChange={setNewBookmarkNote}
                    placeholder={t('bookmarkNotePlaceholder')}
                    onPressEnter={onSaveNewBookmark}
                    className="reader-view__bookmark-input"
                  />
                  <div className="reader-view__panel-actions">
                    <ReaderButton variant="ghost" onClick={() => setActivePanel('')}>
                      {t('cancel')}
                    </ReaderButton>
                    <ReaderButton variant="primary" onClick={onSaveNewBookmark}>
                      {t('save')}
                    </ReaderButton>
                  </div>
                </>
              ) : null}

              {activePanel === 'editBookmark' ? (
                <>
                  <Typography.Text strong>{t('editBookmark')}</Typography.Text>
                  <ReaderInput
                    ref={bookmarkEditInputRef}
                    value={editBookmarkNote}
                    onChange={setEditBookmarkNote}
                    placeholder={t('bookmarkNotePlaceholder')}
                    onPressEnter={onSaveEditedBookmark}
                    className="reader-view__bookmark-input"
                  />
                  <div className="reader-view__panel-actions">
                    <ReaderButton variant="ghost" onClick={onCancelEditBookmark}>
                      {t('cancel')}
                    </ReaderButton>
                    <ReaderButton variant="primary" onClick={onSaveEditedBookmark}>
                      {t('save')}
                    </ReaderButton>
                  </div>
                </>
              ) : null}

              {activePanel === 'bookmarks' ? (
                <ReaderTable<BookmarkRecord>
                  columns={bookmarkColumns}
                  dataSource={bookmarks}
                  rowKey={(record) => record.id}
                  emptyText={t('noBookmarks')}
                  onRow={(record) => ({
                    onClick: () => onJumpToBookmark(record.page_number)
                  })}
                />
              ) : null}

              {activePanel === 'fileInfo' ? (
                <Spin spinning={fileInfo.loading}>
                  {fileInfo.error ? (
                    <Result
                      status="warning"
                      title={t('failedToLoadFileInfo')}
                      subTitle={fileInfo.error}
                      extra={
                        <ReaderButton variant="primary" size="sm" onClick={onRetryFileInfo}>
                          {t('retry')}
                        </ReaderButton>
                      }
                    />
                  ) : fileInfo.rows.length ? (
                    <ReaderTable<FileInfoRow> columns={fileInfoColumns} dataSource={fileInfo.rows} rowKey={(record) => record.key} showHeader={false} />
                  ) : null}
                </Spin>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
