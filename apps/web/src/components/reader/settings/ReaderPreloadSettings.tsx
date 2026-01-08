import { Button, Form, InputNumber, Space, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettingsStore } from '@/store/appSettings'

export default function ReaderPreloadSettings() {
  const { t } = useTranslation()

  const readerPreloadAhead = useAppSettingsStore((state) => state.readerPreloadAhead)
  const readerImagePreloadConcurrency = useAppSettingsStore((state) => state.readerImagePreloadConcurrency)

  const setReaderPreloadAhead = useAppSettingsStore((state) => state.setReaderPreloadAhead)
  const setReaderImagePreloadConcurrency = useAppSettingsStore((state) => state.setReaderImagePreloadConcurrency)

  const [saving, setSaving] = useState(false)
  const [formPreloadAhead, setFormPreloadAhead] = useState(readerPreloadAhead)
  const [formPreloadConcurrency, setFormPreloadConcurrency] = useState(readerImagePreloadConcurrency)

  useEffect(() => setFormPreloadAhead(readerPreloadAhead), [readerPreloadAhead])
  useEffect(() => setFormPreloadConcurrency(readerImagePreloadConcurrency), [readerImagePreloadConcurrency])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([setReaderPreloadAhead(formPreloadAhead), setReaderImagePreloadConcurrency(formPreloadConcurrency)])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('保存预加载设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    setSaving(true)
    try {
      await Promise.all([setReaderPreloadAhead(2), setReaderImagePreloadConcurrency(2)])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('重置预加载设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form layout="vertical">
      <Form.Item label={t('readerPreloadAhead')}>
        <InputNumber
          value={formPreloadAhead}
          min={0}
          max={20}
          step={1}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormPreloadAhead(Number(value ?? 0))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerPreloadAheadHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerImagePreloadConcurrency')}>
        <InputNumber
          value={formPreloadConcurrency}
          min={1}
          max={6}
          step={1}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormPreloadConcurrency(Number(value ?? 2))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerImagePreloadConcurrencyHelp')}</div>
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

