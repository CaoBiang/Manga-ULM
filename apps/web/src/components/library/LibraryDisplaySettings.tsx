import { Button, Checkbox, Col, Form, InputNumber, Row, Select, Space, Typography, message } from 'antd'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { http } from '@/api/http'
import type { LibraryCardFieldKey, LibraryCardFields, LibraryGridColumns } from '@/store/uiSettings'
import { DEFAULT_LIBRARY_CARD_FIELDS, DEFAULT_LIBRARY_GRID_COLUMNS, LIBRARY_CARD_FIELD_DEFS, useUiSettingsStore } from '@/store/uiSettings'

type TagType = {
  id: number
  name: string
  sort_order?: number | null
}

const breakpoints = Object.freeze([
  { key: 'base', labelKey: 'libraryGridBreakpointBase' },
  { key: 'sm', labelKey: 'libraryGridBreakpointSm' },
  { key: 'md', labelKey: 'libraryGridBreakpointMd' },
  { key: 'lg', labelKey: 'libraryGridBreakpointLg' },
  { key: 'xl', labelKey: 'libraryGridBreakpointXl' },
  { key: '2xl', labelKey: 'libraryGridBreakpoint2xl' }
] as const)

export default function LibraryDisplaySettings() {
  const { t } = useTranslation()

  const ensureLoaded = useUiSettingsStore((state) => state.ensureLoaded)
  const saveLibraryDisplaySettings = useUiSettingsStore((state) => state.saveLibraryDisplaySettings)
  const resetLibraryDisplaySettings = useUiSettingsStore((state) => state.resetLibraryDisplaySettings)

  const libraryGridColumns = useUiSettingsStore((state) => state.libraryGridColumns)
  const libraryCardFields = useUiSettingsStore((state) => state.libraryCardFields)
  const libraryAuthorTagTypeId = useUiSettingsStore((state) => state.libraryAuthorTagTypeId)

  const [saving, setSaving] = useState(false)
  const [tagTypesLoading, setTagTypesLoading] = useState(false)
  const [tagTypes, setTagTypes] = useState<TagType[]>([])

  const [columnsDraft, setColumnsDraft] = useState<LibraryGridColumns>({ ...DEFAULT_LIBRARY_GRID_COLUMNS })
  const [gridFieldsDraft, setGridFieldsDraft] = useState<LibraryCardFieldKey[]>([...DEFAULT_LIBRARY_CARD_FIELDS.grid])
  const [listFieldsDraft, setListFieldsDraft] = useState<LibraryCardFieldKey[]>([...DEFAULT_LIBRARY_CARD_FIELDS.list])
  const [authorTagTypeIdDraft, setAuthorTagTypeIdDraft] = useState<number | null>(null)

  const fieldOptions = useMemo(
    () => LIBRARY_CARD_FIELD_DEFS.map((item) => ({ value: item.key, label: t(item.labelKey) })),
    [t]
  )

  useEffect(() => {
    ensureLoaded().catch(() => {})
  }, [ensureLoaded])

  useEffect(() => {
    setColumnsDraft({ ...DEFAULT_LIBRARY_GRID_COLUMNS, ...(libraryGridColumns || {}) })
    setGridFieldsDraft([...(libraryCardFields?.grid || DEFAULT_LIBRARY_CARD_FIELDS.grid)])
    setListFieldsDraft([...(libraryCardFields?.list || DEFAULT_LIBRARY_CARD_FIELDS.list)])
    setAuthorTagTypeIdDraft(libraryAuthorTagTypeId || null)
  }, [libraryAuthorTagTypeId, libraryCardFields, libraryGridColumns])

  const loadTagTypes = useCallback(async () => {
    setTagTypesLoading(true)
    try {
      const response = await http.get('/api/v1/tag-types')
      setTagTypes((response?.data || []) as TagType[])
    } catch (error) {
      console.error('加载标签类型失败：', error)
      message.error(t('failedToLoadTagTypes'))
    } finally {
      setTagTypesLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadTagTypes().catch(() => {})
  }, [loadTagTypes])

  const save = async () => {
    setSaving(true)
    try {
      const cardFields: LibraryCardFields = {
        grid: gridFieldsDraft,
        list: listFieldsDraft
      }
      await saveLibraryDisplaySettings({
        gridColumns: columnsDraft,
        cardFields,
        authorTagTypeId: authorTagTypeIdDraft
      })
      message.success(t('libraryDisplaySettingsSaved'))
    } catch (error) {
      console.error('保存图书馆展示设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  const reset = async () => {
    setSaving(true)
    try {
      await resetLibraryDisplaySettings()
      message.success(t('libraryDisplaySettingsReset'))
    } catch (error) {
      console.error('重置图书馆展示设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form layout="vertical" onFinish={() => save().catch(() => {})}>
      <Form.Item label={t('libraryGridColumns')}>
        <Row gutter={[12, 12]}>
          {breakpoints.map((bp) => (
            <Col key={`grid-bp-${bp.key}`} xs={12} sm={8} md={4}>
              <InputNumber
                min={1}
                max={24}
                className="w-full"
                value={(columnsDraft as any)[bp.key]}
                onChange={(value) =>
                  setColumnsDraft((prev) => ({
                    ...prev,
                    [bp.key]: Number(value ?? prev[bp.key as keyof LibraryGridColumns])
                  }))
                }
              />
              <div className="mt-1 text-xs text-gray-500">{t(bp.labelKey)}</div>
            </Col>
          ))}
        </Row>
        <Typography.Text type="secondary" className="text-xs">
          {t('libraryGridColumnsHelp')}
        </Typography.Text>
      </Form.Item>

      <Form.Item label={t('libraryCardFieldsGrid')}>
        <Checkbox.Group value={gridFieldsDraft} options={fieldOptions} onChange={(value) => setGridFieldsDraft(value as any)} />
      </Form.Item>

      <Form.Item label={t('libraryCardFieldsList')}>
        <Checkbox.Group value={listFieldsDraft} options={fieldOptions} onChange={(value) => setListFieldsDraft(value as any)} />
        <Typography.Text type="secondary" className="text-xs">
          {t('libraryCardFieldsHelp')}
        </Typography.Text>
      </Form.Item>

      <Form.Item label={t('libraryAuthorTagType')}>
        <Select
          allowClear
          loading={tagTypesLoading}
          placeholder={t('libraryAuthorTagTypePlaceholder')}
          style={{ maxWidth: 360 }}
          value={authorTagTypeIdDraft ?? undefined}
          onChange={(value) => setAuthorTagTypeIdDraft(typeof value === 'number' ? value : null)}
          options={tagTypes.map((type) => ({ value: type.id, label: type.name }))}
        />
        <Typography.Text type="secondary" className="text-xs">
          {t('libraryAuthorTagTypeHelp')}
        </Typography.Text>
      </Form.Item>

      <Space>
        <Button type="primary" loading={saving} onClick={() => save().catch(() => {})}>
          {t('save')}
        </Button>
        <Button disabled={saving} onClick={() => reset().catch(() => {})}>
          {t('resetToDefault')}
        </Button>
      </Space>
    </Form>
  )
}

