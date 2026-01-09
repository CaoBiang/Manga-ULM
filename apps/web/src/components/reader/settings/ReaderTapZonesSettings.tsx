import { Button, Form, Select, Space, Tag, Typography, message } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReaderTapZonesPreview from '@/components/reader/tapZones/ReaderTapZonesPreview'
import { buildTapZoneBoundaries, removeTapZone, resolveCenterTapZoneIndex, splitTapZone } from '@/components/reader/tapZones/tapZonesUtils'
import { DEFAULT_READER_TAP_ZONES, type ReaderTapZoneAction, type ReaderTapZonesConfig } from '@/store/appSettings'
import { useAppSettingsStore } from '@/store/appSettings'

const cloneTapZones = (value: ReaderTapZonesConfig | null | undefined): ReaderTapZonesConfig => {
  const xSplits = Array.isArray(value?.xSplits) ? value.xSplits : DEFAULT_READER_TAP_ZONES.xSplits
  const ySplits = Array.isArray(value?.ySplits) ? value.ySplits : DEFAULT_READER_TAP_ZONES.ySplits
  const actions = Array.isArray(value?.actions) ? value.actions : DEFAULT_READER_TAP_ZONES.actions

  const colCount = xSplits.length + 1
  const rowCount = ySplits.length + 1
  const zoneCount = Math.max(1, colCount * rowCount)
  const nextActions: ReaderTapZoneAction[] = []
  for (let index = 0; index < zoneCount; index += 1) {
    nextActions.push(((actions as any)?.[index] ?? 'none') as ReaderTapZoneAction)
  }

  return {
    version: 3,
    xSplits: xSplits.map((item) => Number(item) || 0),
    ySplits: ySplits.map((item) => Number(item) || 0),
    actions: nextActions.map((item) => (String(item || '').trim().toLowerCase() as ReaderTapZoneAction) || 'none')
  }
}

export default function ReaderTapZonesSettings() {
  const { t } = useTranslation()
  const readerTapZones = useAppSettingsStore((state) => state.readerTapZones)
  const setReaderTapZones = useAppSettingsStore((state) => state.setReaderTapZones)

  const [saving, setSaving] = useState(false)
  const [draft, setDraft] = useState<ReaderTapZonesConfig>(() => cloneTapZones(readerTapZones))
  const [selectedZone, setSelectedZone] = useState<number>(() => {
    const initial = cloneTapZones(readerTapZones)
    return resolveCenterTapZoneIndex(initial.xSplits, initial.ySplits)
  })

  useEffect(() => {
    if (saving) return
    const next = cloneTapZones(readerTapZones)
    setDraft(next)
    setSelectedZone((prev) => {
      const colCount = next.xSplits.length + 1
      const rowCount = next.ySplits.length + 1
      const zoneCount = Math.max(1, colCount * rowCount)
      if (Number.isFinite(prev) && prev >= 0 && prev < zoneCount) return prev
      return resolveCenterTapZoneIndex(next.xSplits, next.ySplits)
    })
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

  const xSplits = Array.isArray(draft?.xSplits) ? draft.xSplits : DEFAULT_READER_TAP_ZONES.xSplits
  const ySplits = Array.isArray(draft?.ySplits) ? draft.ySplits : DEFAULT_READER_TAP_ZONES.ySplits
  const actions = Array.isArray(draft?.actions) ? draft.actions : DEFAULT_READER_TAP_ZONES.actions
  const colCount = Math.max(1, xSplits.length + 1)
  const rowCount = Math.max(1, ySplits.length + 1)
  const zoneCount = Math.max(1, colCount * rowCount)
  const resolvedSelectedZone = Number.isFinite(selectedZone) && selectedZone >= 0 && selectedZone < zoneCount ? selectedZone : resolveCenterTapZoneIndex(xSplits, ySplits)

  useEffect(() => {
    if (resolvedSelectedZone !== selectedZone) {
      setSelectedZone(resolvedSelectedZone)
    }
  }, [resolvedSelectedZone, selectedZone])

  const currentConfig = useMemo<ReaderTapZonesConfig>(
    () => ({ version: 3, xSplits: xSplits.slice(), ySplits: ySplits.slice(), actions: actions.slice() }),
    [actions, xSplits, ySplits]
  )

  const zoneLabel = (zoneIndex: number) => t('readerTapZoneIndex', { index: zoneIndex + 1 })

  const selectedZoneAction = (actions as any)?.[resolvedSelectedZone] ?? 'none'

  const splitXResult = useMemo(() => splitTapZone(currentConfig, resolvedSelectedZone, 'x'), [currentConfig, resolvedSelectedZone])
  const splitYResult = useMemo(() => splitTapZone(currentConfig, resolvedSelectedZone, 'y'), [currentConfig, resolvedSelectedZone])
  const mergeXResult = useMemo(() => removeTapZone(currentConfig, resolvedSelectedZone, 'x'), [currentConfig, resolvedSelectedZone])
  const mergeYResult = useMemo(() => removeTapZone(currentConfig, resolvedSelectedZone, 'y'), [currentConfig, resolvedSelectedZone])

  const applyZoneResult = (result: { config: ReaderTapZonesConfig; nextSelectedZone: number } | null) => {
    if (!result) return
    setDraft(result.config)
    setSelectedZone(result.nextSelectedZone)
  }

  const sizes = useMemo(() => {
    const xBoundaries = buildTapZoneBoundaries(xSplits)
    const yBoundaries = buildTapZoneBoundaries(ySplits)
    const list: { width: number; height: number }[] = []
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < colCount; col += 1) {
        const width = Math.round(Math.max(0, Number(xBoundaries[col + 1] ?? 1) - Number(xBoundaries[col] ?? 0)) * 100)
        const height = Math.round(Math.max(0, Number(yBoundaries[row + 1] ?? 1) - Number(yBoundaries[row] ?? 0)) * 100)
        list.push({ width, height })
      }
    }
    return list
  }, [colCount, rowCount, xSplits, ySplits])

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
    const next: ReaderTapZonesConfig = {
      version: 3,
      xSplits: DEFAULT_READER_TAP_ZONES.xSplits.slice(),
      ySplits: DEFAULT_READER_TAP_ZONES.ySplits.slice(),
      actions: DEFAULT_READER_TAP_ZONES.actions.slice()
    }
    setSaving(true)
    try {
      setDraft(next)
      setSelectedZone(resolveCenterTapZoneIndex(next.xSplits, next.ySplits))
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
        <ReaderTapZonesPreview value={draft} onChange={setDraft} selectedZone={resolvedSelectedZone} onSelectedZoneChange={setSelectedZone} overlay={false} showLabels />
      </div>

      <Form layout="vertical">
        <Form.Item label={zoneLabel(resolvedSelectedZone)}>
          <Select
            value={selectedZoneAction}
            style={{ maxWidth: 360 }}
            onChange={(value) => {
              const nextActions = actions.slice()
              nextActions[resolvedSelectedZone] = value as ReaderTapZoneAction
              setDraft({ version: 3, xSplits: xSplits.slice(), ySplits: ySplits.slice(), actions: nextActions })
            }}
            options={actionOptions}
          />
        </Form.Item>

        <Form.Item label={t('readerTapZonesGridSummary', { cols: colCount, rows: rowCount, count: zoneCount })}>
          <Space wrap>
            <Button disabled={saving || !mergeXResult} onClick={() => applyZoneResult(mergeXResult)}>
              {t('readerTapZonesMergeColumns')}
            </Button>
            <Button disabled={saving || !splitXResult} onClick={() => applyZoneResult(splitXResult)}>
              {t('readerTapZonesSplitColumns')}
            </Button>
            <Button disabled={saving || !mergeYResult} onClick={() => applyZoneResult(mergeYResult)}>
              {t('readerTapZonesMergeRows')}
            </Button>
            <Button disabled={saving || !splitYResult} onClick={() => applyZoneResult(splitYResult)}>
              {t('readerTapZonesSplitRows')}
            </Button>
          </Space>
        </Form.Item>

        <Form.Item label={t('readerTapZonesCurrentSizes')}>
          <Space wrap>
            {sizes.map((size, index) => (
              <Tag key={index} color={index === resolvedSelectedZone ? 'blue' : undefined}>
                {zoneLabel(index)}: {size.width}% × {size.height}%
              </Tag>
            ))}
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
