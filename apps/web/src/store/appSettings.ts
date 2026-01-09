import { create } from 'zustand'
import { http } from '@/api/http'

const SETTINGS_KEYS = Object.freeze({
  language: 'ui.language',
  libraryViewMode: 'ui.library.view_mode',
  libraryPerPage: 'ui.library.pagination.per_page',
  libraryLazyRootMarginPx: 'ui.library.lazy_load.root_margin_px',
  managerUiBlurEnabled: 'ui.manager.ui.blur_enabled',
  managerUiBlurRadiusPx: 'ui.manager.ui.blur_radius_px',
  managerUiSurfaceBgOpacity: 'ui.manager.ui.surface_bg_opacity',
  managerUiSurfaceBorderOpacity: 'ui.manager.ui.surface_border_opacity',
  managerUiControlBgOpacity: 'ui.manager.ui.control_bg_opacity',
  managerUiControlBorderOpacity: 'ui.manager.ui.control_border_opacity',
  readerPreloadAhead: 'ui.reader.preload_ahead',
  readerSplitDefaultEnabled: 'ui.reader.split_view.default_enabled',
  readerWideRatioThreshold: 'ui.reader.wide_ratio_threshold',
  readerToolbarAnimationMs: 'ui.reader.toolbar.animation_ms',
  readerToolbarBackgroundOpacity: 'ui.reader.toolbar.background_opacity',
  readerToolbarKeepStateOnPaging: 'ui.reader.toolbar.keep_state_on_paging',
  readerToolbarCenterClickToggleEnabled: 'ui.reader.toolbar.center_click_toggle_enabled',
  readerTapZones: 'ui.reader.tap_zones',
  readerImageMaxSidePx: 'ui.reader.image.max_side_px',
  readerImageMaxSidePresets: 'ui.reader.image.max_side_presets',
  readerImageRenderFormat: 'ui.reader.image.render.format',
  readerImageRenderQuality: 'ui.reader.image.render.quality',
  readerImageRenderResample: 'ui.reader.image.render.resample',
  readerImagePreloadConcurrency: 'ui.reader.image.preload.concurrency',
  readerUiBlurEnabled: 'ui.reader.ui.blur_enabled',
  readerUiBlurRadiusPx: 'ui.reader.ui.blur_radius_px',
  readerUiControlBgOpacity: 'ui.reader.ui.control_bg_opacity',
  readerUiControlBorderOpacity: 'ui.reader.ui.control_border_opacity',
  renameFilenameTemplate: 'rename.filename_template',
  tasksHistoryLimit: 'ui.tasks.history.limit',
  tasksHistoryRetentionDays: 'ui.tasks.history.retention_days',
  tasksNotifyOnComplete: 'ui.tasks.notify.on_complete',
  tasksNotifyOnFail: 'ui.tasks.notify.on_fail',
  tasksBadgeEnabled: 'ui.tasks.badge.enabled'
})

export type Language = 'zh' | 'en'
export type LibraryViewMode = 'grid' | 'list'
export type ReaderTapZoneAction = 'none' | 'prev_page' | 'next_page' | 'toggle_toolbar' | 'expand_toolbar' | 'collapse_toolbar'
export type ReaderImageRenderFormat = 'webp' | 'jpeg' | 'png' | 'auto'
export type ReaderImageRenderResample = 'nearest' | 'bilinear' | 'bicubic' | 'lanczos'

export type ReaderTapZonesConfig = {
  version: 3
  xSplits: number[]
  ySplits: number[]
  actions: ReaderTapZoneAction[]
}

export const DEFAULT_READER_TAP_ZONES: ReaderTapZonesConfig = Object.freeze({
  version: 3,
  xSplits: Object.freeze([0.3, 0.7] as number[]),
  ySplits: Object.freeze([] as number[]),
  actions: Object.freeze(['prev_page', 'toggle_toolbar', 'next_page'] as ReaderTapZoneAction[])
}) as unknown as ReaderTapZonesConfig

const READER_TAP_ZONE_ACTIONS: ReaderTapZoneAction[] = [
  'none',
  'prev_page',
  'next_page',
  'toggle_toolbar',
  'expand_toolbar',
  'collapse_toolbar'
]

export type AppSettingsState = {
  loaded: boolean
  loading: boolean
  lastError: string

  language: Language
  libraryViewMode: LibraryViewMode
  libraryPerPage: number
  libraryLazyRootMarginPx: number

  managerUiBlurEnabled: boolean
  managerUiBlurRadiusPx: number
  managerUiSurfaceBgOpacity: number
  managerUiSurfaceBorderOpacity: number
  managerUiControlBgOpacity: number
  managerUiControlBorderOpacity: number

  readerPreloadAhead: number
  readerSplitDefaultEnabled: boolean
  readerWideRatioThreshold: number
  readerToolbarAnimationMs: number
  readerToolbarBackgroundOpacity: number
  readerToolbarKeepStateOnPaging: boolean
  readerToolbarCenterClickToggleEnabled: boolean
  readerTapZones: ReaderTapZonesConfig
  readerImageMaxSidePx: number
  readerImageMaxSidePresets: number[]
  readerImageRenderFormat: ReaderImageRenderFormat
  readerImageRenderQuality: number
  readerImageRenderResample: ReaderImageRenderResample
  readerImagePreloadConcurrency: number
  readerUiBlurEnabled: boolean
  readerUiBlurRadiusPx: number
  readerUiControlBgOpacity: number
  readerUiControlBorderOpacity: number

  renameFilenameTemplate: string

  tasksHistoryLimit: number
  tasksHistoryRetentionDays: number
  tasksNotifyOnComplete: boolean
  tasksNotifyOnFail: boolean
  tasksBadgeEnabled: boolean

  ensureLoaded: () => Promise<void>
  saveSetting: (key: string, value: string) => Promise<void>
  resetSetting: (key: string) => Promise<void>
  setLanguage: (language: Language) => Promise<void>
  setLibraryViewMode: (mode: LibraryViewMode) => Promise<void>
  setLibraryPerPage: (value: number) => Promise<void>
  setLibraryLazyRootMarginPx: (value: number) => Promise<void>
  setManagerUiBlurEnabled: (value: boolean) => Promise<void>
  setManagerUiBlurRadiusPx: (value: number) => Promise<void>
  setManagerUiSurfaceBgOpacity: (value: number) => Promise<void>
  setManagerUiSurfaceBorderOpacity: (value: number) => Promise<void>
  setManagerUiControlBgOpacity: (value: number) => Promise<void>
  setManagerUiControlBorderOpacity: (value: number) => Promise<void>
  setReaderPreloadAhead: (value: number) => Promise<void>
  setReaderSplitDefaultEnabled: (value: boolean) => Promise<void>
  setReaderWideRatioThreshold: (value: number) => Promise<void>
  setReaderToolbarAnimationMs: (value: number) => Promise<void>
  setReaderToolbarBackgroundOpacity: (value: number) => Promise<void>
  setReaderToolbarKeepStateOnPaging: (value: boolean) => Promise<void>
  setReaderToolbarCenterClickToggleEnabled: (value: boolean) => Promise<void>
  setReaderTapZones: (value: unknown) => Promise<void>
  setReaderImageMaxSidePx: (value: number) => Promise<void>
  setReaderImageMaxSidePresets: (value: unknown) => Promise<void>
  setReaderImageRenderFormat: (value: ReaderImageRenderFormat) => Promise<void>
  setReaderImageRenderQuality: (value: number) => Promise<void>
  setReaderImageRenderResample: (value: ReaderImageRenderResample) => Promise<void>
  setReaderImagePreloadConcurrency: (value: number) => Promise<void>
  setReaderUiBlurEnabled: (value: boolean) => Promise<void>
  setReaderUiBlurRadiusPx: (value: number) => Promise<void>
  setReaderUiControlBgOpacity: (value: number) => Promise<void>
  setReaderUiControlBorderOpacity: (value: number) => Promise<void>
  setRenameFilenameTemplate: (value: string) => Promise<void>
  setTasksHistoryLimit: (value: number) => Promise<void>
  setTasksHistoryRetentionDays: (value: number) => Promise<void>
  setTasksNotifyOnComplete: (value: boolean) => Promise<void>
  setTasksNotifyOnFail: (value: boolean) => Promise<void>
  setTasksBadgeEnabled: (value: boolean) => Promise<void>
}

const safeParseJson = <T,>(rawValue: unknown, fallback: T): T => {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return fallback
  }
  if (typeof rawValue === 'object') {
    return rawValue as T
  }
  try {
    return JSON.parse(String(rawValue))
  } catch (_error) {
    return fallback
  }
}

const clampInt = (value: unknown, { min = 1, max = 999999 }: { min?: number; max?: number } = {}) => {
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed)) {
    return null
  }
  return Math.min(max, Math.max(min, parsed))
}

const clampFloat = (value: unknown, { min = 0, max = 999999 }: { min?: number; max?: number } = {}) => {
  const parsed = Number.parseFloat(String(value))
  if (Number.isNaN(parsed)) {
    return null
  }
  return Math.min(max, Math.max(min, parsed))
}

const normalizeBool = (value: unknown) => {
  if (value === true || value === false) {
    return value
  }
  const raw = String(value ?? '').trim().toLowerCase()
  if (['1', 'true', 'yes', 'y', 'on'].includes(raw)) {
    return true
  }
  if (['0', 'false', 'no', 'n', 'off'].includes(raw)) {
    return false
  }
  return null
}

const normalizeLanguage = (value: unknown): Language => {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'en' ? 'en' : 'zh'
}

const normalizeViewMode = (value: unknown): LibraryViewMode => {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'list' ? 'list' : 'grid'
}

const normalizeReaderTapZones = (rawConfig: unknown): ReaderTapZonesConfig => {
  const fallback = DEFAULT_READER_TAP_ZONES
  if (!rawConfig || typeof rawConfig !== 'object') {
    return fallback
  }

  const raw = rawConfig as any

  const allowedActions = new Set(READER_TAP_ZONE_ACTIONS)
  const normalizeAction = (value: unknown, fallbackValue: ReaderTapZoneAction = 'none') => {
    const rawValue = String(value || '').trim().toLowerCase()
    return allowedActions.has(rawValue as ReaderTapZoneAction) ? (rawValue as ReaderTapZoneAction) : fallbackValue
  }

  const ensureSortedSplits = (splits: number[]) => {
    for (let i = 0; i < splits.length; i += 1) {
      if (i > 0 && splits[i] <= splits[i - 1]) return false
      if (splits[i] <= 0 || splits[i] >= 1) return false
    }
    return true
  }

  const validateMinSizes = (splits: number[], partCount: number) => {
    const minSizeRatio = Math.min(0.08, 0.8 / Math.max(1, partCount))
    const boundaries = [0, ...splits, 1]
    for (let i = 0; i < boundaries.length - 1; i += 1) {
      if (boundaries[i + 1] - boundaries[i] < minSizeRatio) return false
    }
    return true
  }

  const tryNormalizeV3 = (): ReaderTapZonesConfig | null => {
    const actionsRaw = raw.actions
    const xSplitsRaw = raw.xSplits
    const ySplitsRaw = raw.ySplits
    if (!Array.isArray(actionsRaw) || !Array.isArray(xSplitsRaw) || !Array.isArray(ySplitsRaw)) return null

    const colCount = xSplitsRaw.length + 1
    const rowCount = ySplitsRaw.length + 1
    const zoneCount = actionsRaw.length
    if (zoneCount < 2) return null
    if (zoneCount !== colCount * rowCount) return null

    const xSplits: number[] = []
    for (const item of xSplitsRaw) {
      const normalized = clampFloat(item, { min: 0, max: 1 })
      if (normalized === null) return null
      xSplits.push(normalized)
    }
    if (!ensureSortedSplits(xSplits)) return null
    if (!validateMinSizes(xSplits, colCount)) return null

    const ySplits: number[] = []
    for (const item of ySplitsRaw) {
      const normalized = clampFloat(item, { min: 0, max: 1 })
      if (normalized === null) return null
      ySplits.push(normalized)
    }
    if (!ensureSortedSplits(ySplits)) return null
    if (!validateMinSizes(ySplits, rowCount)) return null

    const actions = actionsRaw.map((item: unknown) => normalizeAction(item, 'none'))
    return { version: 3, xSplits, ySplits, actions }
  }

  const tryNormalizeLegacyV2 = (): ReaderTapZonesConfig | null => {
    const actionsRaw = raw.actions
    const splitsRaw = raw.splits
    if (!Array.isArray(actionsRaw) || !Array.isArray(splitsRaw)) return null

    const zoneCount = actionsRaw.length
    if (zoneCount < 2) return null
    if (splitsRaw.length !== zoneCount - 1) return null

    const xSplits: number[] = []
    for (const item of splitsRaw) {
      const normalized = clampFloat(item, { min: 0, max: 1 })
      if (normalized === null) return null
      xSplits.push(normalized)
    }
    if (!ensureSortedSplits(xSplits)) return null
    if (!validateMinSizes(xSplits, zoneCount)) return null

    const actions = actionsRaw.map((item: unknown) => normalizeAction(item, 'none'))
    return { version: 3, xSplits, ySplits: [], actions }
  }

  const tryNormalizeLegacyV1 = (): ReaderTapZonesConfig | null => {
    const boundariesRaw = raw.boundaries
    const actionsRaw = raw.actions
    if (!boundariesRaw || typeof boundariesRaw !== 'object' || !actionsRaw || typeof actionsRaw !== 'object') {
      return null
    }

    const minZoneWidth = 0.08
    const leftBoundary = clampFloat((boundariesRaw as any).left, { min: minZoneWidth, max: 1 - minZoneWidth })
    const rightBoundary = clampFloat((boundariesRaw as any).right, { min: minZoneWidth, max: 1 - minZoneWidth })
    if (leftBoundary === null || rightBoundary === null || leftBoundary >= rightBoundary) {
      return null
    }

    if (leftBoundary < minZoneWidth || 1 - rightBoundary < minZoneWidth || rightBoundary - leftBoundary < minZoneWidth) {
      return null
    }

    const xSplits = [leftBoundary, rightBoundary]
    const actions = [
      normalizeAction((actionsRaw as any).left, fallback.actions[0] ?? 'prev_page'),
      normalizeAction((actionsRaw as any).middle, fallback.actions[1] ?? 'toggle_toolbar'),
      normalizeAction((actionsRaw as any).right, fallback.actions[2] ?? 'next_page')
    ]
    return { version: 3, xSplits, ySplits: [], actions }
  }

  const normalizedV3 = tryNormalizeV3()
  if (normalizedV3) return normalizedV3

  const normalizedLegacyV2 = tryNormalizeLegacyV2()
  if (normalizedLegacyV2) return normalizedLegacyV2

  const normalizedLegacy = tryNormalizeLegacyV1()
  if (normalizedLegacy) return normalizedLegacy

  return fallback
}

const normalizeReaderImageRenderFormat = (value: unknown): ReaderImageRenderFormat => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'auto') return 'auto'
  if (raw === 'png') return 'png'
  if (raw === 'webp') return 'webp'
  if (raw === 'jpg' || raw === 'jpeg') return 'jpeg'
  return 'webp'
}

const normalizeReaderImageRenderResample = (value: unknown): ReaderImageRenderResample => {
  const raw = String(value ?? '').trim().toLowerCase()
  if (raw === 'nearest') return 'nearest'
  if (raw === 'bilinear') return 'bilinear'
  if (raw === 'bicubic') return 'bicubic'
  if (raw === 'lanczos') return 'lanczos'
  return 'lanczos'
}

const normalizeReaderImageMaxSidePresets = (rawValue: unknown): number[] => {
  let raw: unknown[] = []
  if (Array.isArray(rawValue)) {
    raw = rawValue
  } else if (typeof rawValue === 'string') {
    const text = rawValue.trim()
    if (text) {
      try {
        const parsed = JSON.parse(text)
        raw = Array.isArray(parsed) ? parsed : text.split(',')
      } catch (_error) {
        raw = text.split(',')
      }
    }
  }
  const unique = new Set<number>()
  unique.add(0)
  for (const item of raw) {
    const normalized = clampInt(item, { min: 0, max: 20000 })
    if (normalized === null) continue
    unique.add(normalized)
  }
  return Array.from(unique).sort((a, b) => a - b)
}

const defaults = Object.freeze({
  language: 'zh' as Language,
  libraryViewMode: 'grid' as LibraryViewMode,
  libraryPerPage: 20,
  libraryLazyRootMarginPx: 1200,
  managerUiBlurEnabled: true,
  managerUiBlurRadiusPx: 10,
  managerUiSurfaceBgOpacity: 0.72,
  managerUiSurfaceBorderOpacity: 0.14,
  managerUiControlBgOpacity: 0.6,
  managerUiControlBorderOpacity: 0.14,
  readerPreloadAhead: 2,
  readerSplitDefaultEnabled: false,
  readerWideRatioThreshold: 1.0,
  readerToolbarAnimationMs: 240,
  readerToolbarBackgroundOpacity: 0.28,
  readerToolbarKeepStateOnPaging: true,
  readerToolbarCenterClickToggleEnabled: true,
  readerTapZones: DEFAULT_READER_TAP_ZONES,
  readerImageMaxSidePx: 0,
  readerImageMaxSidePresets: [0, 1280, 1600, 2000, 2400],
  readerImageRenderFormat: 'webp' as ReaderImageRenderFormat,
  readerImageRenderQuality: 82,
  readerImageRenderResample: 'bilinear' as ReaderImageRenderResample,
  readerImagePreloadConcurrency: 2,
  readerUiBlurEnabled: true,
  readerUiBlurRadiusPx: 12,
  readerUiControlBgOpacity: 0.46,
  readerUiControlBorderOpacity: 0.16,
  renameFilenameTemplate: '',
  tasksHistoryLimit: 80,
  tasksHistoryRetentionDays: 30,
  tasksNotifyOnComplete: false,
  tasksNotifyOnFail: true,
  tasksBadgeEnabled: true
})

export const useAppSettingsStore = create<AppSettingsState>((set, get) => ({
  loaded: false,
  loading: false,
  lastError: '',

  language: defaults.language,
  libraryViewMode: defaults.libraryViewMode,
  libraryPerPage: defaults.libraryPerPage,
  libraryLazyRootMarginPx: defaults.libraryLazyRootMarginPx,

  managerUiBlurEnabled: defaults.managerUiBlurEnabled,
  managerUiBlurRadiusPx: defaults.managerUiBlurRadiusPx,
  managerUiSurfaceBgOpacity: defaults.managerUiSurfaceBgOpacity,
  managerUiSurfaceBorderOpacity: defaults.managerUiSurfaceBorderOpacity,
  managerUiControlBgOpacity: defaults.managerUiControlBgOpacity,
  managerUiControlBorderOpacity: defaults.managerUiControlBorderOpacity,

  readerPreloadAhead: defaults.readerPreloadAhead,
  readerSplitDefaultEnabled: defaults.readerSplitDefaultEnabled,
  readerWideRatioThreshold: defaults.readerWideRatioThreshold,
  readerToolbarAnimationMs: defaults.readerToolbarAnimationMs,
  readerToolbarBackgroundOpacity: defaults.readerToolbarBackgroundOpacity,
  readerToolbarKeepStateOnPaging: defaults.readerToolbarKeepStateOnPaging,
  readerToolbarCenterClickToggleEnabled: defaults.readerToolbarCenterClickToggleEnabled,
  readerTapZones: defaults.readerTapZones,
  readerImageMaxSidePx: defaults.readerImageMaxSidePx,
  readerImageMaxSidePresets: defaults.readerImageMaxSidePresets,
  readerImageRenderFormat: defaults.readerImageRenderFormat,
  readerImageRenderQuality: defaults.readerImageRenderQuality,
  readerImageRenderResample: defaults.readerImageRenderResample,
  readerImagePreloadConcurrency: defaults.readerImagePreloadConcurrency,
  readerUiBlurEnabled: defaults.readerUiBlurEnabled,
  readerUiBlurRadiusPx: defaults.readerUiBlurRadiusPx,
  readerUiControlBgOpacity: defaults.readerUiControlBgOpacity,
  readerUiControlBorderOpacity: defaults.readerUiControlBorderOpacity,

  renameFilenameTemplate: defaults.renameFilenameTemplate,

  tasksHistoryLimit: defaults.tasksHistoryLimit,
  tasksHistoryRetentionDays: defaults.tasksHistoryRetentionDays,
  tasksNotifyOnComplete: defaults.tasksNotifyOnComplete,
  tasksNotifyOnFail: defaults.tasksNotifyOnFail,
  tasksBadgeEnabled: defaults.tasksBadgeEnabled,

  ensureLoaded: async () => {
    const state = get()
    if (state.loaded || state.loading) {
      return
    }
    set({ loading: true, lastError: '' })
    try {
      const response = await http.get('/api/v1/settings')
      const settings = (response?.data ?? {}) as Record<string, unknown>

      const language = normalizeLanguage(settings[SETTINGS_KEYS.language])
      const libraryViewMode = normalizeViewMode(settings[SETTINGS_KEYS.libraryViewMode])
      const libraryPerPage = clampInt(settings[SETTINGS_KEYS.libraryPerPage], { min: 10, max: 500 }) ?? defaults.libraryPerPage
      const libraryLazyRootMarginPx =
        clampInt(settings[SETTINGS_KEYS.libraryLazyRootMarginPx], { min: 0, max: 20000 }) ?? defaults.libraryLazyRootMarginPx

      const managerUiBlurEnabled = normalizeBool(settings[SETTINGS_KEYS.managerUiBlurEnabled]) ?? defaults.managerUiBlurEnabled
      const managerUiBlurRadiusPx =
        clampInt(settings[SETTINGS_KEYS.managerUiBlurRadiusPx], { min: 0, max: 30 }) ?? defaults.managerUiBlurRadiusPx
      const managerUiSurfaceBgOpacity =
        clampFloat(settings[SETTINGS_KEYS.managerUiSurfaceBgOpacity], { min: 0.35, max: 0.95 }) ?? defaults.managerUiSurfaceBgOpacity
      const managerUiSurfaceBorderOpacity =
        clampFloat(settings[SETTINGS_KEYS.managerUiSurfaceBorderOpacity], { min: 0.06, max: 0.45 }) ?? defaults.managerUiSurfaceBorderOpacity
      const managerUiControlBgOpacity =
        clampFloat(settings[SETTINGS_KEYS.managerUiControlBgOpacity], { min: 0.18, max: 0.9 }) ?? defaults.managerUiControlBgOpacity
      const managerUiControlBorderOpacity =
        clampFloat(settings[SETTINGS_KEYS.managerUiControlBorderOpacity], { min: 0.06, max: 0.6 }) ?? defaults.managerUiControlBorderOpacity

      const readerPreloadAhead = clampInt(settings[SETTINGS_KEYS.readerPreloadAhead], { min: 0, max: 20 }) ?? defaults.readerPreloadAhead
      const readerSplitDefaultEnabled =
        normalizeBool(settings[SETTINGS_KEYS.readerSplitDefaultEnabled]) ?? defaults.readerSplitDefaultEnabled
      const readerWideRatioThreshold =
        clampFloat(settings[SETTINGS_KEYS.readerWideRatioThreshold], { min: 1, max: 5 }) ?? defaults.readerWideRatioThreshold
      const readerToolbarAnimationMs =
        clampInt(settings[SETTINGS_KEYS.readerToolbarAnimationMs], { min: 120, max: 600 }) ?? defaults.readerToolbarAnimationMs
      const readerToolbarBackgroundOpacity =
        clampFloat(settings[SETTINGS_KEYS.readerToolbarBackgroundOpacity], { min: 0.08, max: 0.8 }) ?? defaults.readerToolbarBackgroundOpacity
      const readerToolbarKeepStateOnPaging =
        normalizeBool(settings[SETTINGS_KEYS.readerToolbarKeepStateOnPaging]) ?? defaults.readerToolbarKeepStateOnPaging
      const readerToolbarCenterClickToggleEnabled =
        normalizeBool(settings[SETTINGS_KEYS.readerToolbarCenterClickToggleEnabled]) ?? defaults.readerToolbarCenterClickToggleEnabled

      const tapZonesRaw = safeParseJson(settings[SETTINGS_KEYS.readerTapZones], defaults.readerTapZones)
      const readerTapZones = normalizeReaderTapZones(tapZonesRaw)

      const readerImageMaxSidePx = clampInt(settings[SETTINGS_KEYS.readerImageMaxSidePx], { min: 0, max: 20000 }) ?? defaults.readerImageMaxSidePx
      const maxSidePresetsRaw = safeParseJson(settings[SETTINGS_KEYS.readerImageMaxSidePresets], defaults.readerImageMaxSidePresets)
      const readerImageMaxSidePresets = normalizeReaderImageMaxSidePresets(maxSidePresetsRaw)
      const readerImageRenderFormat = normalizeReaderImageRenderFormat(settings[SETTINGS_KEYS.readerImageRenderFormat] ?? defaults.readerImageRenderFormat)
      const readerImageRenderQuality =
        clampInt(settings[SETTINGS_KEYS.readerImageRenderQuality], { min: 1, max: 100 }) ?? defaults.readerImageRenderQuality
      const readerImageRenderResample = normalizeReaderImageRenderResample(settings[SETTINGS_KEYS.readerImageRenderResample] ?? defaults.readerImageRenderResample)
      const readerImagePreloadConcurrency =
        clampInt(settings[SETTINGS_KEYS.readerImagePreloadConcurrency], { min: 1, max: 6 }) ?? defaults.readerImagePreloadConcurrency

      const readerUiBlurEnabled = normalizeBool(settings[SETTINGS_KEYS.readerUiBlurEnabled]) ?? defaults.readerUiBlurEnabled
      const readerUiBlurRadiusPx = clampInt(settings[SETTINGS_KEYS.readerUiBlurRadiusPx], { min: 0, max: 30 }) ?? defaults.readerUiBlurRadiusPx
      const readerUiControlBgOpacity =
        clampFloat(settings[SETTINGS_KEYS.readerUiControlBgOpacity], { min: 0.12, max: 0.7 }) ?? defaults.readerUiControlBgOpacity
      const readerUiControlBorderOpacity =
        clampFloat(settings[SETTINGS_KEYS.readerUiControlBorderOpacity], { min: 0.06, max: 0.4 }) ?? defaults.readerUiControlBorderOpacity

      const renameFilenameTemplate = String(settings[SETTINGS_KEYS.renameFilenameTemplate] ?? defaults.renameFilenameTemplate)

      const tasksHistoryLimit = clampInt(settings[SETTINGS_KEYS.tasksHistoryLimit], { min: 10, max: 500 }) ?? defaults.tasksHistoryLimit
      const tasksHistoryRetentionDays =
        clampInt(settings[SETTINGS_KEYS.tasksHistoryRetentionDays], { min: 0, max: 3650 }) ?? defaults.tasksHistoryRetentionDays
      const tasksNotifyOnComplete = normalizeBool(settings[SETTINGS_KEYS.tasksNotifyOnComplete]) ?? defaults.tasksNotifyOnComplete
      const tasksNotifyOnFail = normalizeBool(settings[SETTINGS_KEYS.tasksNotifyOnFail]) ?? defaults.tasksNotifyOnFail
      const tasksBadgeEnabled = normalizeBool(settings[SETTINGS_KEYS.tasksBadgeEnabled]) ?? defaults.tasksBadgeEnabled

      set({
        loaded: true,
        language,
        libraryViewMode,
        libraryPerPage,
        libraryLazyRootMarginPx,
        managerUiBlurEnabled,
        managerUiBlurRadiusPx,
        managerUiSurfaceBgOpacity,
        managerUiSurfaceBorderOpacity,
        managerUiControlBgOpacity,
        managerUiControlBorderOpacity,
        readerPreloadAhead,
        readerSplitDefaultEnabled,
        readerWideRatioThreshold,
        readerToolbarAnimationMs,
        readerToolbarBackgroundOpacity,
        readerToolbarKeepStateOnPaging,
        readerToolbarCenterClickToggleEnabled,
        readerTapZones,
        readerImageMaxSidePx,
        readerImageMaxSidePresets,
        readerImageRenderFormat,
        readerImageRenderQuality,
        readerImageRenderResample,
        readerImagePreloadConcurrency,
        readerUiBlurEnabled,
        readerUiBlurRadiusPx,
        readerUiControlBgOpacity,
        readerUiControlBorderOpacity,
        renameFilenameTemplate,
        tasksHistoryLimit,
        tasksHistoryRetentionDays,
        tasksNotifyOnComplete,
        tasksNotifyOnFail,
        tasksBadgeEnabled
      })
    } catch (error) {
      const message = (error as any)?.response?.data?.error || '加载设置失败'
      set({ lastError: String(message) })
    } finally {
      set({ loading: false })
    }
  },

  saveSetting: async (key: string, value: string) => {
    await http.put(`/api/v1/settings/${key}`, { value })
  },

  resetSetting: async (key: string) => {
    await http.delete(`/api/v1/settings/${key}`)
  },

  setLanguage: async (language: Language) => {
    set({ language })
    await get().saveSetting(SETTINGS_KEYS.language, language)
  },

  setLibraryViewMode: async (mode: LibraryViewMode) => {
    set({ libraryViewMode: mode })
    await get().saveSetting(SETTINGS_KEYS.libraryViewMode, mode)
  },

  setLibraryPerPage: async (value: number) => {
    const normalized = clampInt(value, { min: 10, max: 500 })
    if (normalized === null) {
      return
    }
    set({ libraryPerPage: normalized })
    await get().saveSetting(SETTINGS_KEYS.libraryPerPage, String(normalized))
  },

  setLibraryLazyRootMarginPx: async (value: number) => {
    const normalized = clampInt(value, { min: 0, max: 20000 })
    if (normalized === null) {
      return
    }
    set({ libraryLazyRootMarginPx: normalized })
    await get().saveSetting(SETTINGS_KEYS.libraryLazyRootMarginPx, String(normalized))
  },

  setManagerUiBlurEnabled: async (value: boolean) => {
    const normalized = normalizeBool(value)
    if (normalized === null) {
      return
    }
    set({ managerUiBlurEnabled: normalized })
    await get().saveSetting(SETTINGS_KEYS.managerUiBlurEnabled, normalized ? '1' : '0')
  },

  setManagerUiBlurRadiusPx: async (value: number) => {
    const normalized = clampInt(value, { min: 0, max: 30 })
    if (normalized === null) {
      return
    }
    set({ managerUiBlurRadiusPx: normalized })
    await get().saveSetting(SETTINGS_KEYS.managerUiBlurRadiusPx, String(normalized))
  },

  setManagerUiSurfaceBgOpacity: async (value: number) => {
    const normalized = clampFloat(value, { min: 0.35, max: 0.95 })
    if (normalized === null) {
      return
    }
    set({ managerUiSurfaceBgOpacity: normalized })
    await get().saveSetting(SETTINGS_KEYS.managerUiSurfaceBgOpacity, String(normalized))
  },

  setManagerUiSurfaceBorderOpacity: async (value: number) => {
    const normalized = clampFloat(value, { min: 0.06, max: 0.45 })
    if (normalized === null) {
      return
    }
    set({ managerUiSurfaceBorderOpacity: normalized })
    await get().saveSetting(SETTINGS_KEYS.managerUiSurfaceBorderOpacity, String(normalized))
  },

  setManagerUiControlBgOpacity: async (value: number) => {
    const normalized = clampFloat(value, { min: 0.18, max: 0.9 })
    if (normalized === null) {
      return
    }
    set({ managerUiControlBgOpacity: normalized })
    await get().saveSetting(SETTINGS_KEYS.managerUiControlBgOpacity, String(normalized))
  },

  setManagerUiControlBorderOpacity: async (value: number) => {
    const normalized = clampFloat(value, { min: 0.06, max: 0.6 })
    if (normalized === null) {
      return
    }
    set({ managerUiControlBorderOpacity: normalized })
    await get().saveSetting(SETTINGS_KEYS.managerUiControlBorderOpacity, String(normalized))
  },

  setReaderPreloadAhead: async (value: number) => {
    const normalized = clampInt(value, { min: 0, max: 20 })
    if (normalized === null) {
      return
    }
    set({ readerPreloadAhead: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerPreloadAhead, String(normalized))
  },

  setReaderSplitDefaultEnabled: async (value: boolean) => {
    const normalized = normalizeBool(value)
    if (normalized === null) {
      return
    }
    set({ readerSplitDefaultEnabled: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerSplitDefaultEnabled, normalized ? '1' : '0')
  },

  setReaderWideRatioThreshold: async (value: number) => {
    const normalized = clampFloat(value, { min: 1, max: 5 })
    if (normalized === null) {
      return
    }
    set({ readerWideRatioThreshold: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerWideRatioThreshold, String(normalized))
  },

  setReaderToolbarAnimationMs: async (value: number) => {
    const normalized = clampInt(value, { min: 120, max: 600 })
    if (normalized === null) {
      return
    }
    set({ readerToolbarAnimationMs: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerToolbarAnimationMs, String(normalized))
  },

  setReaderToolbarBackgroundOpacity: async (value: number) => {
    const normalized = clampFloat(value, { min: 0.08, max: 0.8 })
    if (normalized === null) {
      return
    }
    set({ readerToolbarBackgroundOpacity: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerToolbarBackgroundOpacity, String(normalized))
  },

  setReaderToolbarKeepStateOnPaging: async (value: boolean) => {
    const normalized = normalizeBool(value)
    if (normalized === null) {
      return
    }
    set({ readerToolbarKeepStateOnPaging: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerToolbarKeepStateOnPaging, normalized ? '1' : '0')
  },

  setReaderToolbarCenterClickToggleEnabled: async (value: boolean) => {
    const normalized = normalizeBool(value)
    if (normalized === null) {
      return
    }
    set({ readerToolbarCenterClickToggleEnabled: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerToolbarCenterClickToggleEnabled, normalized ? '1' : '0')
  },

  setReaderTapZones: async (value: unknown) => {
    const normalized = normalizeReaderTapZones(value)
    set({ readerTapZones: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerTapZones, JSON.stringify(normalized))
  },

  setReaderImageMaxSidePx: async (value: number) => {
    const normalized = clampInt(value, { min: 0, max: 20000 })
    if (normalized === null) {
      return
    }
    set({ readerImageMaxSidePx: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerImageMaxSidePx, String(normalized))
  },

  setReaderImageMaxSidePresets: async (value: unknown) => {
    const normalized = normalizeReaderImageMaxSidePresets(value)
    set({ readerImageMaxSidePresets: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerImageMaxSidePresets, JSON.stringify(normalized))
  },

  setReaderImageRenderFormat: async (value: ReaderImageRenderFormat) => {
    const normalized = normalizeReaderImageRenderFormat(value)
    set({ readerImageRenderFormat: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerImageRenderFormat, normalized)
  },

  setReaderImageRenderQuality: async (value: number) => {
    const normalized = clampInt(value, { min: 1, max: 100 })
    if (normalized === null) {
      return
    }
    set({ readerImageRenderQuality: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerImageRenderQuality, String(normalized))
  },

  setReaderImageRenderResample: async (value: ReaderImageRenderResample) => {
    const normalized = normalizeReaderImageRenderResample(value)
    set({ readerImageRenderResample: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerImageRenderResample, normalized)
  },

  setReaderImagePreloadConcurrency: async (value: number) => {
    const normalized = clampInt(value, { min: 1, max: 6 })
    if (normalized === null) {
      return
    }
    set({ readerImagePreloadConcurrency: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerImagePreloadConcurrency, String(normalized))
  },

  setReaderUiBlurEnabled: async (value: boolean) => {
    const normalized = normalizeBool(value)
    if (normalized === null) {
      return
    }
    set({ readerUiBlurEnabled: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerUiBlurEnabled, normalized ? '1' : '0')
  },

  setReaderUiBlurRadiusPx: async (value: number) => {
    const normalized = clampInt(value, { min: 0, max: 30 })
    if (normalized === null) {
      return
    }
    set({ readerUiBlurRadiusPx: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerUiBlurRadiusPx, String(normalized))
  },

  setReaderUiControlBgOpacity: async (value: number) => {
    const normalized = clampFloat(value, { min: 0.12, max: 0.7 })
    if (normalized === null) {
      return
    }
    set({ readerUiControlBgOpacity: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerUiControlBgOpacity, String(normalized))
  },

  setReaderUiControlBorderOpacity: async (value: number) => {
    const normalized = clampFloat(value, { min: 0.06, max: 0.4 })
    if (normalized === null) {
      return
    }
    set({ readerUiControlBorderOpacity: normalized })
    await get().saveSetting(SETTINGS_KEYS.readerUiControlBorderOpacity, String(normalized))
  },

  setRenameFilenameTemplate: async (value: string) => {
    const normalized = String(value ?? '')
    set({ renameFilenameTemplate: normalized })
    await get().saveSetting(SETTINGS_KEYS.renameFilenameTemplate, normalized)
  },

  setTasksHistoryLimit: async (value: number) => {
    const normalized = clampInt(value, { min: 10, max: 500 })
    if (normalized === null) {
      return
    }
    set({ tasksHistoryLimit: normalized })
    await get().saveSetting(SETTINGS_KEYS.tasksHistoryLimit, String(normalized))
  },

  setTasksHistoryRetentionDays: async (value: number) => {
    const normalized = clampInt(value, { min: 0, max: 3650 })
    if (normalized === null) {
      return
    }
    set({ tasksHistoryRetentionDays: normalized })
    await get().saveSetting(SETTINGS_KEYS.tasksHistoryRetentionDays, String(normalized))
  },

  setTasksNotifyOnComplete: async (value: boolean) => {
    const normalized = normalizeBool(value)
    if (normalized === null) {
      return
    }
    set({ tasksNotifyOnComplete: normalized })
    await get().saveSetting(SETTINGS_KEYS.tasksNotifyOnComplete, normalized ? '1' : '0')
  },

  setTasksNotifyOnFail: async (value: boolean) => {
    const normalized = normalizeBool(value)
    if (normalized === null) {
      return
    }
    set({ tasksNotifyOnFail: normalized })
    await get().saveSetting(SETTINGS_KEYS.tasksNotifyOnFail, normalized ? '1' : '0')
  },

  setTasksBadgeEnabled: async (value: boolean) => {
    const normalized = normalizeBool(value)
    if (normalized === null) {
      return
    }
    set({ tasksBadgeEnabled: normalized })
    await get().saveSetting(SETTINGS_KEYS.tasksBadgeEnabled, normalized ? '1' : '0')
  }
}))
