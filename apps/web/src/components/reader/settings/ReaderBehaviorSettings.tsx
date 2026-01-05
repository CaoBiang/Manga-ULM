import { Button, Divider, Form, InputNumber, Space, Switch, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettingsStore } from '@/store/appSettings'

export default function ReaderBehaviorSettings() {
  const { t } = useTranslation()

  const readerPreloadAhead = useAppSettingsStore((state) => state.readerPreloadAhead)
  const readerSplitDefaultEnabled = useAppSettingsStore((state) => state.readerSplitDefaultEnabled)
  const readerWideRatioThreshold = useAppSettingsStore((state) => state.readerWideRatioThreshold)
  const readerToolbarAnimationMs = useAppSettingsStore((state) => state.readerToolbarAnimationMs)
  const readerToolbarBackgroundOpacity = useAppSettingsStore((state) => state.readerToolbarBackgroundOpacity)
  const readerToolbarKeepStateOnPaging = useAppSettingsStore((state) => state.readerToolbarKeepStateOnPaging)
  const readerToolbarCenterClickToggleEnabled = useAppSettingsStore((state) => state.readerToolbarCenterClickToggleEnabled)

  const setReaderPreloadAhead = useAppSettingsStore((state) => state.setReaderPreloadAhead)
  const setReaderSplitDefaultEnabled = useAppSettingsStore((state) => state.setReaderSplitDefaultEnabled)
  const setReaderWideRatioThreshold = useAppSettingsStore((state) => state.setReaderWideRatioThreshold)
  const setReaderToolbarAnimationMs = useAppSettingsStore((state) => state.setReaderToolbarAnimationMs)
  const setReaderToolbarBackgroundOpacity = useAppSettingsStore((state) => state.setReaderToolbarBackgroundOpacity)
  const setReaderToolbarKeepStateOnPaging = useAppSettingsStore((state) => state.setReaderToolbarKeepStateOnPaging)
  const setReaderToolbarCenterClickToggleEnabled = useAppSettingsStore((state) => state.setReaderToolbarCenterClickToggleEnabled)

  const [saving, setSaving] = useState(false)
  const [formPreloadAhead, setFormPreloadAhead] = useState(readerPreloadAhead)
  const [formSplitDefaultEnabled, setFormSplitDefaultEnabled] = useState(readerSplitDefaultEnabled)
  const [formWideRatioThreshold, setFormWideRatioThreshold] = useState(readerWideRatioThreshold)
  const [formToolbarAnimationMs, setFormToolbarAnimationMs] = useState(readerToolbarAnimationMs)
  const [formToolbarBackgroundOpacity, setFormToolbarBackgroundOpacity] = useState(readerToolbarBackgroundOpacity)
  const [formToolbarKeepStateOnPaging, setFormToolbarKeepStateOnPaging] = useState(readerToolbarKeepStateOnPaging)
  const [formToolbarCenterClickToggleEnabled, setFormToolbarCenterClickToggleEnabled] = useState(readerToolbarCenterClickToggleEnabled)

  useEffect(() => setFormPreloadAhead(readerPreloadAhead), [readerPreloadAhead])
  useEffect(() => setFormSplitDefaultEnabled(readerSplitDefaultEnabled), [readerSplitDefaultEnabled])
  useEffect(() => setFormWideRatioThreshold(readerWideRatioThreshold), [readerWideRatioThreshold])
  useEffect(() => setFormToolbarAnimationMs(readerToolbarAnimationMs), [readerToolbarAnimationMs])
  useEffect(() => setFormToolbarBackgroundOpacity(readerToolbarBackgroundOpacity), [readerToolbarBackgroundOpacity])
  useEffect(() => setFormToolbarKeepStateOnPaging(readerToolbarKeepStateOnPaging), [readerToolbarKeepStateOnPaging])
  useEffect(
    () => setFormToolbarCenterClickToggleEnabled(readerToolbarCenterClickToggleEnabled),
    [readerToolbarCenterClickToggleEnabled]
  )

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        setReaderPreloadAhead(formPreloadAhead),
        setReaderSplitDefaultEnabled(formSplitDefaultEnabled),
        setReaderWideRatioThreshold(formWideRatioThreshold),
        setReaderToolbarAnimationMs(formToolbarAnimationMs),
        setReaderToolbarBackgroundOpacity(formToolbarBackgroundOpacity),
        setReaderToolbarKeepStateOnPaging(formToolbarKeepStateOnPaging),
        setReaderToolbarCenterClickToggleEnabled(formToolbarCenterClickToggleEnabled)
      ])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('保存阅读行为设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    setSaving(true)
    try {
      await Promise.all([
        setReaderPreloadAhead(2),
        setReaderSplitDefaultEnabled(false),
        setReaderWideRatioThreshold(1.0),
        setReaderToolbarAnimationMs(240),
        setReaderToolbarBackgroundOpacity(0.28),
        setReaderToolbarKeepStateOnPaging(true),
        setReaderToolbarCenterClickToggleEnabled(true)
      ])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('重置阅读行为设置失败：', error)
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

      <Divider />

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

