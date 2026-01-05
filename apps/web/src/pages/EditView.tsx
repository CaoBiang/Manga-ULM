import { ArrowLeftOutlined, DeleteOutlined } from '@ant-design/icons'
import { Alert, Button, Descriptions, Divider, Empty, Form, Input, InputNumber, Space, Spin, Table, Tag, Tooltip, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'
import { http } from '@/api/http'
import GlassPage from '@/components/glass/ui/GlassPage'
import GlassSurface from '@/components/glass/ui/GlassSurface'
import TagSelector, { type SimpleTag } from '@/components/tags/TagSelector'

type FileRecord = {
  id: number
  file_path: string
  total_pages: number
  content_sha256: string | null
  tags: SimpleTag[]
}

type BookmarkRecord = {
  id: number
  page_number: number
  note: string | null
}

const getFilenameFromPath = (path: string | null | undefined) => {
  const raw = String(path || '')
  if (!raw) return ''
  const parts = raw.split(/[\\/]/)
  return parts[parts.length - 1] || ''
}

type TagSaveStatus = 'idle' | 'saving' | 'success' | 'error'

export default function EditView() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { id } = useParams()

  const [file, setFile] = useState<FileRecord | null>(null)
  const fileRef = useRef<FileRecord | null>(null)
  const [bookmarks, setBookmarks] = useState<BookmarkRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [editableFilename, setEditableFilename] = useState('')
  const [renaming, setRenaming] = useState(false)

  const [tagSaveStatus, setTagSaveStatus] = useState<TagSaveStatus>('idle')
  const [tagSaveError, setTagSaveError] = useState('')
  const tagSavingRef = useRef(false)
  const tagSavePendingRef = useRef(false)
  const suppressTagAutoSaveRef = useRef(false)
  const tagSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [newBookmarkPage, setNewBookmarkPage] = useState<number | null>(null)
  const [newBookmarkNote, setNewBookmarkNote] = useState('')
  const [bookmarkError, setBookmarkError] = useState('')
  const [bookmarkSaving, setBookmarkSaving] = useState(false)

  useEffect(() => {
    fileRef.current = file
  }, [file])

  const totalPages = useMemo(() => Number(file?.total_pages || 0), [file?.total_pages])

  const syncEditableFilename = useCallback((nextFile: FileRecord | null) => {
    setEditableFilename(getFilenameFromPath(nextFile?.file_path))
  }, [])

  const fetchData = useCallback(async () => {
    if (!id) {
      setError(t('mangaNotFound'))
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      suppressTagAutoSaveRef.current = true
      const [fileResponse, bookmarksResponse] = await Promise.all([
        http.get(`/api/v1/files/${id}`),
        http.get(`/api/v1/files/${id}/bookmarks`)
      ])
      const nextFile = (fileResponse?.data || null) as FileRecord | null
      const nextBookmarks = ((bookmarksResponse?.data || []) as BookmarkRecord[]).slice().sort((a, b) => a.page_number - b.page_number)

      setFile(nextFile)
      setBookmarks(nextBookmarks)
      syncEditableFilename(nextFile)
    } catch (err) {
      console.error('加载编辑页数据失败：', err)
      const msg = (err as any)?.response?.data?.error || (err as any)?.message || ''
      setError(msg || t('errorLoadingData', { error: '' }))
    } finally {
      setLoading(false)
      setTimeout(() => {
        suppressTagAutoSaveRef.current = false
      }, 0)
    }
  }, [id, syncEditableFilename, t])

  useEffect(() => {
    fetchData().catch(() => {})
  }, [fetchData])

  useEffect(() => {
    return () => {
      if (tagSaveTimerRef.current) {
        clearTimeout(tagSaveTimerRef.current)
        tagSaveTimerRef.current = null
      }
    }
  }, [])

  const handleRename = useCallback(async () => {
    const currentFile = fileRef.current
    const nextName = editableFilename.trim()
    if (!currentFile || !nextName) {
      return
    }

    setRenaming(true)
    try {
      const response = await http.patch(`/api/v1/files/${currentFile.id}`, { new_filename: nextName })
      const nextFile = (response?.data || null) as FileRecord | null
      suppressTagAutoSaveRef.current = true
      setFile(nextFile)
      syncEditableFilename(nextFile)
      message.success(t('renameSuccess'))
    } catch (err) {
      console.error('重命名文件失败：', err)
      const msg = (err as any)?.response?.data?.error || t('unexpectedRenameError')
      message.error(String(msg))
    } finally {
      setRenaming(false)
      setTimeout(() => {
        suppressTagAutoSaveRef.current = false
      }, 0)
    }
  }, [editableFilename, syncEditableFilename, t])

  const saveTags = useCallback(
    async function saveTagsImpl({ renameFile = false, silent = true }: { renameFile?: boolean; silent?: boolean } = {}) {
      const currentFile = fileRef.current
      if (!currentFile) {
        return
      }

      if (tagSavingRef.current) {
        tagSavePendingRef.current = true
        return
      }

      tagSavingRef.current = true
      setTagSaveStatus('saving')
      setTagSaveError('')
      try {
        const response = await http.put(`/api/v1/files/${currentFile.id}`, {
          tags: currentFile.tags,
          rename_file: renameFile
        })
        const nextFile = (response?.data || null) as FileRecord | null
        suppressTagAutoSaveRef.current = true
        setFile(nextFile)
        syncEditableFilename(nextFile)

        setTagSaveStatus('success')
        if (!silent) {
          message.success(t('successfullySaved'))
        }
        setTimeout(() => {
          setTagSaveStatus((prev) => (prev === 'success' ? 'idle' : prev))
        }, 2000)
      } catch (err) {
        console.error('保存标签失败：', err)
        const msg = (err as any)?.response?.data?.error || t('unexpectedSaveError')
        setTagSaveStatus('error')
        setTagSaveError(String(msg))
        message.error(String(msg))
      } finally {
        tagSavingRef.current = false
        setTimeout(() => {
          suppressTagAutoSaveRef.current = false
        }, 0)

        if (tagSavePendingRef.current) {
          tagSavePendingRef.current = false
          saveTagsImpl().catch(() => {})
        }
      }
    },
    [syncEditableFilename, t]
  )

  useEffect(() => {
    const currentFile = fileRef.current
    if (!currentFile) {
      return
    }
    if (suppressTagAutoSaveRef.current) {
      return
    }
    if (tagSaveTimerRef.current) {
      clearTimeout(tagSaveTimerRef.current)
      tagSaveTimerRef.current = null
    }
    tagSaveTimerRef.current = setTimeout(() => {
      saveTags({ renameFile: false, silent: true }).catch(() => {})
    }, 500)
  }, [file?.tags, saveTags])

  const removeTag = (tag: SimpleTag) => {
    setFile((prev) => {
      if (!prev) return prev
      return { ...prev, tags: (prev.tags || []).filter((item) => item.id !== tag.id) }
    })
  }

  const addBookmark = async () => {
    setBookmarkError('')
    const currentFile = fileRef.current
    if (!currentFile) {
      return
    }

    const pageNumberUi = Number(newBookmarkPage)
    if (!pageNumberUi || pageNumberUi < 1) {
      setBookmarkError(t('bookmarkPagePositiveNumber'))
      return
    }
    if (totalPages && pageNumberUi > totalPages) {
      setBookmarkError(t('goToPageOutOfRange', { total: totalPages }))
      return
    }

    setBookmarkSaving(true)
    try {
      const response = await http.post(`/api/v1/files/${currentFile.id}/bookmarks`, {
        page_number: pageNumberUi - 1,
        note: newBookmarkNote || null
      })
      const record = response?.data as BookmarkRecord
      setBookmarks((prev) => prev.concat([record]).slice().sort((a, b) => a.page_number - b.page_number))
      setNewBookmarkPage(null)
      setNewBookmarkNote('')
      message.success(t('bookmarkSaved'))
    } catch (err) {
      console.error('添加书签失败：', err)
      const msg = (err as any)?.response?.data?.error || t('failedToAddBookmark')
      setBookmarkError(String(msg))
      message.error(String(msg))
    } finally {
      setBookmarkSaving(false)
    }
  }

  const deleteBookmark = async (bookmarkId: number) => {
    setBookmarkError('')
    try {
      await http.delete(`/api/v1/bookmarks/${bookmarkId}`)
      setBookmarks((prev) => prev.filter((item) => item.id !== bookmarkId))
      message.success(t('remove'))
    } catch (err) {
      console.error('删除书签失败：', err)
      const msg = (err as any)?.response?.data?.error || t('failedToDeleteBookmark')
      setBookmarkError(String(msg))
      message.error(String(msg))
    }
  }

  const bookmarkColumns: ColumnsType<BookmarkRecord> = useMemo(
    () => [
      {
        title: t('pageNumber'),
        dataIndex: 'page_number',
        key: 'page',
        width: 120,
        render: (value: number) => <strong>{Number(value) + 1}</strong>
      },
      {
        title: t('note'),
        dataIndex: 'note',
        key: 'note',
        render: (value: string | null) => <Typography.Text type="secondary">{value || '--'}</Typography.Text>
      },
      {
        title: t('actions'),
        key: 'action',
        width: 80,
        align: 'center',
        render: (_value: unknown, record: BookmarkRecord) => (
          <Button type="text" danger size="small" onClick={() => deleteBookmark(record.id).catch(() => {})}>
            <DeleteOutlined />
          </Button>
        )
      }
    ],
    [t]
  )

  const tagSaveExtra = useMemo(() => {
    if (tagSaveStatus === 'saving') {
      return <Typography.Text type="secondary">{t('saving')}</Typography.Text>
    }
    if (tagSaveStatus === 'success') {
      return <Typography.Text type="success">{t('successfullySaved')}</Typography.Text>
    }
    if (tagSaveStatus === 'error') {
      return <Typography.Text type="danger">{tagSaveError || t('unexpectedSaveError')}</Typography.Text>
    }
    return null
  }, [tagSaveError, tagSaveStatus, t])

  return (
    <GlassPage>
      <Space direction="vertical" size="large" className="w-full">
        <div>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            {t('back')}
          </Button>
        </div>

        {error ? <Alert type="error" showIcon message={t('failedToLoadMangaDetails')} description={error} /> : null}

        <Spin spinning={loading}>
          {file ? (
            <Space direction="vertical" size="large" className="w-full">
              <GlassSurface title={t('metadata')}>
                <Space direction="vertical" size="middle" className="w-full">
                  <Form layout="vertical">
                    <Form.Item label={t('filename')}>
                      <Space.Compact style={{ width: '100%' }}>
                        <Input value={editableFilename} onChange={(event) => setEditableFilename(event.target.value)} />
                        <Button type="primary" loading={renaming} disabled={!editableFilename.trim()} onClick={() => handleRename().catch(() => {})}>
                          {t('rename')}
                        </Button>
                      </Space.Compact>
                    </Form.Item>
                  </Form>

                  <Descriptions bordered size="small" column={1}>
                    <Descriptions.Item label={t('pages')}>{file.total_pages}</Descriptions.Item>
                    <Descriptions.Item label={t('fullPath')}>
                      <span className="break-all">{file.file_path}</span>
                    </Descriptions.Item>
                    <Descriptions.Item label={t('hash')}>
                      <span className="break-all">{file.content_sha256 || '--'}</span>
                    </Descriptions.Item>
                  </Descriptions>
                </Space>
              </GlassSurface>

              <GlassSurface title={t('tags')} extra={tagSaveExtra}>
                <Space direction="vertical" size="middle" className="w-full">
                  <div className="w-full flex flex-col gap-2 sm:flex-row sm:items-start">
                    <div className="flex-1 min-w-0">
                      <TagSelector
                        value={file.tags || []}
                        onChange={(next) => setFile((prev) => (prev ? { ...prev, tags: next } : prev))}
                      />
                    </div>
                    <Tooltip title={t('renameFileOnSaveTip')}>
                      <span className="inline-flex">
                        <Button
                          type="primary"
                          loading={tagSaveStatus === 'saving'}
                          disabled={!file}
                          className="shrink-0"
                          onClick={() => saveTags({ renameFile: true, silent: false }).catch(() => {})}
                        >
                          {t('renameFileOnSave')}
                        </Button>
                      </span>
                    </Tooltip>
                  </div>

                  {tagSaveStatus === 'error' ? <Typography.Text type="danger">{tagSaveError}</Typography.Text> : null}

                  <Divider className="my-0" />

                  {file.tags?.length ? (
                    <Space wrap>
                      {file.tags.map((tag) => (
                        <Tag key={tag.id} color="blue" closable onClose={(event) => {
                          event.preventDefault()
                          removeTag(tag)
                        }}>
                          {tag.name}
                        </Tag>
                      ))}
                    </Space>
                  ) : (
                    <Empty description={t('tagsEmpty')} />
                  )}
                </Space>
              </GlassSurface>

              <GlassSurface title={t('bookmarks')}>
                <Space direction="vertical" size="middle" className="w-full">
                  <Form layout="inline" className="flex flex-wrap gap-2" onFinish={() => addBookmark().catch(() => {})}>
                    <Form.Item label={t('pageNumber')}>
                      <InputNumber
                        value={newBookmarkPage ?? undefined}
                        min={1}
                        max={totalPages || undefined}
                        style={{ width: 120 }}
                        onChange={(value) => setNewBookmarkPage(value === null ? null : Number(value))}
                      />
                    </Form.Item>
                    <Form.Item label={t('note')} className="flex-1 min-w-[240px]">
                      <Input value={newBookmarkNote} placeholder={t('note')} onChange={(event) => setNewBookmarkNote(event.target.value)} />
                    </Form.Item>
                    <Button type="primary" loading={bookmarkSaving} disabled={!newBookmarkPage} onClick={() => addBookmark().catch(() => {})}>
                      {t('add')}
                    </Button>
                  </Form>

                  {bookmarkError ? <Alert type="error" showIcon message={bookmarkError} /> : null}

                  <Table<BookmarkRecord>
                    columns={bookmarkColumns}
                    dataSource={bookmarks}
                    rowKey={(record) => record.id}
                    size="small"
                    pagination={false}
                    locale={{ emptyText: t('noBookmarksYet') }}
                  />
                </Space>
              </GlassSurface>
            </Space>
          ) : null}
        </Spin>
      </Space>
    </GlassPage>
  )
}
