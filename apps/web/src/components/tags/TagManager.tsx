import { Alert, Button, Card, Form, Input, List, Modal, Pagination, Radio, Select, Space, Table, Tag, Typography, message } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import type { TagType } from '@/components/tags/TagTypeManager'
import { useLibraryStore } from '@/store/library'

export type TagSuggestion = {
  id: number
  name: string
  type_id: number
  usage_count: number
}

export type TagRecord = {
  id: number
  name: string
  description: string | null
  type_id: number
  parent_id: number | null
  aliases: string[]
  usage_count: number
}

type TagListResponse = {
  tags: TagRecord[]
  total: number
  page: number
  pages: number
}

type PreviewResult = { impacted: number; examples: Array<{ old: string; new: string }> }

type FileChangeAction = 'delete' | 'rename' | 'split'

export type TagManagerProps = {
  types: TagType[]
}

type TagFormState = {
  id: number | null
  name: string
  description: string
  type_id: number | null
  parent_id: number | null
  aliases: string[]
  newAlias: string
}

const unique = (values: string[]) => {
  const seen = new Set<string>()
  const list: string[] = []
  for (const value of values) {
    const trimmed = String(value || '').trim()
    if (!trimmed) continue
    if (seen.has(trimmed)) continue
    seen.add(trimmed)
    list.push(trimmed)
  }
  return list
}

export default function TagManager({ types }: TagManagerProps) {
  const { t } = useTranslation()
  const checkActiveTasks = useLibraryStore((state) => state.checkActiveTasks)

  const [tags, setTags] = useState<TagRecord[]>([])
  const [selectedTypeId, setSelectedTypeId] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalTags, setTotalTags] = useState(0)
  const perPage = 20

  const [editorOpen, setEditorOpen] = useState(false)
  const [editingTag, setEditingTag] = useState<TagRecord | null>(null)
  const [tagForm, setTagForm] = useState<TagFormState>({
    id: null,
    name: '',
    description: '',
    type_id: null,
    parent_id: null,
    aliases: [],
    newAlias: ''
  })

  const [parentSuggestions, setParentSuggestions] = useState<TagSuggestion[]>([])
  const [parentLoading, setParentLoading] = useState(false)

  const [fileChangeOpen, setFileChangeOpen] = useState(false)
  const [fileChangeTag, setFileChangeTag] = useState<TagRecord | null>(null)
  const [fileChangeAction, setFileChangeAction] = useState<FileChangeAction>('delete')
  const [newTagName, setNewTagName] = useState('')
  const [newTagNames, setNewTagNames] = useState<string[]>([])
  const [newTagNameInput, setNewTagNameInput] = useState('')
  const [fileChanging, setFileChanging] = useState(false)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewResult>({ impacted: 0, examples: [] })

  const [mergeOpen, setMergeOpen] = useState(false)
  const [mergeSourceTag, setMergeSourceTag] = useState<TagRecord | null>(null)
  const [mergeTarget, setMergeTarget] = useState<number | null>(null)
  const [mergeSuggestions, setMergeSuggestions] = useState<TagSuggestion[]>([])
  const [merging, setMerging] = useState(false)

  const getTypeName = useCallback((typeId: number) => types.find((type) => type.id === typeId)?.name || t('none'), [t, types])
  const getParentName = useCallback(
    (parentId: number | null) => {
      if (!parentId) return t('none')
      const parent = tags.find((tag) => tag.id === parentId)
      return parent ? parent.name : t('none')
    },
    [t, tags]
  )

  const fetchTags = useCallback(
    async (page: number) => {
      setLoading(true)
      try {
        const response = await http.get('/api/v1/tags', {
          params: {
            page,
            per_page: perPage,
            type_id: selectedTypeId ?? undefined
          }
        })
        const data = response?.data as TagListResponse
        setTags(data?.tags || [])
        setCurrentPage(data?.page || page)
        setTotalPages(data?.pages || 1)
        setTotalTags(data?.total || 0)
      } catch (error) {
        console.error('加载标签列表失败：', error)
        message.error(t('errorFetchingTags'))
      } finally {
        setLoading(false)
      }
    },
    [perPage, selectedTypeId, t]
  )

  useEffect(() => {
    fetchTags(1).catch(() => {})
  }, [fetchTags, selectedTypeId])

  const openCreateModal = () => {
    setEditingTag(null)
    setTagForm({
      id: null,
      name: '',
      description: '',
      type_id: selectedTypeId ?? types[0]?.id ?? null,
      parent_id: null,
      aliases: [],
      newAlias: ''
    })
    setParentSuggestions([])
    setEditorOpen(true)
  }

  const openEditModal = (tag: TagRecord) => {
    setEditingTag(tag)
    setTagForm({
      id: tag.id,
      name: tag.name,
      description: tag.description || '',
      type_id: tag.type_id,
      parent_id: tag.parent_id,
      aliases: Array.isArray(tag.aliases) ? tag.aliases.slice() : [],
      newAlias: ''
    })
    setParentSuggestions([])
    setEditorOpen(true)
  }

  const closeEditor = () => {
    setEditorOpen(false)
    setEditingTag(null)
    setParentSuggestions([])
  }

  const loadParentSuggestions = useCallback(
    async (keyword: string) => {
      const typeId = tagForm.type_id
      if (!typeId) return
      setParentLoading(true)
      try {
        const response = await http.get('/api/v1/tag-suggestions', { params: { q: keyword, type_id: typeId, limit: 20 } })
        const list = (response?.data || []) as TagSuggestion[]
        setParentSuggestions(list.filter((item) => item.id !== tagForm.id))
      } catch (error) {
        console.error('加载父级标签建议失败：', error)
      } finally {
        setParentLoading(false)
      }
    },
    [tagForm.id, tagForm.type_id]
  )

  useEffect(() => {
    if (!editorOpen) return
    if (!tagForm.type_id) return
    loadParentSuggestions('').catch(() => {})
  }, [editorOpen, loadParentSuggestions, tagForm.type_id])

  const addAlias = () => {
    const trimmed = String(tagForm.newAlias || '').trim()
    if (!trimmed) return
    if (tagForm.aliases.includes(trimmed)) {
      message.warning(t('aliasAlreadyExists'))
      return
    }
    setTagForm((prev) => ({ ...prev, aliases: prev.aliases.concat([trimmed]), newAlias: '' }))
  }

  const removeAlias = (alias: string) => {
    setTagForm((prev) => ({ ...prev, aliases: prev.aliases.filter((value) => value !== alias) }))
  }

  const saveTag = async () => {
    if (!tagForm.name.trim() || !tagForm.type_id) {
      message.warning(t('tagNameAndTypeRequired'))
      return
    }

    const payload = {
      name: tagForm.name.trim(),
      description: tagForm.description || '',
      type_id: tagForm.type_id,
      parent_id: tagForm.parent_id,
      aliases: unique(tagForm.aliases)
    }

    try {
      if (editingTag) {
        await http.put(`/api/v1/tags/${editingTag.id}`, payload)
      } else {
        await http.post('/api/v1/tags', payload)
      }
      message.success(t('settingsSavedSuccessfully'))
      closeEditor()
      fetchTags(currentPage).catch(() => {})
    } catch (error) {
      console.error('保存标签失败：', error)
      message.error(t('errorSavingTag') + ((error as any)?.response?.data?.error || ''))
    }
  }

  const deleteTag = (tag: TagRecord) => {
    Modal.confirm({
      title: t('confirmDeletionTitle'),
      content: t('confirmDeleteTagWithUsage', { name: tag.name, count: tag.usage_count ?? 0 }),
      okType: 'danger',
      okText: t('delete'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          await http.delete(`/api/v1/tags/${tag.id}`)
          message.success(t('settingsSavedSuccessfully'))
          fetchTags(currentPage).catch(() => {})
        } catch (error) {
          console.error('删除标签失败：', error)
          message.error(t('errorDeletingTag') + ((error as any)?.response?.data?.error || ''))
        }
      }
    })
  }

  const openFileChangeModal = (tag: TagRecord) => {
    setFileChangeTag(tag)
    setFileChangeAction('delete')
    setNewTagName('')
    setNewTagNames([])
    setNewTagNameInput('')
    setPreviewData({ impacted: 0, examples: [] })
    setFileChangeOpen(true)
  }

  const closeFileChangeModal = () => {
    setFileChangeOpen(false)
    setFileChangeTag(null)
    setFileChangeAction('delete')
    setNewTagName('')
    setNewTagNames([])
    setNewTagNameInput('')
    setPreviewData({ impacted: 0, examples: [] })
  }

  const fileChangeOkDisabled = useMemo(() => {
    if (!fileChangeTag) return true
    if (fileChangeAction === 'rename') return !newTagName.trim()
    if (fileChangeAction === 'split') return newTagNames.length === 0
    return false
  }, [fileChangeAction, fileChangeTag, newTagName, newTagNames.length])

  const loadPreview = async () => {
    if (!fileChangeTag) return
    setPreviewLoading(true)
    try {
      if (fileChangeAction === 'split') {
        const response = await http.post('/api/v1/tag-splits/preview', { tag_id: fileChangeTag.id, new_tag_names: newTagNames })
        setPreviewData((response?.data || { impacted: 0, examples: [] }) as PreviewResult)
        return
      }

      const response = await http.post('/api/v1/tag-file-changes/preview', {
        tag_id: fileChangeTag.id,
        action: fileChangeAction,
        new_name: fileChangeAction === 'rename' ? newTagName.trim() : undefined
      })
      setPreviewData((response?.data || { impacted: 0, examples: [] }) as PreviewResult)
    } catch (error) {
      console.error('加载预览失败：', error)
      message.error(t('errorLoadingPreview') + ((error as any)?.response?.data?.error || ''))
    } finally {
      setPreviewLoading(false)
    }
  }

  const executeFileChange = async () => {
    if (!fileChangeTag) return
    if (fileChangeAction === 'rename' && !newTagName.trim()) {
      message.warning(t('pleaseEnterNewTagName'))
      return
    }
    if (fileChangeAction === 'split' && newTagNames.length === 0) {
      message.warning(t('noNewTagsAdded'))
      return
    }
    setFileChanging(true)
    try {
      if (fileChangeAction === 'split') {
        await http.post('/api/v1/tag-splits', { tag_id: fileChangeTag.id, new_tag_names: newTagNames })
      } else {
        await http.post('/api/v1/tag-file-changes', {
          tag_id: fileChangeTag.id,
          action: fileChangeAction,
          new_name: fileChangeAction === 'rename' ? newTagName.trim() : undefined
        })
      }
      message.success(t('operationSubmittedCheckTaskManager'))
      closeFileChangeModal()
    } catch (error) {
      console.error('提交操作失败：', error)
      message.error(t('errorStartingOperation') + ((error as any)?.response?.data?.error || (error as any)?.message || ''))
    } finally {
      setFileChanging(false)
      checkActiveTasks().catch(() => {})
    }
  }

  const addNewTagName = () => {
    const trimmed = newTagNameInput.trim()
    if (!trimmed) return
    setNewTagNames((prev) => (prev.includes(trimmed) ? prev : prev.concat([trimmed])))
    setNewTagNameInput('')
  }

  const removeNewTagName = (value: string) => {
    setNewTagNames((prev) => prev.filter((item) => item !== value))
  }

  const openMergeModal = (tag: TagRecord) => {
    setMergeSourceTag(tag)
    setMergeTarget(null)
    setMergeSuggestions([])
    setMergeOpen(true)
  }

  const searchMergeTargets = async (keyword: string) => {
    if (!mergeSourceTag) return
    const response = await http.get('/api/v1/tag-suggestions', { params: { q: keyword, type_id: mergeSourceTag.type_id, limit: 20 } })
    const list = (response?.data || []) as TagSuggestion[]
    setMergeSuggestions(list.filter((item) => item.id !== mergeSourceTag.id))
  }

  const executeMerge = async () => {
    if (!mergeSourceTag || !mergeTarget) return
    setMerging(true)
    try {
      await http.post('/api/v1/tag-merges', { source_tag_id: mergeSourceTag.id, target_tag_id: mergeTarget })
      message.success(t('mergeSuccess'))
      setMergeOpen(false)
      fetchTags(currentPage).catch(() => {})
    } catch (error) {
      console.error('合并标签失败：', error)
      message.error(t('mergeError') + ((error as any)?.response?.data?.error || ''))
    } finally {
      setMerging(false)
      checkActiveTasks().catch(() => {})
    }
  }

  const columns: ColumnsType<TagRecord> = useMemo(
    () => [
      { title: t('name'), dataIndex: 'name', key: 'name' },
      {
        title: t('description'),
        key: 'description',
        render: (_value: unknown, record) => <Typography.Text type="secondary">{record.description || '-'}</Typography.Text>
      },
      { title: t('type'), key: 'type', render: (_value: unknown, record) => getTypeName(record.type_id) },
      { title: t('parentTag'), key: 'parent', render: (_value: unknown, record) => getParentName(record.parent_id) },
      {
        title: t('aliases'),
        key: 'aliases',
        render: (_value: unknown, record) => (
          <Space wrap>
            {(record.aliases || []).length ? (
              (record.aliases || []).map((alias) => <Tag key={`${record.id}-alias-${alias}`}>{alias}</Tag>)
            ) : (
              <Typography.Text type="secondary">-</Typography.Text>
            )}
          </Space>
        )
      },
      {
        title: t('usage'),
        key: 'usage',
        width: 110,
        render: (_value: unknown, record) => <Tag color="blue">{record.usage_count ?? 0}</Tag>
      },
      {
        title: t('actions'),
        key: 'actions',
        width: 340,
        render: (_value: unknown, record) => (
          <Space size="small" wrap>
            <Button size="small" onClick={() => openEditModal(record)}>
              {t('edit')}
            </Button>
            <Button size="small" onClick={() => openFileChangeModal(record)}>
              {t('fileChange')}
            </Button>
            <Button size="small" onClick={() => openMergeModal(record)}>
              {t('mergeTag')}
            </Button>
            <Button size="small" danger onClick={() => deleteTag(record)}>
              {t('delete')}
            </Button>
          </Space>
        )
      }
    ],
    [getParentName, getTypeName, t]
  )

  const parentOptions = useMemo(() => {
    const list = parentSuggestions || []
    return list.map((item) => ({
      value: item.id,
      label: `${item.name} (${getTypeName(item.type_id)})`
    }))
  }, [getTypeName, parentSuggestions])

  const mergeOptions = useMemo(() => {
    const list = mergeSuggestions || []
    return list.map((item) => ({
      value: item.id,
      label: `${item.name} (${t('usage')}: ${item.usage_count ?? 0})`
    }))
  }, [mergeSuggestions, t])

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Card className="shadow-sm">
        <Space direction="vertical" size="large" className="w-full">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Form layout="inline">
              <Form.Item label={t('filterByType')}>
                <Select
                  value={selectedTypeId ?? undefined}
                  allowClear
                  style={{ minWidth: 220 }}
                  placeholder={t('allTypes')}
                  onChange={(value) => setSelectedTypeId(value ? Number(value) : null)}
                  options={types.map((type) => ({ value: type.id, label: type.name }))}
                />
              </Form.Item>
            </Form>

            <Button type="primary" onClick={openCreateModal}>
              + {t('newTag')}
            </Button>
          </div>

          <Table<TagRecord>
            rowKey={(record) => record.id}
            dataSource={tags}
            loading={loading}
            pagination={false}
            size="middle"
            columns={columns}
            locale={{ emptyText: t('noTagsFoundForType') }}
          />

          <div className="flex justify-end">
            <Pagination
              simple
              current={currentPage}
              total={totalPages}
              pageSize={1}
              onChange={(page) => fetchTags(page).catch(() => {})}
            />
          </div>
        </Space>
      </Card>

      <Modal
        open={editorOpen}
        title={editingTag ? `${t('edit')} ${t('tag')}` : t('newTag')}
        okText={t('save')}
        cancelText={t('cancel')}
        width={640}
        onOk={() => saveTag().catch(() => {})}
        onCancel={closeEditor}
      >
        <Form layout="vertical">
          <Form.Item label={t('name')} required>
            <Input value={tagForm.name} onChange={(event) => setTagForm((prev) => ({ ...prev, name: event.target.value }))} />
          </Form.Item>
          <Form.Item label={t('description')}>
            <Input.TextArea
              value={tagForm.description}
              rows={3}
              onChange={(event) => setTagForm((prev) => ({ ...prev, description: event.target.value }))}
            />
          </Form.Item>
          <Form.Item label={t('type')} required>
            <Select
              value={tagForm.type_id ?? undefined}
              dropdownMatchSelectWidth={false}
              onChange={(value) => {
                const nextTypeId = value ? Number(value) : null
                setTagForm((prev) => ({ ...prev, type_id: nextTypeId, parent_id: null }))
              }}
              options={types.map((type) => ({ value: type.id, label: type.name }))}
            />
          </Form.Item>
          <Form.Item label={t('parentTag')}>
            <Select
              value={tagForm.parent_id ?? undefined}
              showSearch
              allowClear
              filterOption={false}
              placeholder={t('none')}
              notFoundContent={parentLoading ? t('loading') : null}
              onSearch={(value) => loadParentSuggestions(value).catch(() => {})}
              onFocus={() => loadParentSuggestions('').catch(() => {})}
              onChange={(value) => setTagForm((prev) => ({ ...prev, parent_id: value ? Number(value) : null }))}
              dropdownMatchSelectWidth={false}
              options={parentOptions}
            />
          </Form.Item>
          <Form.Item label={t('aliases')}>
            <Space align="start" className="w-full">
              <Input
                value={tagForm.newAlias}
                placeholder={t('aliases')}
                onChange={(event) => setTagForm((prev) => ({ ...prev, newAlias: event.target.value }))}
                onPressEnter={(event) => {
                  event.preventDefault()
                  addAlias()
                }}
              />
              <Button type="dashed" onClick={addAlias}>
                {t('add')}
              </Button>
            </Space>

            <div className="mt-2 flex flex-wrap gap-2">
              {tagForm.aliases.map((alias) => (
                <Tag key={`alias-${alias}`} closable onClose={(event) => {
                  event.preventDefault()
                  removeAlias(alias)
                }}>
                  {alias}
                </Tag>
              ))}
            </div>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={fileChangeOpen}
        title={`${t('fileChange')} - ${fileChangeTag?.name || ''}`}
        cancelText={t('cancel')}
        okButtonProps={{ disabled: fileChangeOkDisabled }}
        confirmLoading={fileChanging}
        width={720}
        onOk={() => executeFileChange().catch(() => {})}
        onCancel={closeFileChangeModal}
      >
        <Form layout="vertical">
          <Form.Item label={t('selectAction')}>
            <Radio.Group value={fileChangeAction} onChange={(event) => setFileChangeAction(event.target.value as FileChangeAction)}>
              <Space direction="vertical">
                <Radio value="delete">
                  {t('deleteTagFromFilenames')} [{fileChangeTag?.name || ''}]
                </Radio>
                <Radio value="rename">
                  {t('renameTagInFilenames')} [{fileChangeTag?.name || ''}]
                </Radio>
                <Radio value="split">
                  {t('splitTagInFilenames')} [{fileChangeTag?.name || ''}]
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

          {fileChangeAction === 'rename' ? (
            <Form.Item label={t('newTagName')}>
              <Input value={newTagName} placeholder={fileChangeTag?.name || ''} onChange={(event) => setNewTagName(event.target.value)} />
            </Form.Item>
          ) : null}

          {fileChangeAction === 'split' ? (
            <Space direction="vertical" size="middle" className="w-full">
              <Form.Item label={t('addNewTagName')}>
                <Space className="w-full">
                  <Input
                    value={newTagNameInput}
                    placeholder={t('newTagNamePlaceholder')}
                    onChange={(event) => setNewTagNameInput(event.target.value)}
                    onPressEnter={(event) => {
                      event.preventDefault()
                      addNewTagName()
                    }}
                  />
                  <Button type="dashed" onClick={addNewTagName}>
                    {t('add')}
                  </Button>
                </Space>
              </Form.Item>

              {newTagNames.length ? (
                <List
                  size="small"
                  bordered
                  dataSource={newTagNames}
                  renderItem={(item) => (
                    <List.Item className="flex items-center justify-between">
                      <Typography.Text>[{item}]</Typography.Text>
                      <Button type="text" danger size="small" onClick={() => removeNewTagName(item)}>
                        {t('delete')}
                      </Button>
                    </List.Item>
                  )}
                />
              ) : null}
            </Space>
          ) : null}

          <Space direction="vertical" className="w-full">
            <Button loading={previewLoading} onClick={() => loadPreview().catch(() => {})}>
              {t('preview')}
            </Button>

            <Typography.Paragraph>
              {t('impactedFiles')}: <Typography.Text strong>{previewData.impacted || 0}</Typography.Text>
            </Typography.Paragraph>

            {previewData.examples?.length ? (
              <List
                size="small"
                bordered
                dataSource={previewData.examples}
                renderItem={(item) => (
                  <List.Item>
                    <div className="flex flex-col">
                      <span>
                        <strong>{t('previewOldLabel')}:</strong> {item.old}
                      </span>
                      <span>
                        <strong>{t('previewNewLabel')}:</strong> {item.new}
                      </span>
                    </div>
                  </List.Item>
                )}
              />
            ) : null}

            <Alert type="warning" showIcon message={t('warningFileRename')} />
          </Space>
        </Form>
      </Modal>

      <Modal
        open={mergeOpen}
        title={t('mergeTag')}
        okText={t('confirmMerge')}
        cancelText={t('cancel')}
        confirmLoading={merging}
        onOk={() => executeMerge().catch(() => {})}
        onCancel={() => setMergeOpen(false)}
      >
        <Form layout="vertical">
          <Form.Item label={t('selectTargetTag')}>
            <Select
              value={mergeTarget ?? undefined}
              showSearch
              filterOption={false}
              placeholder={t('selectTargetTag')}
              onSearch={(value) => searchMergeTargets(value).catch(() => {})}
              onFocus={() => searchMergeTargets('').catch(() => {})}
              onChange={(value) => setMergeTarget(value ? Number(value) : null)}
              options={mergeOptions}
            />
          </Form.Item>
        </Form>
      </Modal>
    </Space>
  )
}
