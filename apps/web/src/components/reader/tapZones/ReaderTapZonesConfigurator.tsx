import { CloseOutlined } from '@ant-design/icons'
import { Select } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReaderTapZonesPreview from '@/components/reader/tapZones/ReaderTapZonesPreview'
import { buildTapZoneBoundaries, removeTapZone, resolveCenterTapZoneIndex, resolveTapZoneRowCol, splitTapZone } from '@/components/reader/tapZones/tapZonesUtils'
import ReaderButton from '@/components/reader/ui/ReaderButton'
import { DEFAULT_READER_TAP_ZONES, type ReaderTapZoneAction, type ReaderTapZonesConfig } from '@/store/appSettings'

export type ReaderTapZonesConfiguratorProps = {
  open: boolean
  value: ReaderTapZonesConfig
  onChange: (value: ReaderTapZonesConfig) => void
  saving?: boolean
  onClose: () => void
  onSave: (value: ReaderTapZonesConfig) => void
}

export default function ReaderTapZonesConfigurator({
  open,
  value,
  onChange,
  saving = false,
  onClose,
  onSave
}: ReaderTapZonesConfiguratorProps) {
  const { t } = useTranslation()
  const [selectedZone, setSelectedZone] = useState<number>(0)

  useEffect(() => {
    if (!open) return
    const xSplits = Array.isArray(value?.xSplits) ? value.xSplits : DEFAULT_READER_TAP_ZONES.xSplits
    const ySplits = Array.isArray(value?.ySplits) ? value.ySplits : DEFAULT_READER_TAP_ZONES.ySplits
    setSelectedZone(resolveCenterTapZoneIndex(xSplits, ySplits))
  }, [open])

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

  const xSplits = Array.isArray(value?.xSplits) ? value.xSplits : DEFAULT_READER_TAP_ZONES.xSplits
  const ySplits = Array.isArray(value?.ySplits) ? value.ySplits : DEFAULT_READER_TAP_ZONES.ySplits
  const actions = Array.isArray(value?.actions) ? value.actions : DEFAULT_READER_TAP_ZONES.actions

  const colCount = Math.max(1, xSplits.length + 1)
  const rowCount = Math.max(1, ySplits.length + 1)
  const zoneCount = Math.max(1, colCount * rowCount)
  const resolvedSelectedZone = selectedZone >= 0 && selectedZone < zoneCount ? selectedZone : 0

  const currentConfig = useMemo<ReaderTapZonesConfig>(
    () => ({ version: 3, xSplits: xSplits.slice(), ySplits: ySplits.slice(), actions: actions.slice() }),
    [actions, xSplits, ySplits]
  )

  const splitXResult = useMemo(() => splitTapZone(currentConfig, resolvedSelectedZone, 'x'), [currentConfig, resolvedSelectedZone])
  const splitYResult = useMemo(() => splitTapZone(currentConfig, resolvedSelectedZone, 'y'), [currentConfig, resolvedSelectedZone])
  const mergeXResult = useMemo(() => removeTapZone(currentConfig, resolvedSelectedZone, 'x'), [currentConfig, resolvedSelectedZone])
  const mergeYResult = useMemo(() => removeTapZone(currentConfig, resolvedSelectedZone, 'y'), [currentConfig, resolvedSelectedZone])

  const zoneLabel = (zoneIndex: number) => t('readerTapZoneIndex', { index: zoneIndex + 1 })

  const selectedZoneAction = (actions as any)?.[resolvedSelectedZone] ?? 'none'

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

  const selectedRowCol = useMemo(() => resolveTapZoneRowCol(resolvedSelectedZone, colCount), [colCount, resolvedSelectedZone])

  const applyZoneResult = (result: { config: ReaderTapZonesConfig; nextSelectedZone: number } | null) => {
    if (!result) return
    onChange(result.config)
    setSelectedZone(result.nextSelectedZone)
  }

  if (!open) {
    return null
  }

  return (
    <div className="reader-tap-zones-config" onClick={(event) => event.stopPropagation()}>
      <div className="reader-tap-zones-config__backdrop" onClick={(event) => event.stopPropagation()} />

      <div className="reader-tap-zones-config__canvas" onClick={(event) => event.stopPropagation()}>
        <ReaderTapZonesPreview value={value} onChange={onChange} selectedZone={selectedZone} onSelectedZoneChange={setSelectedZone} overlay showLabels />
      </div>

      <div className="reader-tap-zones-config__panel" onClick={(event) => event.stopPropagation()}>
        <div className="reader-tap-zones-config__panel-title">{t('readerTapZonesConfigTitle')}</div>

        <div className="reader-tap-zones-config__panel-row">
          <div className="reader-tap-zones-config__panel-label">{zoneLabel(resolvedSelectedZone)}</div>
          <Select
            className="reader-tap-zones-config__select"
            value={selectedZoneAction}
            onChange={(next: string) => {
              const nextActions = actions.slice()
              nextActions[resolvedSelectedZone] = next as ReaderTapZoneAction
              onChange({ version: 3, xSplits: xSplits.slice(), ySplits: ySplits.slice(), actions: nextActions })
            }}
            options={actionOptions}
            popupClassName="reader-tap-zones-config__dropdown"
          />
        </div>

        <div className="reader-tap-zones-config__panel-row reader-tap-zones-config__panel-row--zones">
          <div className="reader-tap-zones-config__panel-label">{t('readerTapZonesGridSummary', { cols: colCount, rows: rowCount, count: zoneCount })}</div>
          <div className="reader-tap-zones-config__zone-actions">
            <ReaderButton variant="ghost" size="sm" disabled={saving || !mergeXResult} onClick={() => applyZoneResult(mergeXResult)}>
              {t('readerTapZonesMergeColumns')}
            </ReaderButton>
            <ReaderButton variant="ghost" size="sm" disabled={saving || !splitXResult} onClick={() => applyZoneResult(splitXResult)}>
              {t('readerTapZonesSplitColumns')}
            </ReaderButton>
            <ReaderButton variant="ghost" size="sm" disabled={saving || !mergeYResult} onClick={() => applyZoneResult(mergeYResult)}>
              {t('readerTapZonesMergeRows')}
            </ReaderButton>
            <ReaderButton variant="ghost" size="sm" disabled={saving || !splitYResult} onClick={() => applyZoneResult(splitYResult)}>
              {t('readerTapZonesSplitRows')}
            </ReaderButton>
          </div>
        </div>

        <div className="reader-tap-zones-config__panel-row reader-tap-zones-config__panel-row--sizes">
          {sizes.map((size, index) => (
            <div key={index} className={`reader-tap-zones-config__size${index === resolvedSelectedZone ? ' is-selected' : ''}`}>
              <div className="reader-tap-zones-config__size-label">{zoneLabel(index)}</div>
              <div className="reader-tap-zones-config__size-value">
                {size.width}% × {size.height}%
              </div>
            </div>
          ))}
        </div>

        <div className="reader-tap-zones-config__panel-row">
          <div className="reader-tap-zones-config__panel-label">
            {t('readerTapZonesSelectedGridPosition', { row: selectedRowCol.row + 1, col: selectedRowCol.col + 1 })}
          </div>
        </div>

        <div className="reader-tap-zones-config__panel-actions">
          <ReaderButton variant="ghost" disabled={saving} onClick={onClose}>
            {t('cancel')}
          </ReaderButton>
          <ReaderButton
            variant="ghost"
            disabled={saving}
            onClick={() =>
              onChange({
                version: 3,
                xSplits: DEFAULT_READER_TAP_ZONES.xSplits.slice(),
                ySplits: DEFAULT_READER_TAP_ZONES.ySplits.slice(),
                actions: DEFAULT_READER_TAP_ZONES.actions.slice()
              })
            }
          >
            {t('resetToDefault')}
          </ReaderButton>
          <ReaderButton variant="primary" disabled={saving} onClick={() => onSave(value)}>
            {t('save')}
          </ReaderButton>
        </div>
      </div>

      <div className="reader-tap-zones-config__close">
        <ReaderButton
          shape="circle"
          size="lg"
          className="reader-tap-zones-config__close-button"
          ariaLabel={t('close')}
          onClick={onClose}
          icon={<CloseOutlined />}
        />
      </div>
    </div>
  )
}
