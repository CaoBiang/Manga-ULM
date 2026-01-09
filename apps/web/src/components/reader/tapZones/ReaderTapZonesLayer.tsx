import type { MouseEventHandler } from 'react'
import { resolveTapZoneIndex } from '@/components/reader/tapZones/tapZonesUtils'
import { DEFAULT_READER_TAP_ZONES, type ReaderTapZoneAction, type ReaderTapZonesConfig } from '@/store/appSettings'

export type TapZoneTrigger = {
  zoneIndex: number
  action: ReaderTapZoneAction
}

export type ReaderTapZonesLayerProps = {
  config?: ReaderTapZonesConfig
  disabled?: boolean
  onTrigger: (trigger: TapZoneTrigger) => void
}

export default function ReaderTapZonesLayer({ config = DEFAULT_READER_TAP_ZONES, disabled = false, onTrigger }: ReaderTapZonesLayerProps) {
  const normalizedConfig = config && typeof config === 'object' ? config : DEFAULT_READER_TAP_ZONES
  const actions = normalizedConfig.actions || DEFAULT_READER_TAP_ZONES.actions
  const xSplits = normalizedConfig.xSplits || DEFAULT_READER_TAP_ZONES.xSplits
  const ySplits = normalizedConfig.ySplits || DEFAULT_READER_TAP_ZONES.ySplits

  const handleClick: MouseEventHandler<HTMLDivElement> = (event) => {
    if (disabled) return
    const host = event.currentTarget
    if (!host || typeof host.getBoundingClientRect !== 'function') return
    const rect = host.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const xRatio = (event.clientX - rect.left) / rect.width
    const yRatio = (event.clientY - rect.top) / rect.height
    const zoneIndex = resolveTapZoneIndex({ xRatio, yRatio, xSplits, ySplits }).index
    const action = (actions as any)?.[zoneIndex] ?? 'none'
    onTrigger({ zoneIndex, action })
  }

  return <div className={`reader-tap-zones-layer${disabled ? ' is-disabled' : ''}`} onClick={handleClick} />
}
