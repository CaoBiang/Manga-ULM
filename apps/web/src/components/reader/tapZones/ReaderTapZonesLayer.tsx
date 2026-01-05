import type { MouseEventHandler } from 'react'
import { DEFAULT_READER_TAP_ZONES, type ReaderTapZoneAction, type ReaderTapZoneKey, type ReaderTapZonesConfig } from '@/store/appSettings'

export type TapZoneTrigger = {
  zoneKey: ReaderTapZoneKey
  action: ReaderTapZoneAction
}

export type ReaderTapZonesLayerProps = {
  config?: ReaderTapZonesConfig
  disabled?: boolean
  onTrigger: (trigger: TapZoneTrigger) => void
}

export default function ReaderTapZonesLayer({ config = DEFAULT_READER_TAP_ZONES, disabled = false, onTrigger }: ReaderTapZonesLayerProps) {
  const normalizedConfig = config && typeof config === 'object' ? config : DEFAULT_READER_TAP_ZONES
  const boundaries = normalizedConfig.boundaries || DEFAULT_READER_TAP_ZONES.boundaries
  const actions = normalizedConfig.actions || DEFAULT_READER_TAP_ZONES.actions

  const resolveZoneKey = (xRatio: number): ReaderTapZoneKey => {
    const left = Number((boundaries as any).left ?? DEFAULT_READER_TAP_ZONES.boundaries.left)
    const right = Number((boundaries as any).right ?? DEFAULT_READER_TAP_ZONES.boundaries.right)
    if (xRatio < left) return 'left'
    if (xRatio > right) return 'right'
    return 'middle'
  }

  const handleClick: MouseEventHandler<HTMLDivElement> = (event) => {
    if (disabled) return
    const host = event.currentTarget
    if (!host || typeof host.getBoundingClientRect !== 'function') return
    const rect = host.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const xRatio = (event.clientX - rect.left) / rect.width
    const zoneKey = resolveZoneKey(xRatio)
    const action = (actions as any)?.[zoneKey] ?? 'none'
    onTrigger({ zoneKey, action })
  }

  return <div className={`reader-tap-zones-layer${disabled ? ' is-disabled' : ''}`} onClick={handleClick} />
}

