import { Button, Divider, Form, Input, InputNumber, Select, Space, Switch, message } from 'antd'
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
  const readerImageMaxSidePx = useAppSettingsStore((state) => state.readerImageMaxSidePx)
  const readerImageMaxSidePresets = useAppSettingsStore((state) => state.readerImageMaxSidePresets)
  const readerImageRenderFormat = useAppSettingsStore((state) => state.readerImageRenderFormat)
  const readerImageRenderQuality = useAppSettingsStore((state) => state.readerImageRenderQuality)
  const readerImageRenderResample = useAppSettingsStore((state) => state.readerImageRenderResample)
  const readerImagePreloadConcurrency = useAppSettingsStore((state) => state.readerImagePreloadConcurrency)

  const setReaderPreloadAhead = useAppSettingsStore((state) => state.setReaderPreloadAhead)
  const setReaderSplitDefaultEnabled = useAppSettingsStore((state) => state.setReaderSplitDefaultEnabled)
  const setReaderWideRatioThreshold = useAppSettingsStore((state) => state.setReaderWideRatioThreshold)
  const setReaderToolbarAnimationMs = useAppSettingsStore((state) => state.setReaderToolbarAnimationMs)
  const setReaderToolbarBackgroundOpacity = useAppSettingsStore((state) => state.setReaderToolbarBackgroundOpacity)
  const setReaderToolbarKeepStateOnPaging = useAppSettingsStore((state) => state.setReaderToolbarKeepStateOnPaging)
  const setReaderToolbarCenterClickToggleEnabled = useAppSettingsStore((state) => state.setReaderToolbarCenterClickToggleEnabled)
  const setReaderImageMaxSidePx = useAppSettingsStore((state) => state.setReaderImageMaxSidePx)
  const setReaderImageMaxSidePresets = useAppSettingsStore((state) => state.setReaderImageMaxSidePresets)
  const setReaderImageRenderFormat = useAppSettingsStore((state) => state.setReaderImageRenderFormat)
  const setReaderImageRenderQuality = useAppSettingsStore((state) => state.setReaderImageRenderQuality)
  const setReaderImageRenderResample = useAppSettingsStore((state) => state.setReaderImageRenderResample)
  const setReaderImagePreloadConcurrency = useAppSettingsStore((state) => state.setReaderImagePreloadConcurrency)

  const [saving, setSaving] = useState(false)
  const [formPreloadAhead, setFormPreloadAhead] = useState(readerPreloadAhead)
  const [formSplitDefaultEnabled, setFormSplitDefaultEnabled] = useState(readerSplitDefaultEnabled)
  const [formWideRatioThreshold, setFormWideRatioThreshold] = useState(readerWideRatioThreshold)
  const [formImageMaxSidePx, setFormImageMaxSidePx] = useState(readerImageMaxSidePx)
  const [formImageMaxSidePresets, setFormImageMaxSidePresets] = useState(readerImageMaxSidePresets.join(','))
  const [formImageRenderFormat, setFormImageRenderFormat] = useState(readerImageRenderFormat)
  const [formImageRenderQuality, setFormImageRenderQuality] = useState(readerImageRenderQuality)
  const [formImageRenderResample, setFormImageRenderResample] = useState(readerImageRenderResample)
  const [formImagePreloadConcurrency, setFormImagePreloadConcurrency] = useState(readerImagePreloadConcurrency)
  const [formToolbarAnimationMs, setFormToolbarAnimationMs] = useState(readerToolbarAnimationMs)
  const [formToolbarBackgroundOpacity, setFormToolbarBackgroundOpacity] = useState(readerToolbarBackgroundOpacity)
  const [formToolbarKeepStateOnPaging, setFormToolbarKeepStateOnPaging] = useState(readerToolbarKeepStateOnPaging)
  const [formToolbarCenterClickToggleEnabled, setFormToolbarCenterClickToggleEnabled] = useState(readerToolbarCenterClickToggleEnabled)

  useEffect(() => setFormPreloadAhead(readerPreloadAhead), [readerPreloadAhead])
  useEffect(() => setFormSplitDefaultEnabled(readerSplitDefaultEnabled), [readerSplitDefaultEnabled])
  useEffect(() => setFormWideRatioThreshold(readerWideRatioThreshold), [readerWideRatioThreshold])
  useEffect(() => setFormImageMaxSidePx(readerImageMaxSidePx), [readerImageMaxSidePx])
  useEffect(() => setFormImageMaxSidePresets(readerImageMaxSidePresets.join(',')), [readerImageMaxSidePresets])
  useEffect(() => setFormImageRenderFormat(readerImageRenderFormat), [readerImageRenderFormat])
  useEffect(() => setFormImageRenderQuality(readerImageRenderQuality), [readerImageRenderQuality])
  useEffect(() => setFormImageRenderResample(readerImageRenderResample), [readerImageRenderResample])
  useEffect(() => setFormImagePreloadConcurrency(readerImagePreloadConcurrency), [readerImagePreloadConcurrency])
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
        setReaderImageMaxSidePx(formImageMaxSidePx),
        setReaderImageMaxSidePresets(formImageMaxSidePresets),
        setReaderImageRenderFormat(formImageRenderFormat),
        setReaderImageRenderQuality(formImageRenderQuality),
        setReaderImageRenderResample(formImageRenderResample),
        setReaderImagePreloadConcurrency(formImagePreloadConcurrency),
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
        setReaderImageMaxSidePx(0),
        setReaderImageMaxSidePresets([0, 1280, 1600, 2000, 2400]),
        setReaderImageRenderFormat('webp'),
        setReaderImageRenderQuality(82),
        setReaderImageRenderResample('bilinear'),
        setReaderImagePreloadConcurrency(2),
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

      <Form.Item label={t('readerImageMaxSidePx')}>
        <InputNumber
          value={formImageMaxSidePx}
          min={0}
          max={20000}
          step={100}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormImageMaxSidePx(Number(value ?? 0))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerImageMaxSidePxHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerImageMaxSidePresets')}>
        <Input value={formImageMaxSidePresets} onChange={(event) => setFormImageMaxSidePresets(event.target.value)} placeholder="0,1280,1600,2000,2400" />
        <div className="mt-1 text-xs text-gray-500">{t('readerImageMaxSidePresetsHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerImageRenderFormat')}>
        <Select
          value={formImageRenderFormat}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormImageRenderFormat(value)}
          options={[
            { value: 'webp', label: t('readerImageRenderFormatWebp') },
            { value: 'jpeg', label: t('readerImageRenderFormatJpeg') },
            { value: 'png', label: t('readerImageRenderFormatPng') },
            { value: 'auto', label: t('readerImageRenderFormatAuto') }
          ]}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerImageRenderFormatHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerImageRenderQuality')}>
        <InputNumber
          value={formImageRenderQuality}
          min={1}
          max={100}
          step={1}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormImageRenderQuality(Number(value ?? 82))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerImageRenderQualityHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerImageRenderResample')}>
        <Select
          value={formImageRenderResample}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormImageRenderResample(value)}
          options={[
            { value: 'lanczos', label: t('readerImageRenderResampleLanczos') },
            { value: 'bicubic', label: t('readerImageRenderResampleBicubic') },
            { value: 'bilinear', label: t('readerImageRenderResampleBilinear') },
            { value: 'nearest', label: t('readerImageRenderResampleNearest') }
          ]}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerImageRenderResampleHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerImagePreloadConcurrency')}>
        <InputNumber
          value={formImagePreloadConcurrency}
          min={1}
          max={6}
          step={1}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormImagePreloadConcurrency(Number(value ?? 2))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerImagePreloadConcurrencyHelp')}</div>
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
