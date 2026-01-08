import { Button, Form, Input, InputNumber, Select, Space, message } from 'antd'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAppSettingsStore } from '@/store/appSettings'

export default function ReaderImageRenderSettings() {
  const { t } = useTranslation()

  const readerImageMaxSidePx = useAppSettingsStore((state) => state.readerImageMaxSidePx)
  const readerImageMaxSidePresets = useAppSettingsStore((state) => state.readerImageMaxSidePresets)
  const readerImageRenderFormat = useAppSettingsStore((state) => state.readerImageRenderFormat)
  const readerImageRenderQuality = useAppSettingsStore((state) => state.readerImageRenderQuality)
  const readerImageRenderResample = useAppSettingsStore((state) => state.readerImageRenderResample)

  const setReaderImageMaxSidePx = useAppSettingsStore((state) => state.setReaderImageMaxSidePx)
  const setReaderImageMaxSidePresets = useAppSettingsStore((state) => state.setReaderImageMaxSidePresets)
  const setReaderImageRenderFormat = useAppSettingsStore((state) => state.setReaderImageRenderFormat)
  const setReaderImageRenderQuality = useAppSettingsStore((state) => state.setReaderImageRenderQuality)
  const setReaderImageRenderResample = useAppSettingsStore((state) => state.setReaderImageRenderResample)

  const [saving, setSaving] = useState(false)
  const [formMaxSidePx, setFormMaxSidePx] = useState(readerImageMaxSidePx)
  const [formPresets, setFormPresets] = useState(readerImageMaxSidePresets.join(','))
  const [formFormat, setFormFormat] = useState(readerImageRenderFormat)
  const [formQuality, setFormQuality] = useState(readerImageRenderQuality)
  const [formResample, setFormResample] = useState(readerImageRenderResample)

  useEffect(() => setFormMaxSidePx(readerImageMaxSidePx), [readerImageMaxSidePx])
  useEffect(() => setFormPresets(readerImageMaxSidePresets.join(',')), [readerImageMaxSidePresets])
  useEffect(() => setFormFormat(readerImageRenderFormat), [readerImageRenderFormat])
  useEffect(() => setFormQuality(readerImageRenderQuality), [readerImageRenderQuality])
  useEffect(() => setFormResample(readerImageRenderResample), [readerImageRenderResample])

  const save = async () => {
    setSaving(true)
    try {
      await Promise.all([
        setReaderImageMaxSidePx(formMaxSidePx),
        setReaderImageMaxSidePresets(formPresets),
        setReaderImageRenderFormat(formFormat),
        setReaderImageRenderQuality(formQuality),
        setReaderImageRenderResample(formResample)
      ])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('保存页面渲染设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    setSaving(true)
    try {
      await Promise.all([
        setReaderImageMaxSidePx(0),
        setReaderImageMaxSidePresets([0, 1280, 1600, 2000, 2400]),
        setReaderImageRenderFormat('webp'),
        setReaderImageRenderQuality(82),
        setReaderImageRenderResample('bilinear')
      ])
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('重置页面渲染设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form layout="vertical">
      <Form.Item label={t('readerImageMaxSidePx')}>
        <InputNumber
          value={formMaxSidePx}
          min={0}
          max={20000}
          step={100}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormMaxSidePx(Number(value ?? 0))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerImageMaxSidePxHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerImageMaxSidePresets')}>
        <Input value={formPresets} onChange={(event) => setFormPresets(event.target.value)} placeholder="0,1280,1600,2000,2400" />
        <div className="mt-1 text-xs text-gray-500">{t('readerImageMaxSidePresetsHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerImageRenderFormat')}>
        <Select
          value={formFormat}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormFormat(value)}
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
          value={formQuality}
          min={1}
          max={100}
          step={1}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormQuality(Number(value ?? 82))}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerImageRenderQualityHelp')}</div>
      </Form.Item>

      <Form.Item label={t('readerImageRenderResample')}>
        <Select
          value={formResample}
          style={{ maxWidth: 240 }}
          onChange={(value) => setFormResample(value)}
          options={[
            { value: 'lanczos', label: t('readerImageRenderResampleLanczos') },
            { value: 'bicubic', label: t('readerImageRenderResampleBicubic') },
            { value: 'bilinear', label: t('readerImageRenderResampleBilinear') },
            { value: 'nearest', label: t('readerImageRenderResampleNearest') }
          ]}
        />
        <div className="mt-1 text-xs text-gray-500">{t('readerImageRenderResampleHelp')}</div>
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

