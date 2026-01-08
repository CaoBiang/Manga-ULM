import { Button, Form, InputNumber, Space, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettingsStore } from '@/store/appSettings'

export default function ReaderToolbarSettings() {
  const { t } = useTranslation()

  const readerToolbarAnimationMs = useAppSettingsStore((state) => state.readerToolbarAnimationMs)
  const readerToolbarBackgroundOpacity = useAppSettingsStore((state) => state.readerToolbarBackgroundOpacity)

  const setReaderToolbarAnimationMs = useAppSettingsStore((state) => state.setReaderToolbarAnimationMs)
  const setReaderToolbarBackgroundOpacity = useAppSettingsStore((state) => state.setReaderToolbarBackgroundOpacity)

  const [saving, setSaving] = useState(false)
  const [formToolbarAnimationMs, setFormToolbarAnimationMs] = useState(readerToolbarAnimationMs)
  const [formToolbarBackgroundOpacity, setFormToolbarBackgroundOpacity] = useState(readerToolbarBackgroundOpacity)

  useEffect(() => setFormToolbarAnimationMs(readerToolbarAnimationMs), [readerToolbarAnimationMs])
  useEffect(() => setFormToolbarBackgroundOpacity(readerToolbarBackgroundOpacity), [readerToolbarBackgroundOpacity])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([setReaderToolbarAnimationMs(formToolbarAnimationMs), setReaderToolbarBackgroundOpacity(formToolbarBackgroundOpacity)])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('保存工具条设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    setSaving(true)
    try {
      await Promise.all([setReaderToolbarAnimationMs(240), setReaderToolbarBackgroundOpacity(0.28)])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('重置工具条设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form layout="vertical">
      <Form.Item label={t('readerToolbarAnimationMs')}>
        <InputNumber
          value={formToolbarAnimationMs}
          min={120}
          max={600}
          step={10}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormToolbarAnimationMs(Number(value ?? 240))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerToolbarAnimationMsHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerToolbarBackgroundOpacity')}>
        <InputNumber
          value={formToolbarBackgroundOpacity}
          min={0.08}
          max={0.8}
          step={0.02}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormToolbarBackgroundOpacity(Number(value ?? 0.28))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerToolbarBackgroundOpacityHelp')}</div>
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

