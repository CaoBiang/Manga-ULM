import { CloseOutlined } from '@ant-design/icons'
import { Select, Slider } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ReaderButton from '@/components/reader/ui/ReaderButton'
import ReaderTapZonesPreview from '@/components/reader/tapZones/ReaderTapZonesPreview'
import { DEFAULT_READER_TAP_ZONES, type ReaderTapZoneAction, type ReaderTapZoneKey, type ReaderTapZonesConfig } from '@/store/appSettings'

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

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
  const [selectedZone, setSelectedZone] = useState<ReaderTapZoneKey>('middle')

  useEffect(() => {
    if (open) {
      setSelectedZone('middle')
    }
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

  const zoneLabel = (zoneKey: ReaderTapZoneKey) => {
    if (zoneKey === 'left') return t('readerTapZoneLeft')
    if (zoneKey === 'right') return t('readerTapZoneRight')
    return t('readerTapZoneMiddle')
  }

  const boundaries = value?.boundaries ?? DEFAULT_READER_TAP_ZONES.boundaries
  const actions = value?.actions ?? DEFAULT_READER_TAP_ZONES.actions
  const leftRatio = Number((boundaries as any)?.left ?? DEFAULT_READER_TAP_ZONES.boundaries.left)
  const rightRatio = Number((boundaries as any)?.right ?? DEFAULT_READER_TAP_ZONES.boundaries.right)

  const widthTexts = useMemo(() => {
    const left = Math.round(leftRatio * 100)
    const middle = Math.round((rightRatio - leftRatio) * 100)
    const right = Math.round((1 - rightRatio) * 100)
    return { left, middle, right }
  }, [leftRatio, rightRatio])

  const setBoundaries = (left: number, right: number) => {
    const minZoneWidth = 0.08
    const normalizedLeft = clamp(left, minZoneWidth, 1 - minZoneWidth)
    const normalizedRight = clamp(right, minZoneWidth, 1 - minZoneWidth)
    if (normalizedLeft >= normalizedRight) return
    if (normalizedLeft < minZoneWidth || 1 - normalizedRight < minZoneWidth || normalizedRight - normalizedLeft < minZoneWidth) return

    onChange({
      ...(value || DEFAULT_READER_TAP_ZONES),
      version: 1,
      boundaries: { left: normalizedLeft, right: normalizedRight },
      actions: { ...(actions || DEFAULT_READER_TAP_ZONES.actions) }
    })
  }

  if (!open) {
    return null
  }

  return (
    <div className="reader-tap-zones-config" onClick={(event) => event.stopPropagation()}>
      <div className="reader-tap-zones-config__backdrop" onClick={(event) => event.stopPropagation()} />

      <div className="reader-tap-zones-config__canvas" onClick={(event) => event.stopPropagation()}>
        <ReaderTapZonesPreview
          value={value}
          onChange={onChange}
          selectedZone={selectedZone}
          onSelectedZoneChange={setSelectedZone}
          overlay
          showLabels
        />
      </div>

      <div className="reader-tap-zones-config__panel" onClick={(event) => event.stopPropagation()}>
        <div className="reader-tap-zones-config__panel-title">{t('readerTapZonesConfigTitle')}</div>

        <div className="reader-tap-zones-config__panel-row">
          <div className="reader-tap-zones-config__panel-label">{zoneLabel(selectedZone)}</div>
          <Select
            className="reader-tap-zones-config__select"
            value={(actions as any)?.[selectedZone] ?? 'none'}
            onChange={(next: string) => {
              const nextValue: ReaderTapZonesConfig = {
                ...(value || DEFAULT_READER_TAP_ZONES),
                actions: { ...(actions || DEFAULT_READER_TAP_ZONES.actions), [selectedZone]: next as ReaderTapZoneAction }
              }
              onChange(nextValue)
            }}
            options={actionOptions}
            popupClassName="reader-tap-zones-config__dropdown"
          />
        </div>

        <div className="reader-tap-zones-config__panel-row reader-tap-zones-config__panel-row--sizes">
          <div className="reader-tap-zones-config__size">
            <div className="reader-tap-zones-config__size-label">{t('readerTapZoneLeft')}</div>
            <div className="reader-tap-zones-config__size-value">{widthTexts.left}%</div>
          </div>
          <div className="reader-tap-zones-config__size">
            <div className="reader-tap-zones-config__size-label">{t('readerTapZoneMiddle')}</div>
            <div className="reader-tap-zones-config__size-value">{widthTexts.middle}%</div>
          </div>
          <div className="reader-tap-zones-config__size">
            <div className="reader-tap-zones-config__size-label">{t('readerTapZoneRight')}</div>
            <div className="reader-tap-zones-config__size-value">{widthTexts.right}%</div>
          </div>
        </div>

        <div className="reader-tap-zones-config__panel-row reader-tap-zones-config__panel-row--sliders">
          <div className="reader-tap-zones-config__slider-block">
            <div className="reader-tap-zones-config__slider-label">{t('readerTapZonesLeftWidth')}</div>
            <Slider
              value={widthTexts.left}
              min={8}
              max={84}
              step={1}
              tooltip={{ open: false }}
              onChange={(percent) => {
                const nextLeft = clamp(Number(percent) / 100, 0.08, 0.92)
                setBoundaries(nextLeft, rightRatio)
              }}
            />
          </div>
          <div className="reader-tap-zones-config__slider-block">
            <div className="reader-tap-zones-config__slider-label">{t('readerTapZonesRightWidth')}</div>
            <Slider
              value={widthTexts.right}
              min={8}
              max={84}
              step={1}
              tooltip={{ open: false }}
              onChange={(percent) => {
                const nextRight = 1 - clamp(Number(percent) / 100, 0.08, 0.92)
                setBoundaries(leftRatio, nextRight)
              }}
            />
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
                version: 1,
                boundaries: { ...DEFAULT_READER_TAP_ZONES.boundaries },
                actions: { ...DEFAULT_READER_TAP_ZONES.actions }
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

