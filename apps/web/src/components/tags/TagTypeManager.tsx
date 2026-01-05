import { Button, Checkbox, Divider, Empty, Form, Input, InputNumber, List, Modal, Select, Space, Spin, Tag, Typography, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import { useLibraryStore } from '@/store/library'

export type TagType = {
  id: number
  name: string
  sort_order: number | null
}

export type TagTypeManagerProps = {
  types: TagType[]
  onDataChanged: () => void
}

export default function TagTypeManager({ types, onDataChanged }: TagTypeManagerProps) {
  const { t } = useTranslation()
  const checkActiveTasks = useLibraryStore((state) => state.checkActiveTasks)

  const [isCreating, setIsCreating] = useState(false)
  const [newTypeName, setNewTypeName] = useState('')
  const [newTypeSortOrder, setNewTypeSortOrder] = useState(0)

  const [editingTypeId, setEditingTypeId] = useState<number | null>(null)
  const [editingTypeName, setEditingTypeName] = useState('')
  const [editingTypeSortOrder, setEditingTypeSortOrder] = useState(0)

  const [scannedTags, setScannedTags] = useState<string[]>([])
  const [isLoadingScannedTags, setIsLoadingScannedTags] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [selectedScannedTags, setSelectedScannedTags] = useState<string[]>([])
  const [selectedTagType, setSelectedTagType] = useState<number | null>(null)

  useEffect(() => {
    if (!showScanner) {
      setSelectedScannedTags([])
    }
  }, [showScanner])

  const resetCreateForm = () => {
    setIsCreating(false)
    setNewTypeName('')
    setNewTypeSortOrder(0)
  }

  const openCreateDialog = () => {
    setNewTypeName('')
    setNewTypeSortOrder(0)
    setIsCreating(true)
  }

  const createType = async () => {
    if (!newTypeName.trim()) {
      message.warning(t('tagNameAndTypeRequired'))
      return
    }
    try {
      await http.post('/api/v1/tag-types', {
        name: newTypeName,
        sort_order: newTypeSortOrder
      })
      message.success(t('settingsSavedSuccessfully'))
      resetCreateForm()
      onDataChanged()
    } catch (error) {
      console.error('创建标签类型失败：', error)
      message.error(t('errorCreatingTagType') + ((error as any)?.response?.data?.error || ''))
    }
  }

  const deleteType = (id: number) => {
    Modal.confirm({
      title: t('confirmDeleteTagType'),
      okType: 'danger',
      okText: t('delete'),
      cancelText: t('cancel'),
      onOk: async () => {
        try {
          await http.delete(`/api/v1/tag-types/${id}`)
          message.success(t('settingsSavedSuccessfully'))
          onDataChanged()
        } catch (error) {
          console.error('删除标签类型失败：', error)
          message.error(t('errorDeletingTagType') + ((error as any)?.response?.data?.error || ''))
        }
      }
    })
  }

  const startEditing = (type: TagType) => {
    setEditingTypeId(type.id)
    setEditingTypeName(type.name)
    setEditingTypeSortOrder(type.sort_order || 0)
  }

  const cancelEditing = () => {
    setEditingTypeId(null)
  }

  const saveEdit = async () => {
    if (!editingTypeId) {
      return
    }
    if (!editingTypeName.trim()) {
      message.warning(t('tagNameAndTypeRequired'))
      return
    }
    try {
      await http.put(`/api/v1/tag-types/${editingTypeId}`, {
        name: editingTypeName,
        sort_order: editingTypeSortOrder
      })
      message.success(t('settingsSavedSuccessfully'))
      cancelEditing()
      onDataChanged()
    } catch (error) {
      console.error('更新标签类型失败：', error)
      message.error(t('errorUpdatingTagType') + ((error as any)?.response?.data?.error || ''))
    }
  }

  const startScan = async () => {
    setShowScanner(true)
    setIsLoadingScannedTags(true)
    setSelectedScannedTags([])
    setSelectedTagType(types[0]?.id ?? null)
    try {
      const response = await http.get('/api/v1/reports/undefined-tags')
      setScannedTags((response?.data || []) as string[])
    } catch (error) {
      console.error('扫描未定义标签失败：', error)
      message.error(t('errorScanningTags') + ((error as any)?.response?.data?.error || ''))
    } finally {
      setIsLoadingScannedTags(false)
      checkActiveTasks().catch(() => {})
    }
  }

  const addSelectedTags = async () => {
    if (!selectedScannedTags.length || !selectedTagType) {
      message.warning(t('selectTagsAndType'))
      return
    }
    try {
      for (const tagName of selectedScannedTags) {
        await http.post('/api/v1/tags', { name: tagName, type_id: selectedTagType })
      }
      message.success(t('tagsAddedSuccessfully'))
      setShowScanner(false)
      setScannedTags([])
      onDataChanged()
    } catch (error) {
      console.error('新增标签失败：', error)
      message.error(t('errorAddingTags') + ((error as any)?.response?.data?.error || ''))
    }
  }

  return (
    <Space direction="vertical" size="middle" className="w-full">
      <List
        bordered
        dataSource={types}
        itemLayout="horizontal"
        renderItem={(item) => (
          <List.Item key={`tag-type-${item.id}`}>
            {editingTypeId === item.id ? (
              <Space wrap className="w-full">
                <Input value={editingTypeName} placeholder={t('typeName')} style={{ minWidth: 180 }} onChange={(e) => setEditingTypeName(e.target.value)} />
                <InputNumber value={editingTypeSortOrder} placeholder={t('sortValue')} style={{ width: 120 }} onChange={(v) => setEditingTypeSortOrder(Number(v ?? 0))} />
                <Space size="small">
                  <Button type="primary" size="small" onClick={() => saveEdit().catch(() => {})}>
                    {t('save')}
                  </Button>
                  <Button size="small" onClick={cancelEditing}>
                    {t('cancel')}
                  </Button>
                </Space>
              </Space>
            ) : (
              <div className="flex w-full flex-wrap items-center justify-between gap-3">
                <div>
                  <Typography.Text strong>{item.name}</Typography.Text>
                  <Tag className="ml-2">
                    {t('sortOrder')}: {item.sort_order}
                  </Tag>
                </div>
                <Space size="small">
                  <Button size="small" onClick={() => startEditing(item)}>
                    {t('edit')}
                  </Button>
                  <Button danger size="small" onClick={() => deleteType(item.id)}>
                    {t('delete')}
                  </Button>
                </Space>
              </div>
            )}
          </List.Item>
        )}
        footer={
          <Button type="dashed" block onClick={openCreateDialog}>
            + {t('newType')}
          </Button>
        }
      />

      <Modal
        open={isCreating}
        title={t('newType')}
        okText={t('save')}
        cancelText={t('cancel')}
        onOk={() => createType().catch(() => {})}
        onCancel={resetCreateForm}
      >
        <Form layout="vertical">
          <Form.Item label={t('typeName')} required>
            <Input value={newTypeName} onChange={(e) => setNewTypeName(e.target.value)} />
          </Form.Item>
          <Form.Item label={t('sortValue')}>
            <InputNumber value={newTypeSortOrder} style={{ width: 160 }} onChange={(v) => setNewTypeSortOrder(Number(v ?? 0))} />
          </Form.Item>
        </Form>
      </Modal>

      <Divider />

      <Button type="primary" ghost onClick={() => startScan().catch(() => {})}>
        {t('scanNewTags')}
      </Button>

      <Modal
        open={showScanner}
        title={t('foundUndefinedTags')}
        okText={t('addSelectedTags')}
        cancelText={t('close')}
        okButtonProps={{ disabled: selectedScannedTags.length === 0 || !selectedTagType }}
        onOk={() => addSelectedTags().catch(() => {})}
        onCancel={() => setShowScanner(false)}
      >
        <Spin spinning={isLoadingScannedTags}>
          {!isLoadingScannedTags && scannedTags.length === 0 ? (
            <Empty description={t('noNewTagsFound')} />
          ) : (
            <Space direction="vertical" size="middle" className="w-full">
              <Checkbox.Group
                value={selectedScannedTags}
                onChange={(value) => setSelectedScannedTags(value as string[])}
                className="grid grid-cols-1 sm:grid-cols-2 gap-2"
              >
                {scannedTags.map((tag) => (
                  <Checkbox key={`scanned-${tag}`} value={tag}>
                    {tag}
                  </Checkbox>
                ))}
              </Checkbox.Group>

              <Form layout="vertical">
                <Form.Item label={t('tagTypes')}>
                  <Select
                    value={selectedTagType ?? undefined}
                    placeholder={t('type')}
                    onChange={(value) => setSelectedTagType(Number(value))}
                    options={types.map((type) => ({ value: type.id, label: type.name }))}
                  />
                </Form.Item>
              </Form>

              <Typography.Text type="secondary">{t('tagsSelected', { count: selectedScannedTags.length })}</Typography.Text>
            </Space>
          )}
        </Spin>
      </Modal>
    </Space>
  )
}
