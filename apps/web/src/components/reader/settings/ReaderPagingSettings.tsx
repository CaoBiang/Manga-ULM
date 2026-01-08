import { Button, Form, InputNumber, Space, Switch, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettingsStore } from '@/store/appSettings'

export default function ReaderPagingSettings() {
  const { t } = useTranslation()

  const readerSplitDefaultEnabled = useAppSettingsStore((state) => state.readerSplitDefaultEnabled)
  const readerWideRatioThreshold = useAppSettingsStore((state) => state.readerWideRatioThreshold)
  const readerToolbarKeepStateOnPaging = useAppSettingsStore((state) => state.readerToolbarKeepStateOnPaging)
  const readerToolbarCenterClickToggleEnabled = useAppSettingsStore((state) => state.readerToolbarCenterClickToggleEnabled)

  const setReaderSplitDefaultEnabled = useAppSettingsStore((state) => state.setReaderSplitDefaultEnabled)
  const setReaderWideRatioThreshold = useAppSettingsStore((state) => state.setReaderWideRatioThreshold)
  const setReaderToolbarKeepStateOnPaging = useAppSettingsStore((state) => state.setReaderToolbarKeepStateOnPaging)
  const setReaderToolbarCenterClickToggleEnabled = useAppSettingsStore((state) => state.setReaderToolbarCenterClickToggleEnabled)

  const [saving, setSaving] = useState(false)
  const [formSplitDefaultEnabled, setFormSplitDefaultEnabled] = useState(readerSplitDefaultEnabled)
  const [formWideRatioThreshold, setFormWideRatioThreshold] = useState(readerWideRatioThreshold)
  const [formToolbarKeepStateOnPaging, setFormToolbarKeepStateOnPaging] = useState(readerToolbarKeepStateOnPaging)
  const [formToolbarCenterClickToggleEnabled, setFormToolbarCenterClickToggleEnabled] = useState(readerToolbarCenterClickToggleEnabled)

  useEffect(() => setFormSplitDefaultEnabled(readerSplitDefaultEnabled), [readerSplitDefaultEnabled])
  useEffect(() => setFormWideRatioThreshold(readerWideRatioThreshold), [readerWideRatioThreshold])
  useEffect(() => setFormToolbarKeepStateOnPaging(readerToolbarKeepStateOnPaging), [readerToolbarKeepStateOnPaging])
  useEffect(() => setFormToolbarCenterClickToggleEnabled(readerToolbarCenterClickToggleEnabled), [readerToolbarCenterClickToggleEnabled])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        setReaderSplitDefaultEnabled(formSplitDefaultEnabled),
        setReaderWideRatioThreshold(formWideRatioThreshold),
        setReaderToolbarKeepStateOnPaging(formToolbarKeepStateOnPaging),
        setReaderToolbarCenterClickToggleEnabled(formToolbarCenterClickToggleEnabled)
      ])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('保存翻页与分栏设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    setSaving(true)
    try {
      await Promise.all([setReaderSplitDefaultEnabled(false), setReaderWideRatioThreshold(1.0), setReaderToolbarKeepStateOnPaging(true), setReaderToolbarCenterClickToggleEnabled(true)])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('重置翻页与分栏设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form layout="vertical">
      <Form.Item label={t('readerSplitViewDefaultEnabled')}>
        <Switch checked={formSplitDefaultEnabled} onChange={setFormSplitDefaultEnabled} />
        <div className="mt-1 text-xs text-gray-500">{t('readerSplitViewDefaultEnabledHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerWideRatioThreshold')}>
        <InputNumber
          value={formWideRatioThreshold}
          min={1}
          max={5}
          step={0.05}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormWideRatioThreshold(Number(value ?? 1))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerWideRatioThresholdHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerToolbarKeepStateOnPaging')}>
        <Switch checked={formToolbarKeepStateOnPaging} onChange={setFormToolbarKeepStateOnPaging} />
        <div className="mt-1 text-xs text-gray-500">{t('readerToolbarKeepStateOnPagingHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerToolbarCenterClickToggleEnabled')}>
        <Switch checked={formToolbarCenterClickToggleEnabled} onChange={setFormToolbarCenterClickToggleEnabled} />
        <div className="mt-1 text-xs text-gray-500">{t('readerToolbarCenterClickToggleEnabledHelp')}</div>
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
  )
}

