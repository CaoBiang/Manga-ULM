import { Button, Form, InputNumber, Space, Switch, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettingsStore } from '@/store/appSettings'

export default function ReaderUiAppearanceSettings() {
  const { t } = useTranslation()

  const readerUiBlurEnabled = useAppSettingsStore((state) => state.readerUiBlurEnabled)
  const readerUiBlurRadiusPx = useAppSettingsStore((state) => state.readerUiBlurRadiusPx)
  const readerUiControlBgOpacity = useAppSettingsStore((state) => state.readerUiControlBgOpacity)
  const readerUiControlBorderOpacity = useAppSettingsStore((state) => state.readerUiControlBorderOpacity)

  const setReaderUiBlurEnabled = useAppSettingsStore((state) => state.setReaderUiBlurEnabled)
  const setReaderUiBlurRadiusPx = useAppSettingsStore((state) => state.setReaderUiBlurRadiusPx)
  const setReaderUiControlBgOpacity = useAppSettingsStore((state) => state.setReaderUiControlBgOpacity)
  const setReaderUiControlBorderOpacity = useAppSettingsStore((state) => state.setReaderUiControlBorderOpacity)

  const [saving, setSaving] = useState(false)
  const [formBlurEnabled, setFormBlurEnabled] = useState(readerUiBlurEnabled)
  const [formBlurRadiusPx, setFormBlurRadiusPx] = useState(readerUiBlurRadiusPx)
  const [formControlBgOpacity, setFormControlBgOpacity] = useState(readerUiControlBgOpacity)
  const [formControlBorderOpacity, setFormControlBorderOpacity] = useState(readerUiControlBorderOpacity)

  useEffect(() => setFormBlurEnabled(readerUiBlurEnabled), [readerUiBlurEnabled])
  useEffect(() => setFormBlurRadiusPx(readerUiBlurRadiusPx), [readerUiBlurRadiusPx])
  useEffect(() => setFormControlBgOpacity(readerUiControlBgOpacity), [readerUiControlBgOpacity])
  useEffect(() => setFormControlBorderOpacity(readerUiControlBorderOpacity), [readerUiControlBorderOpacity])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        setReaderUiBlurEnabled(formBlurEnabled),
        setReaderUiBlurRadiusPx(formBlurRadiusPx),
        setReaderUiControlBgOpacity(formControlBgOpacity),
        setReaderUiControlBorderOpacity(formControlBorderOpacity)
      ])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('保存阅读器外观设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    setSaving(true)
    try {
      await Promise.all([
        setReaderUiBlurEnabled(true),
        setReaderUiBlurRadiusPx(12),
        setReaderUiControlBgOpacity(0.46),
        setReaderUiControlBorderOpacity(0.16)
      ])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('重置阅读器外观设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form layout="vertical">
      <Form.Item label={t('readerUiBlurEnabled')}>
        <Switch checked={formBlurEnabled} onChange={setFormBlurEnabled} />
        <div className="mt-1 text-xs text-gray-500">{t('readerUiBlurEnabledHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerUiBlurRadiusPx')}>
        <InputNumber
          value={formBlurRadiusPx}
          min={0}
          max={30}
          step={1}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormBlurRadiusPx(Number(value ?? 12))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerUiBlurRadiusPxHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerUiControlBgOpacity')}>
        <InputNumber
          value={formControlBgOpacity}
          min={0.12}
          max={0.7}
          step={0.02}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormControlBgOpacity(Number(value ?? 0.46))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerUiControlBgOpacityHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerUiControlBorderOpacity')}>
        <InputNumber
          value={formControlBorderOpacity}
          min={0.06}
          max={0.4}
          step={0.02}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormControlBorderOpacity(Number(value ?? 0.16))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerUiControlBorderOpacityHelp')}</div>
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

