import { useCallback, useEffect, useMemo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { DEFAULT_READER_TAP_ZONES, type ReaderTapZoneAction, type ReaderTapZoneKey, type ReaderTapZonesConfig } from '@/store/appSettings'

const MIN_ZONE_WIDTH_RATIO = 0.08

export type ReaderTapZonesPreviewProps = {
  value: ReaderTapZonesConfig
  onChange: (value: ReaderTapZonesConfig) => void
  selectedZone: ReaderTapZoneKey
  onSelectedZoneChange: (value: ReaderTapZoneKey) => void
  overlay?: boolean
  showLabels?: boolean
}

type DragState = {
  handle: 'left' | 'right'
  startX: number
  startLeft: number
  startRight: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export default function ReaderTapZonesPreview({
  value,
  onChange,
  selectedZone,
  onSelectedZoneChange,
  overlay = false,
  showLabels = true
}: ReaderTapZonesPreviewProps) {
  const { t } = useTranslation()

  const previewRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const valueRef = useRef<ReaderTapZonesConfig>(value)
  const onChangeRef = useRef(onChange)
  const updateBoundariesRef = useRef<(nextLeft: number, nextRight: number) => void>(() => {})

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const resolvedSelectedZone = (['left', 'middle', 'right'] as const).includes(selectedZone) ? selectedZone : 'middle'

  const boundaries = value?.boundaries ?? DEFAULT_READER_TAP_ZONES.boundaries
  const actions = value?.actions ?? DEFAULT_READER_TAP_ZONES.actions

  const leftRatio = Number((boundaries as any)?.left ?? DEFAULT_READER_TAP_ZONES.boundaries.left)
  const rightRatio = Number((boundaries as any)?.right ?? DEFAULT_READER_TAP_ZONES.boundaries.right)

  const leftPercent = Math.round(leftRatio * 100)
  const rightPercent = Math.round(rightRatio * 100)

  const zoneStyles = useMemo(
    () => ({
      left: { left: '0%', width: `${Math.max(0, leftRatio) * 100}%` },
      middle: { left: `${Math.max(0, leftRatio) * 100}%`, width: `${Math.max(0, rightRatio - leftRatio) * 100}%` },
      right: { left: `${Math.max(0, rightRatio) * 100}%`, width: `${Math.max(0, 1 - rightRatio) * 100}%` }
    }),
    [leftRatio, rightRatio]
  )

  const actionLabel = (action: ReaderTapZoneAction) => {
    const key = String(action || '').trim().toLowerCase()
    if (key === 'prev_page') return t('readerTapActionPrevPage')
    if (key === 'next_page') return t('readerTapActionNextPage')
    if (key === 'toggle_toolbar') return t('readerTapActionToggleToolbar')
    if (key === 'expand_toolbar') return t('readerTapActionExpandToolbar')
    if (key === 'collapse_toolbar') return t('readerTapActionCollapseToolbar')
    return t('readerTapActionNone')
  }

  updateBoundariesRef.current = (nextLeft: number, nextRight: number) => {
    const left = clamp(nextLeft, MIN_ZONE_WIDTH_RATIO, 1 - MIN_ZONE_WIDTH_RATIO)
    const right = clamp(nextRight, MIN_ZONE_WIDTH_RATIO, 1 - MIN_ZONE_WIDTH_RATIO)
    if (left >= right) return
    if (left < MIN_ZONE_WIDTH_RATIO || 1 - right < MIN_ZONE_WIDTH_RATIO || right - left < MIN_ZONE_WIDTH_RATIO) return

    const current = valueRef.current || DEFAULT_READER_TAP_ZONES
    onChangeRef.current({
      ...(current || DEFAULT_READER_TAP_ZONES),
      version: 1,
      boundaries: { left, right },
      actions: { ...(current.actions || DEFAULT_READER_TAP_ZONES.actions) }
    })
  }

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const host = previewRef.current
    const dragState = dragStateRef.current
    if (!dragState || !host || typeof host.getBoundingClientRect !== 'function') return
    const rect = host.getBoundingClientRect()
    if (!rect.width) return

    const dxRatio = (event.clientX - dragState.startX) / rect.width
    if (dragState.handle === 'left') {
      updateBoundariesRef.current(dragState.startLeft + dxRatio, dragState.startRight)
    } else {
      updateBoundariesRef.current(dragState.startLeft, dragState.startRight + dxRatio)
    }
  }, [])

  const handlePointerUp = useCallback(() => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    dragStateRef.current = null
  }, [handlePointerMove])

  useEffect(() => {
    return () => handlePointerUp()
  }, [handlePointerUp])

  const handlePointerDown = (handle: 'left' | 'right') => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    dragStateRef.current = {
      handle,
      startX: event.clientX,
      startLeft: leftRatio,
      startRight: rightRatio
    }
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  return (
    <div ref={previewRef} className={`reader-tap-zones-preview${overlay ? ' is-overlay' : ''}`}>
      <div
        className={`reader-tap-zones-preview__zone reader-tap-zones-preview__zone--left${resolvedSelectedZone === 'left' ? ' is-selected' : ''}`}
        style={zoneStyles.left}
        onClick={(event) => {
          event.stopPropagation()
          onSelectedZoneChange('left')
        }}
      >
        {showLabels ? (
          <div className="reader-tap-zones-preview__label">
            <div className="reader-tap-zones-preview__label-title">{t('readerTapZoneLeft')}</div>
            <div className="reader-tap-zones-preview__label-sub">{actionLabel((actions as any)?.left ?? 'none')}</div>
          </div>
        ) : null}
      </div>

      <div
        className={`reader-tap-zones-preview__zone reader-tap-zones-preview__zone--middle${resolvedSelectedZone === 'middle' ? ' is-selected' : ''}`}
        style={zoneStyles.middle}
        onClick={(event) => {
          event.stopPropagation()
          onSelectedZoneChange('middle')
        }}
      >
        {showLabels ? (
          <div className="reader-tap-zones-preview__label">
            <div className="reader-tap-zones-preview__label-title">{t('readerTapZoneMiddle')}</div>
            <div className="reader-tap-zones-preview__label-sub">{actionLabel((actions as any)?.middle ?? 'none')}</div>
          </div>
        ) : null}
      </div>

      <div
        className={`reader-tap-zones-preview__zone reader-tap-zones-preview__zone--right${resolvedSelectedZone === 'right' ? ' is-selected' : ''}`}
        style={zoneStyles.right}
        onClick={(event) => {
          event.stopPropagation()
          onSelectedZoneChange('right')
        }}
      >
        {showLabels ? (
          <div className="reader-tap-zones-preview__label">
            <div className="reader-tap-zones-preview__label-title">{t('readerTapZoneRight')}</div>
            <div className="reader-tap-zones-preview__label-sub">{actionLabel((actions as any)?.right ?? 'none')}</div>
          </div>
        ) : null}
      </div>

      <div
        className="reader-tap-zones-preview__handle reader-tap-zones-preview__handle--left"
        style={{ left: `${leftPercent}%` }}
        onPointerDown={handlePointerDown('left')}
      >
        <div className="reader-tap-zones-preview__handle-line" />
        <div className="reader-tap-zones-preview__handle-knob" />
      </div>

      <div
        className="reader-tap-zones-preview__handle reader-tap-zones-preview__handle--right"
        style={{ left: `${rightPercent}%` }}
        onPointerDown={handlePointerDown('right')}
      >
        <div className="reader-tap-zones-preview__handle-line" />
        <div className="reader-tap-zones-preview__handle-knob" />
      </div>
    </div>
  )
}
