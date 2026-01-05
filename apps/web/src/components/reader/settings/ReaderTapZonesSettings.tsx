import { Button, Form, Select, Slider, Space, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReaderTapZonesPreview from '@/components/reader/tapZones/ReaderTapZonesPreview'
import { DEFAULT_READER_TAP_ZONES, type ReaderTapZoneAction, type ReaderTapZoneKey, type ReaderTapZonesConfig } from '@/store/appSettings'
import { useAppSettingsStore } from '@/store/appSettings'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const cloneTapZones = (value: ReaderTapZonesConfig | null | undefined): ReaderTapZonesConfig => {
  const boundaries = value?.boundaries ?? DEFAULT_READER_TAP_ZONES.boundaries
  const actions = value?.actions ?? DEFAULT_READER_TAP_ZONES.actions
  return {
    version: 1,
    boundaries: {
      left: Number((boundaries as any).left ?? DEFAULT_READER_TAP_ZONES.boundaries.left),
      right: Number((boundaries as any).right ?? DEFAULT_READER_TAP_ZONES.boundaries.right)
    },
    actions: {
      left: ((actions as any).left ?? DEFAULT_READER_TAP_ZONES.actions.left) as ReaderTapZoneAction,
      middle: ((actions as any).middle ?? DEFAULT_READER_TAP_ZONES.actions.middle) as ReaderTapZoneAction,
      right: ((actions as any).right ?? DEFAULT_READER_TAP_ZONES.actions.right) as ReaderTapZoneAction
    }
  }
}

export default function ReaderTapZonesSettings() {
  const { t } = useTranslation()
  const readerTapZones = useAppSettingsStore((state) => state.readerTapZones)
  const setReaderTapZones = useAppSettingsStore((state) => state.setReaderTapZones)

  const [saving, setSaving] = useState(false)
  const [selectedZone, setSelectedZone] = useState<ReaderTapZoneKey>('middle')
  const [draft, setDraft] = useState<ReaderTapZonesConfig>(() => cloneTapZones(readerTapZones))

  useEffect(() => {
    if (saving) return
    setDraft(cloneTapZones(readerTapZones))
  }, [readerTapZones, saving])

  const actionOptions = useMemo(
    () => [
      { value: 'prev_page', label: t('readerTapActionPrevPage') },
      { value: 'next_page', label: t('readerTapActionNextPage') },
      { value: 'toggle_toolbar', label: t('readerTapActionToggleToolbar') },
      { value: 'expand_toolbar', label: t('readerTapActionExpandToolbar') },
      { value: 'collapse_toolbar', label: t('readerTapActionCollapseToolbar') },
      { value: 'none', label: t('readerTapActionNone') }
    ],
    [t]
  )

  const zoneLabel = (zoneKey: ReaderTapZoneKey) => {
    if (zoneKey === 'left') return t('readerTapZoneLeft')
    if (zoneKey === 'right') return t('readerTapZoneRight')
    return t('readerTapZoneMiddle')
  }

  const leftRatio = Number(draft?.boundaries?.left ?? DEFAULT_READER_TAP_ZONES.boundaries.left)
  const rightRatio = Number(draft?.boundaries?.right ?? DEFAULT_READER_TAP_ZONES.boundaries.right)

  const widths = useMemo(() => {
    const left = Math.round(leftRatio * 100)
    const middle = Math.round((rightRatio - leftRatio) * 100)
    const right = Math.round((1 - rightRatio) * 100)
    return { left, middle, right }
  }, [leftRatio, rightRatio])

  const leftWidthText = `${widths.left}%`
  const middleWidthText = `${widths.middle}%`
  const rightWidthText = `${widths.right}%`

  const setBoundaries = (left: number, right: number) => {
    const minZoneWidth = 0.08
    const normalizedLeft = clamp(left, minZoneWidth, 1 - minZoneWidth)
    const normalizedRight = clamp(right, minZoneWidth, 1 - minZoneWidth)
    if (normalizedLeft >= normalizedRight) return
    if (normalizedLeft < minZoneWidth || 1 - normalizedRight < minZoneWidth || normalizedRight - normalizedLeft < minZoneWidth) return

    setDraft((prev) => ({
      ...(prev || DEFAULT_READER_TAP_ZONES),
      version: 1,
      boundaries: { left: normalizedLeft, right: normalizedRight },
      actions: { ...(prev?.actions || DEFAULT_READER_TAP_ZONES.actions) }
    }))
  }

  const selectedZoneAction = (draft?.actions as any)?.[selectedZone] ?? 'none'

  const save = async () => {
    setSaving(true)
    try {
      await setReaderTapZones(draft)
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('保存阅读器点击区域设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  const resetToDefault = async () => {
    const next = cloneTapZones(DEFAULT_READER_TAP_ZONES)
    setSaving(true)
    try {
      setDraft(next)
      await setReaderTapZones(next)
      message.success(t('settingsSavedSuccessfully'))
    } catch (error) {
      console.error('重置阅读器点击区域设置失败：', error)
      message.error(t('failedToSaveSettings'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Space direction="vertical" size="large" className="w-full">
      <Typography.Paragraph type="secondary" className="!mb-0">
        {t('readerTapZonesSettingsHelp')}
      </Typography.Paragraph>

      <div className="reader-tap-zones-settings__preview">
        <ReaderTapZonesPreview value={draft} onChange={setDraft} selectedZone={selectedZone} onSelectedZoneChange={setSelectedZone} overlay={false} showLabels />
      </div>

      <Form layout="vertical">
        <Form.Item label={zoneLabel(selectedZone)}>
          <Select
            value={selectedZoneAction}
            style={{ maxWidth: 360 }}
            onChange={(value) => {
              setDraft((prev) => ({
                ...(prev || DEFAULT_READER_TAP_ZONES),
                actions: { ...(prev?.actions || DEFAULT_READER_TAP_ZONES.actions), [selectedZone]: value as ReaderTapZoneAction }
              }))
            }}
            options={actionOptions}
          />
        </Form.Item>

        <Form.Item label={t('readerTapZonesLeftWidth')}>
          <Slider
            value={widths.left}
            min={8}
            max={84}
            step={1}
            tooltip={{ open: false }}
            onChange={(percent) => setBoundaries(clamp(Number(percent) / 100, 0.08, 0.92), rightRatio)}
          />
          <div className="mt-1 text-xs text-gray-500">{leftWidthText}</div>
        </Form.Item>

        <Form.Item label={t('readerTapZonesRightWidth')}>
          <Slider
            value={widths.right}
            min={8}
            max={84}
            step={1}
            tooltip={{ open: false }}
            onChange={(percent) => setBoundaries(leftRatio, 1 - clamp(Number(percent) / 100, 0.08, 0.92))}
          />
          <div className="mt-1 text-xs text-gray-500">{rightWidthText}</div>
        </Form.Item>

        <Form.Item label={t('readerTapZonesCurrentSizes')}>
          <Space wrap>
            <Tag>
              {t('readerTapZoneLeft')}: {leftWidthText}
            </Tag>
            <Tag>
              {t('readerTapZoneMiddle')}: {middleWidthText}
            </Tag>
            <Tag>
              {t('readerTapZoneRight')}: {rightWidthText}
            </Tag>
          </Space>
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
