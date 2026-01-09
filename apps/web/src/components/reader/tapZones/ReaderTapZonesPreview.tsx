import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { buildTapZoneBoundaries, calcMinZoneWidthRatio, resolveCenterTapZoneIndex, type TapZoneSplitAxis } from '@/components/reader/tapZones/tapZonesUtils'
import { DEFAULT_READER_TAP_ZONES, type ReaderTapZoneAction, type ReaderTapZonesConfig } from '@/store/appSettings'

export type ReaderTapZonesPreviewProps = {
  value: ReaderTapZonesConfig
  onChange: (value: ReaderTapZonesConfig) => void
  selectedZone: number
  onSelectedZoneChange: (value: number) => void
  overlay?: boolean
  showLabels?: boolean
}

type DragState = {
  axis: TapZoneSplitAxis
  splitIndex: number
  startX: number
  startY: number
  startXSplits: number[]
  startYSplits: number[]
}

type DraggingState = { axis: TapZoneSplitAxis; splitIndex: number } | null

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
  const updateSplitRef = useRef<(axis: TapZoneSplitAxis, splitIndex: number, nextValue: number) => void>(() => {})
  const [dragging, setDragging] = useState<DraggingState>(null)

  useEffect(() => {
    valueRef.current = value
  }, [value])

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  const actions = Array.isArray(value?.actions) ? value.actions : DEFAULT_READER_TAP_ZONES.actions
  const xSplits = Array.isArray(value?.xSplits) ? value.xSplits : DEFAULT_READER_TAP_ZONES.xSplits
  const ySplits = Array.isArray(value?.ySplits) ? value.ySplits : DEFAULT_READER_TAP_ZONES.ySplits

  const colCount = Math.max(1, xSplits.length + 1)
  const rowCount = Math.max(1, ySplits.length + 1)
  const zoneCount = Math.max(1, colCount * rowCount)

  const centerZoneIndex = useMemo(() => resolveCenterTapZoneIndex(xSplits, ySplits), [xSplits, ySplits])
  const resolvedSelectedZone = Number.isFinite(selectedZone) && selectedZone >= 0 && selectedZone < zoneCount ? selectedZone : centerZoneIndex

  const xBoundaries = useMemo(() => buildTapZoneBoundaries(xSplits), [xSplits])
  const yBoundaries = useMemo(() => buildTapZoneBoundaries(ySplits), [ySplits])

  const zones = useMemo(() => {
    const list: { index: number; left: number; top: number; width: number; height: number }[] = []
    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < colCount; col += 1) {
        const index = row * colCount + col
        const left = Number(xBoundaries[col] ?? 0)
        const right = Number(xBoundaries[col + 1] ?? 1)
        const top = Number(yBoundaries[row] ?? 0)
        const bottom = Number(yBoundaries[row + 1] ?? 1)
        list.push({
          index,
          left,
          top,
          width: Math.max(0, right - left),
          height: Math.max(0, bottom - top)
        })
      }
    }
    return list
  }, [colCount, rowCount, xBoundaries, yBoundaries])

  const actionLabel = (action: ReaderTapZoneAction) => {
    const key = String(action || '').trim().toLowerCase()
    if (key === 'prev_page') return t('readerTapActionPrevPage')
    if (key === 'next_page') return t('readerTapActionNextPage')
    if (key === 'toggle_toolbar') return t('readerTapActionToggleToolbar')
    if (key === 'expand_toolbar') return t('readerTapActionExpandToolbar')
    if (key === 'collapse_toolbar') return t('readerTapActionCollapseToolbar')
    return t('readerTapActionNone')
  }

  updateSplitRef.current = (axis: TapZoneSplitAxis, splitIndex: number, nextValue: number) => {
    const current = valueRef.current || DEFAULT_READER_TAP_ZONES
    const currentActions = Array.isArray(current?.actions) ? current.actions : DEFAULT_READER_TAP_ZONES.actions
    const currentXSplits = Array.isArray(current?.xSplits) ? current.xSplits : DEFAULT_READER_TAP_ZONES.xSplits
    const currentYSplits = Array.isArray(current?.ySplits) ? current.ySplits : DEFAULT_READER_TAP_ZONES.ySplits

    if (axis === 'x') {
      if (splitIndex < 0 || splitIndex >= currentXSplits.length) return
      const minWidthRatio = calcMinZoneWidthRatio(currentXSplits.length + 1)
      const leftBoundary = splitIndex === 0 ? 0 : Number(currentXSplits[splitIndex - 1] ?? 0)
      const rightBoundary = splitIndex === currentXSplits.length - 1 ? 1 : Number(currentXSplits[splitIndex + 1] ?? 1)
      const clamped = clamp(nextValue, leftBoundary + minWidthRatio, rightBoundary - minWidthRatio)

      const nextXSplits = currentXSplits.slice()
      nextXSplits[splitIndex] = clamped
      onChangeRef.current({ version: 3, xSplits: nextXSplits, ySplits: currentYSplits.slice(), actions: currentActions.slice() })
      return
    }

    if (splitIndex < 0 || splitIndex >= currentYSplits.length) return
    const minHeightRatio = calcMinZoneWidthRatio(currentYSplits.length + 1)
    const topBoundary = splitIndex === 0 ? 0 : Number(currentYSplits[splitIndex - 1] ?? 0)
    const bottomBoundary = splitIndex === currentYSplits.length - 1 ? 1 : Number(currentYSplits[splitIndex + 1] ?? 1)
    const clamped = clamp(nextValue, topBoundary + minHeightRatio, bottomBoundary - minHeightRatio)

    const nextYSplits = currentYSplits.slice()
    nextYSplits[splitIndex] = clamped
    onChangeRef.current({ version: 3, xSplits: currentXSplits.slice(), ySplits: nextYSplits, actions: currentActions.slice() })
  }

  const handlePointerMove = useCallback((event: PointerEvent) => {
    const host = previewRef.current
    const dragState = dragStateRef.current
    if (!dragState || !host || typeof host.getBoundingClientRect !== 'function') return
    const rect = host.getBoundingClientRect()
    if (!rect.width || !rect.height) return

    if (dragState.axis === 'x') {
      const dxRatio = (event.clientX - dragState.startX) / rect.width
      updateSplitRef.current(dragState.axis, dragState.splitIndex, dragState.startXSplits[dragState.splitIndex] + dxRatio)
      return
    }

    const dyRatio = (event.clientY - dragState.startY) / rect.height
    updateSplitRef.current(dragState.axis, dragState.splitIndex, dragState.startYSplits[dragState.splitIndex] + dyRatio)
  }, [])

  const handlePointerUp = useCallback(() => {
    window.removeEventListener('pointermove', handlePointerMove)
    window.removeEventListener('pointerup', handlePointerUp)
    dragStateRef.current = null
    setDragging(null)
  }, [handlePointerMove])

  useEffect(() => {
    return () => handlePointerUp()
  }, [handlePointerUp])

  const handlePointerDown = (axis: TapZoneSplitAxis, splitIndex: number) => (event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()

    const current = valueRef.current || DEFAULT_READER_TAP_ZONES
    const currentXSplits = Array.isArray(current?.xSplits) ? current.xSplits : DEFAULT_READER_TAP_ZONES.xSplits
    const currentYSplits = Array.isArray(current?.ySplits) ? current.ySplits : DEFAULT_READER_TAP_ZONES.ySplits

    dragStateRef.current = {
      axis,
      splitIndex,
      startX: event.clientX,
      startY: event.clientY,
      startXSplits: currentXSplits.slice(),
      startYSplits: currentYSplits.slice()
    }
    setDragging({ axis, splitIndex })
    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  const zoneTitle = (zoneIndex: number) => t('readerTapZoneIndex', { index: zoneIndex + 1 })

  return (
    <div ref={previewRef} className={`reader-tap-zones-preview${overlay ? ' is-overlay' : ''}`}>
      {zones.map((zone) => {
        const isSelected = zone.index === resolvedSelectedZone
        const shouldShowLabel = showLabels && (zoneCount <= 4 || isSelected)
        return (
          <div
            key={zone.index}
            className={`reader-tap-zones-preview__zone${isSelected ? ' is-selected' : ''}`}
            style={{
              left: `${zone.left * 100}%`,
              top: `${zone.top * 100}%`,
              width: `${zone.width * 100}%`,
              height: `${zone.height * 100}%`
            }}
            onClick={(event) => {
              event.stopPropagation()
              onSelectedZoneChange(zone.index)
            }}
          >
            {shouldShowLabel ? (
              <div className="reader-tap-zones-preview__label">
                <div className="reader-tap-zones-preview__label-title">{zoneTitle(zone.index)}</div>
                <div className="reader-tap-zones-preview__label-sub">{actionLabel((actions as any)?.[zone.index] ?? 'none')}</div>
              </div>
            ) : null}
          </div>
        )
      })}

      {(Array.isArray(xSplits) ? xSplits : []).map((ratio, splitIndex) => (
        <div
          key={`x-${splitIndex}`}
          className={`reader-tap-zones-preview__handle reader-tap-zones-preview__handle--vertical${
            dragging?.axis === 'x' && dragging.splitIndex === splitIndex ? ' is-dragging' : ''
          }`}
          style={{ left: `${Number(ratio || 0) * 100}%` }}
          onPointerDown={handlePointerDown('x', splitIndex)}
        >
          <div className="reader-tap-zones-preview__handle-line" />
        </div>
      ))}

      {(Array.isArray(ySplits) ? ySplits : []).map((ratio, splitIndex) => (
        <div
          key={`y-${splitIndex}`}
          className={`reader-tap-zones-preview__handle reader-tap-zones-preview__handle--horizontal${
            dragging?.axis === 'y' && dragging.splitIndex === splitIndex ? ' is-dragging' : ''
          }`}
          style={{ top: `${Number(ratio || 0) * 100}%` }}
          onPointerDown={handlePointerDown('y', splitIndex)}
        >
          <div className="reader-tap-zones-preview__handle-line" />
        </div>
      ))}
    </div>
  )
}
