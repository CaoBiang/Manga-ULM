import { Button, Form, InputNumber, Select, Space, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LibraryViewMode } from '@/store/appSettings'
import { useAppSettingsStore } from '@/store/appSettings'

const perPageOptions = [20, 50, 100, 200]

export default function LibraryBrowseSettings() {
  const { t } = useTranslation()
  const [saving, setSaving] = useState(false)

  const libraryViewMode = useAppSettingsStore((state) => state.libraryViewMode)
  const libraryPerPage = useAppSettingsStore((state) => state.libraryPerPage)
  const libraryLazyRootMarginPx = useAppSettingsStore((state) => state.libraryLazyRootMarginPx)

  const setLibraryViewMode = useAppSettingsStore((state) => state.setLibraryViewMode)
  const setLibraryPerPage = useAppSettingsStore((state) => state.setLibraryPerPage)
  const setLibraryLazyRootMarginPx = useAppSettingsStore((state) => state.setLibraryLazyRootMarginPx)

  const [formViewMode, setFormViewMode] = useState<LibraryViewMode>(libraryViewMode)
  const [formPerPage, setFormPerPage] = useState(libraryPerPage)
  const [formRootMarginPx, setFormRootMarginPx] = useState(libraryLazyRootMarginPx)

  useEffect(() => setFormViewMode(libraryViewMode), [libraryViewMode])
  useEffect(() => setFormPerPage(libraryPerPage), [libraryPerPage])
  useEffect(() => setFormRootMarginPx(libraryLazyRootMarginPx), [libraryLazyRootMarginPx])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([setLibraryViewMode(formViewMode), setLibraryPerPage(formPerPage), setLibraryLazyRootMarginPx(formRootMarginPx)])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('保存图书馆浏览设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    setSaving(true)
    try {
      await Promise.all([setLibraryViewMode('grid'), setLibraryPerPage(20), setLibraryLazyRootMarginPx(1200)])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('重置图书馆浏览设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Form layout="vertical">
        <Form.Item label={t('defaultLibraryViewMode')}>
          <Select
            value={formViewMode}
            style={{ maxWidth: 240 }}
            onChange={(value) => setFormViewMode(value)}
            options={[
              { value: 'grid', label: t('viewGrid') },
              { value: 'list', label: t('viewList') }
            ]}
          />
        </Form.Item>

        <Form.Item label={t('defaultItemsPerPage')}>
          <Select
            value={formPerPage}
            style={{ maxWidth: 240 }}
            onChange={(value) => setFormPerPage(Number(value))}
            options={perPageOptions.map((value) => ({ value, label: `${value}` }))}
          />
        </Form.Item>

        <Form.Item label={t('lazyLoadRootMargin')}>
          <InputNumber
            value={formRootMarginPx}
            min={0}
            max={5000}
            step={50}
            addonAfter="px"
            style={{ maxWidth: 240 }}
            onChange={(value) => setFormRootMarginPx(Number(value ?? 0))}
          />
          <div className="mt-1 text-xs text-gray-500">{t('lazyLoadRootMarginHelp')}</div>
        </Form.Item>

        <Space>
          <Button type="primary" loading={saving} onClick={() => save().catch(() => {})}>
            {t('save')}
          </Button>
          <Button disabled={saving} onClick={() => resetToDefault().catch(() => {})}>
            {t('resetToDefault')}
          </Button>
        </Space>
      </Form>
    </Space>
  )
}

