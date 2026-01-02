import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import axios from 'axios'

const SETTINGS_KEYS = Object.freeze({
  language: 'ui.language',
  libraryViewMode: 'ui.library.view_mode',
  libraryPerPage: 'ui.library.pagination.per_page',
  libraryLazyRootMarginPx: 'ui.library.lazy_load.root_margin_px',
  readerPreloadAhead: 'ui.reader.preload_ahead',
  readerSplitDefaultEnabled: 'ui.reader.split_view.default_enabled',
  readerWideRatioThreshold: 'ui.reader.wide_ratio_threshold',
  readerToolbarAnimationMs: 'ui.reader.toolbar.animation_ms',
  readerToolbarBackgroundOpacity: 'ui.reader.toolbar.background_opacity',
  readerToolbarCenterClickToggleEnabled: 'ui.reader.toolbar.center_click_toggle_enabled',
  readerUiBlurEnabled: 'ui.reader.ui.blur_enabled',
  readerUiBlurRadiusPx: 'ui.reader.ui.blur_radius_px',
  readerUiControlBgOpacity: 'ui.reader.ui.control_bg_opacity',
  readerUiControlBorderOpacity: 'ui.reader.ui.control_border_opacity',
  renameFilenameTemplate: 'rename.filename_template'
})

const MIGRATION_FLAG_KEY = 'manga-ulm.settings_migrated.v1'

const clampInt = (value, { min = 1, max = 999999 } = {}) => {
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed)) {
    return null
  }
  return Math.min(max, Math.max(min, parsed))
}

const clampFloat = (value, { min = 0, max = 999999 } = {}) => {
  const parsed = Number.parseFloat(String(value))
  if (Number.isNaN(parsed)) {
    return null
  }
  return Math.min(max, Math.max(min, parsed))
}

const normalizeBool = (value) => {
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

const normalizeLanguage = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'en' ? 'en' : 'zh'
}

const normalizeViewMode = (value) => {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'list' ? 'list' : 'grid'
}

export const useAppSettingsStore = defineStore('appSettings', () => {
  const loaded = ref(false)
  const loading = ref(false)
  const lastError = ref('')

  const language = ref('zh')
  const libraryViewMode = ref('grid')
  const libraryPerPage = ref(50)
  const libraryLazyRootMarginPx = ref(600)
  const readerPreloadAhead = ref(2)
  const readerSplitDefaultEnabled = ref(false)
  const readerWideRatioThreshold = ref(1.0)
  const readerToolbarAnimationMs = ref(240)
  const readerToolbarBackgroundOpacity = ref(0.28)
  const readerToolbarCenterClickToggleEnabled = ref(true)
  const readerUiBlurEnabled = ref(true)
  const readerUiBlurRadiusPx = ref(12)
  const readerUiControlBgOpacity = ref(0.46)
  const readerUiControlBorderOpacity = ref(0.16)
  const renameFilenameTemplate = ref('')

  const saveSetting = async (key, value) => {
    await axios.post(`/api/v1/settings/${key}`, { value })
  }

  const resetSetting = async (key) => {
    await axios.delete(`/api/v1/settings/${key}`)
  }

  const ensureLoaded = async () => {
    if (loaded.value || loading.value) {
      return
    }
    loading.value = true
    lastError.value = ''

    try {
      const response = await axios.get('/api/v1/settings')
      const settings = response.data || {}

      const shouldMigrate = typeof window !== 'undefined' && !localStorage.getItem(MIGRATION_FLAG_KEY)
      if (shouldMigrate) {
        const legacyLang = localStorage.getItem('lang')
        const legacyViewMode = localStorage.getItem('libraryViewMode')
        const legacyTemplate = localStorage.getItem('mangaFilenameTemplate')

        const ops = []
        if (legacyLang) {
          ops.push(saveSetting(SETTINGS_KEYS.language, normalizeLanguage(legacyLang)))
        }
        if (legacyViewMode) {
          ops.push(saveSetting(SETTINGS_KEYS.libraryViewMode, normalizeViewMode(legacyViewMode)))
        }
        if (legacyTemplate) {
          ops.push(saveSetting(SETTINGS_KEYS.renameFilenameTemplate, String(legacyTemplate)))
        }

        if (ops.length) {
          await Promise.allSettled(ops)
        }
        localStorage.setItem(MIGRATION_FLAG_KEY, '1')
      }

      language.value = normalizeLanguage(settings[SETTINGS_KEYS.language])
      libraryViewMode.value = normalizeViewMode(settings[SETTINGS_KEYS.libraryViewMode])

      const perPage = clampInt(settings[SETTINGS_KEYS.libraryPerPage], { min: 1, max: 200 })
      libraryPerPage.value = perPage ?? 50

      const rootMargin = clampInt(settings[SETTINGS_KEYS.libraryLazyRootMarginPx], { min: 0, max: 5000 })
      libraryLazyRootMarginPx.value = rootMargin ?? 600

      const preloadAhead = clampInt(settings[SETTINGS_KEYS.readerPreloadAhead], { min: 0, max: 20 })
      readerPreloadAhead.value = preloadAhead ?? 2

      const splitDefault = normalizeBool(settings[SETTINGS_KEYS.readerSplitDefaultEnabled])
      readerSplitDefaultEnabled.value = splitDefault ?? false

      const wideRatio = clampFloat(settings[SETTINGS_KEYS.readerWideRatioThreshold], { min: 1.0, max: 5.0 })
      readerWideRatioThreshold.value = wideRatio ?? 1.0

      const toolbarAnimMs = clampInt(settings[SETTINGS_KEYS.readerToolbarAnimationMs], { min: 120, max: 600 })
      readerToolbarAnimationMs.value = toolbarAnimMs ?? 240

      const toolbarBgOpacity = clampFloat(settings[SETTINGS_KEYS.readerToolbarBackgroundOpacity], { min: 0.08, max: 0.8 })
      readerToolbarBackgroundOpacity.value = toolbarBgOpacity ?? 0.28

      const centerClickToggle = normalizeBool(settings[SETTINGS_KEYS.readerToolbarCenterClickToggleEnabled])
      readerToolbarCenterClickToggleEnabled.value = centerClickToggle ?? true

      const uiBlurEnabled = normalizeBool(settings[SETTINGS_KEYS.readerUiBlurEnabled])
      readerUiBlurEnabled.value = uiBlurEnabled ?? true

      const uiBlurRadius = clampInt(settings[SETTINGS_KEYS.readerUiBlurRadiusPx], { min: 0, max: 30 })
      readerUiBlurRadiusPx.value = uiBlurRadius ?? 12

      const uiBgOpacity = clampFloat(settings[SETTINGS_KEYS.readerUiControlBgOpacity], { min: 0.12, max: 0.7 })
      readerUiControlBgOpacity.value = uiBgOpacity ?? 0.46

      const uiBorderOpacity = clampFloat(settings[SETTINGS_KEYS.readerUiControlBorderOpacity], { min: 0.06, max: 0.4 })
      readerUiControlBorderOpacity.value = uiBorderOpacity ?? 0.16

      renameFilenameTemplate.value = String(settings[SETTINGS_KEYS.renameFilenameTemplate] ?? '')

      loaded.value = true
    } catch (error) {
      lastError.value = error?.response?.data?.error || '加载设置失败'
    } finally {
      loading.value = false
    }
  }

  const setLanguage = async (nextLang) => {
    const normalized = normalizeLanguage(nextLang)
    language.value = normalized
    await saveSetting(SETTINGS_KEYS.language, normalized)
  }

  const setLibraryViewMode = async (nextMode) => {
    const normalized = normalizeViewMode(nextMode)
    libraryViewMode.value = normalized
    await saveSetting(SETTINGS_KEYS.libraryViewMode, normalized)
  }

  const setLibraryPerPage = async (value) => {
    const normalized = clampInt(value, { min: 1, max: 200 })
    if (normalized === null) {
      return
    }
    libraryPerPage.value = normalized
    await saveSetting(SETTINGS_KEYS.libraryPerPage, String(normalized))
  }

  const setLibraryLazyRootMarginPx = async (value) => {
    const normalized = clampInt(value, { min: 0, max: 5000 })
    if (normalized === null) {
      return
    }
    libraryLazyRootMarginPx.value = normalized
    await saveSetting(SETTINGS_KEYS.libraryLazyRootMarginPx, String(normalized))
  }

  const setReaderPreloadAhead = async (value) => {
    const normalized = clampInt(value, { min: 0, max: 20 })
    if (normalized === null) {
      return
    }
    readerPreloadAhead.value = normalized
    await saveSetting(SETTINGS_KEYS.readerPreloadAhead, String(normalized))
  }

  const setReaderSplitDefaultEnabled = async (value) => {
    const normalized = normalizeBool(value)
    if (normalized === null) {
      return
    }
    readerSplitDefaultEnabled.value = normalized
    await saveSetting(SETTINGS_KEYS.readerSplitDefaultEnabled, normalized ? '1' : '0')
  }

  const setReaderWideRatioThreshold = async (value) => {
    const normalized = clampFloat(value, { min: 1.0, max: 5.0 })
    if (normalized === null) {
      return
    }
    readerWideRatioThreshold.value = normalized
    await saveSetting(SETTINGS_KEYS.readerWideRatioThreshold, String(normalized))
  }

  const setReaderToolbarAnimationMs = async (value) => {
    const normalized = clampInt(value, { min: 120, max: 600 })
    if (normalized === null) {
      return
    }
    readerToolbarAnimationMs.value = normalized
    await saveSetting(SETTINGS_KEYS.readerToolbarAnimationMs, String(normalized))
  }

  const setReaderToolbarBackgroundOpacity = async (value) => {
    const normalized = clampFloat(value, { min: 0.08, max: 0.8 })
    if (normalized === null) {
      return
    }
    readerToolbarBackgroundOpacity.value = normalized
    await saveSetting(SETTINGS_KEYS.readerToolbarBackgroundOpacity, String(normalized))
  }

  const setReaderToolbarCenterClickToggleEnabled = async (value) => {
    const normalized = normalizeBool(value)
    if (normalized === null) {
      return
    }
    readerToolbarCenterClickToggleEnabled.value = normalized
    await saveSetting(SETTINGS_KEYS.readerToolbarCenterClickToggleEnabled, normalized ? '1' : '0')
  }

  const setReaderUiBlurEnabled = async (value) => {
    const normalized = normalizeBool(value)
    if (normalized === null) {
      return
    }
    readerUiBlurEnabled.value = normalized
    await saveSetting(SETTINGS_KEYS.readerUiBlurEnabled, normalized ? '1' : '0')
  }

  const setReaderUiBlurRadiusPx = async (value) => {
    const normalized = clampInt(value, { min: 0, max: 30 })
    if (normalized === null) {
      return
    }
    readerUiBlurRadiusPx.value = normalized
    await saveSetting(SETTINGS_KEYS.readerUiBlurRadiusPx, String(normalized))
  }

  const setReaderUiControlBgOpacity = async (value) => {
    const normalized = clampFloat(value, { min: 0.12, max: 0.7 })
    if (normalized === null) {
      return
    }
    readerUiControlBgOpacity.value = normalized
    await saveSetting(SETTINGS_KEYS.readerUiControlBgOpacity, String(normalized))
  }

  const setReaderUiControlBorderOpacity = async (value) => {
    const normalized = clampFloat(value, { min: 0.06, max: 0.4 })
    if (normalized === null) {
      return
    }
    readerUiControlBorderOpacity.value = normalized
    await saveSetting(SETTINGS_KEYS.readerUiControlBorderOpacity, String(normalized))
  }

  const setRenameFilenameTemplate = async (value) => {
    renameFilenameTemplate.value = String(value ?? '')
    await saveSetting(SETTINGS_KEYS.renameFilenameTemplate, renameFilenameTemplate.value)
  }

  const busy = computed(() => loading.value)

  return {
    loaded,
    loading,
    busy,
    lastError,
    language,
    libraryViewMode,
    libraryPerPage,
    libraryLazyRootMarginPx,
    readerPreloadAhead,
    readerSplitDefaultEnabled,
    readerWideRatioThreshold,
    readerToolbarAnimationMs,
    readerToolbarBackgroundOpacity,
    readerToolbarCenterClickToggleEnabled,
    readerUiBlurEnabled,
    readerUiBlurRadiusPx,
    readerUiControlBgOpacity,
    readerUiControlBorderOpacity,
    renameFilenameTemplate,
    ensureLoaded,
    setLanguage,
    setLibraryViewMode,
    setLibraryPerPage,
    setLibraryLazyRootMarginPx,
    setReaderPreloadAhead,
    setReaderSplitDefaultEnabled,
    setReaderWideRatioThreshold,
    setReaderToolbarAnimationMs,
    setReaderToolbarBackgroundOpacity,
    setReaderToolbarCenterClickToggleEnabled,
    setReaderUiBlurEnabled,
    setReaderUiBlurRadiusPx,
    setReaderUiControlBgOpacity,
    setReaderUiControlBorderOpacity,
    setRenameFilenameTemplate,
    saveSetting,
    resetSetting
  }
})
