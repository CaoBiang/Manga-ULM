import type { CSSProperties } from 'react'
import { useEffect, useMemo } from 'react'
import { useAppSettingsStore } from '@/store/appSettings'

const clampInt = (value: unknown, min: number, max: number) => {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (Number.isNaN(parsed)) return null
  return Math.max(min, Math.min(max, parsed))
}

const clampFloat = (value: unknown, min: number, max: number) => {
  const parsed = Number.parseFloat(String(value ?? ''))
  if (Number.isNaN(parsed)) return null
  return Math.max(min, Math.min(max, parsed))
}

export type ReaderStyleVarsResult = {
  animationMs: number
  cssVars: Record<string, string>
  style: CSSProperties
}

export const useReaderStyleVars = (collapsedToolbarWidthPx: number | null): ReaderStyleVarsResult => {
  const readerToolbarAnimationMs = useAppSettingsStore((state) => state.readerToolbarAnimationMs)
  const readerToolbarBackgroundOpacity = useAppSettingsStore((state) => state.readerToolbarBackgroundOpacity)
  const readerUiBlurEnabled = useAppSettingsStore((state) => state.readerUiBlurEnabled)
  const readerUiBlurRadiusPx = useAppSettingsStore((state) => state.readerUiBlurRadiusPx)
  const readerUiControlBgOpacity = useAppSettingsStore((state) => state.readerUiControlBgOpacity)
  const readerUiControlBorderOpacity = useAppSettingsStore((state) => state.readerUiControlBorderOpacity)

  const normalizeToolbarAnimation = useMemo(() => clampInt(readerToolbarAnimationMs, 120, 600) ?? 240, [readerToolbarAnimationMs])
  const normalizeToolbarBackground = useMemo(
    () => clampFloat(readerToolbarBackgroundOpacity, 0.08, 0.8) ?? 0.28,
    [readerToolbarBackgroundOpacity]
  )
  const normalizeUiBlurRadius = useMemo(() => clampInt(readerUiBlurRadiusPx, 0, 30) ?? 12, [readerUiBlurRadiusPx])
  const normalizeUiBgOpacity = useMemo(() => clampFloat(readerUiControlBgOpacity, 0.12, 0.7) ?? 0.46, [readerUiControlBgOpacity])
  const normalizeUiBorderOpacity = useMemo(
    () => clampFloat(readerUiControlBorderOpacity, 0.06, 0.4) ?? 0.16,
    [readerUiControlBorderOpacity]
  )

  const cssVars = useMemo<Record<string, string>>(() => {
    const ms = normalizeToolbarAnimation

    const bgOpacity = normalizeUiBgOpacity
    const borderOpacity = normalizeUiBorderOpacity
    const bgHover = Math.min(0.94, bgOpacity + 0.1)
    const bgActive = Math.min(0.96, bgOpacity + 0.14)
    const borderHover = Math.min(0.6, borderOpacity + 0.06)

    const tableBgOpacity = Math.min(0.92, bgOpacity + 0.26)
    const tableBorderOpacity = Math.min(0.32, borderOpacity + 0.04)

    const toolbarBgOpacity = normalizeToolbarBackground
    const toolbarBgHoverOpacity = Math.min(0.95, toolbarBgOpacity + 0.08)
    const toolbarBgActiveOpacity = Math.min(0.98, toolbarBgOpacity + 0.12)
    const toolbarBorderOpacity = Math.min(0.32, borderOpacity + 0.02)
    const toolbarBorderHoverOpacity = Math.min(0.42, toolbarBorderOpacity + 0.08)
    const toolbarControlBgOpacity = Math.min(0.36, Math.max(0.12, toolbarBgOpacity - 0.06))
    const toolbarControlBgHoverOpacity = Math.min(0.46, toolbarControlBgOpacity + 0.1)
    const toolbarControlBgActiveOpacity = Math.min(0.54, toolbarControlBgOpacity + 0.18)

    const blurEnabled = readerUiBlurEnabled ?? true
    const blurValue = blurEnabled ? `blur(${normalizeUiBlurRadius}px) saturate(1.25)` : 'none'

    const collapsedWidth = collapsedToolbarWidthPx ? `${collapsedToolbarWidthPx}px` : 'fit-content'

    return {
      '--reader-ui-table-bg': `rgba(18, 18, 18, ${tableBgOpacity})`,
      '--reader-ui-table-border': `rgba(255, 255, 255, ${tableBorderOpacity})`,
      '--reader-toolbar-bg': `rgba(18, 18, 18, ${toolbarBgOpacity})`,
      '--reader-toolbar-bg-hover': `rgba(18, 18, 18, ${toolbarBgHoverOpacity})`,
      '--reader-toolbar-bg-active': `rgba(18, 18, 18, ${toolbarBgActiveOpacity})`,
      '--reader-toolbar-border': `rgba(255, 255, 255, ${toolbarBorderOpacity})`,
      '--reader-toolbar-border-hover': `rgba(255, 255, 255, ${toolbarBorderHoverOpacity})`,
      '--reader-toolbar-shadow': '0 14px 40px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
      '--reader-toolbar-control-shadow': '0 10px 26px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
      '--reader-toolbar-control-bg': `rgba(18, 18, 18, ${toolbarControlBgOpacity})`,
      '--reader-toolbar-control-bg-hover': `rgba(26, 26, 26, ${toolbarControlBgHoverOpacity})`,
      '--reader-toolbar-control-bg-active': `rgba(32, 32, 32, ${toolbarControlBgActiveOpacity})`,
      '--reader-toolbar-anim-ms': `${ms}ms`,
      '--reader-toolbar-anim-fast-ms': `${Math.round(ms * 0.65)}ms`,
      '--reader-toolbar-anim-delay-ms': `${Math.round(ms * 0.18)}ms`,
      '--reader-toolbar-collapsed-width-px': collapsedWidth,
      '--reader-ui-control-backdrop-filter': blurValue,
      '--reader-ui-control-bg': `rgba(18, 18, 18, ${bgOpacity})`,
      '--reader-ui-control-bg-hover': `rgba(28, 28, 28, ${bgHover})`,
      '--reader-ui-control-bg-active': `rgba(34, 34, 34, ${bgActive})`,
      '--reader-ui-control-border': `rgba(255, 255, 255, ${borderOpacity})`,
      '--reader-ui-control-border-hover': `rgba(255, 255, 255, ${borderHover})`
    }
  }, [
    collapsedToolbarWidthPx,
    normalizeToolbarAnimation,
    normalizeToolbarBackground,
    normalizeUiBgOpacity,
    normalizeUiBorderOpacity,
    normalizeUiBlurRadius,
    readerUiBlurEnabled
  ])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const body = document.body
    for (const [key, value] of Object.entries(cssVars)) {
      body.style.setProperty(key, value)
    }
    return () => {
      for (const key of Object.keys(cssVars)) {
        body.style.removeProperty(key)
      }
    }
  }, [cssVars])

  return {
    animationMs: normalizeToolbarAnimation,
    cssVars,
    style: cssVars as unknown as CSSProperties
  }
}
