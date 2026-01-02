import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import axios from 'axios'

export const DEFAULT_LIBRARY_GRID_COLUMNS = Object.freeze({
  base: 2,
  sm: 3,
  md: 4,
  lg: 5,
  xl: 6,
  '2xl': 8
})

export const LIBRARY_CARD_FIELD_DEFS = Object.freeze([
  { key: 'file_size', labelKey: 'libraryFieldFileSize' },
  { key: 'total_pages', labelKey: 'libraryFieldTotalPages' },
  { key: 'last_read_date', labelKey: 'libraryFieldLastReadAt' },
  { key: 'add_date', labelKey: 'libraryFieldAddedAt' },
  { key: 'liked_at', labelKey: 'libraryFieldLikedAt' },
  { key: 'progress_percent', labelKey: 'libraryFieldProgressPercent' },
  { key: 'progress_bar', labelKey: 'libraryFieldProgressBar' },
  { key: 'progress_summary', labelKey: 'libraryFieldProgressSummary' },
  { key: 'authors', labelKey: 'libraryFieldAuthors' },
  { key: 'folder_name', labelKey: 'libraryFieldFolderName' }
])

export const DEFAULT_LIBRARY_CARD_FIELDS = Object.freeze({
  grid: Object.freeze([
    'file_size',
    'progress_percent',
    'progress_bar',
    'progress_summary',
    'total_pages',
    'last_read_date'
  ]),
  list: Object.freeze([
    'total_pages',
    'file_size',
    'last_read_date'
  ])
})

const SETTINGS_KEYS = Object.freeze({
  gridColumns: 'ui.library.grid.columns',
  cardFields: 'ui.library.card.fields',
  authorTagTypeId: 'ui.library.card.author_tag_type_id'
})

const safeParseJson = (rawValue, fallback) => {
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return fallback
  }
  if (typeof rawValue === 'object') {
    return rawValue
  }
  try {
    return JSON.parse(String(rawValue))
  } catch (_error) {
    return fallback
  }
}

const clampInt = (value, { min = 1, max = 24 } = {}) => {
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed)) {
    return null
  }
  return Math.min(max, Math.max(min, parsed))
}

const normalizeGridColumns = (rawColumns) => {
  const fallback = DEFAULT_LIBRARY_GRID_COLUMNS
  if (!rawColumns || typeof rawColumns !== 'object') {
    return fallback
  }

  const normalized = { ...fallback }
  for (const key of Object.keys(fallback)) {
    const nextValue = clampInt(rawColumns[key])
    if (nextValue !== null) {
      normalized[key] = nextValue
    }
  }
  return normalized
}

const normalizeCardFields = (rawFields) => {
  const fallback = DEFAULT_LIBRARY_CARD_FIELDS
  const allowed = new Set(LIBRARY_CARD_FIELD_DEFS.map(item => item.key))

  if (!rawFields || typeof rawFields !== 'object') {
    return fallback
  }

  const normalizeList = (value, fallbackList) => {
    if (!Array.isArray(value)) {
      return [...fallbackList]
    }
    return value
      .map(item => String(item))
      .filter(item => allowed.has(item))
  }

  return {
    grid: normalizeList(rawFields.grid, fallback.grid),
    list: normalizeList(rawFields.list, fallback.list)
  }
}

export const useUiSettingsStore = defineStore('uiSettings', () => {
  const loaded = ref(false)
  const loading = ref(false)
  const lastError = ref('')

  const libraryGridColumns = ref({ ...DEFAULT_LIBRARY_GRID_COLUMNS })
  const libraryCardFields = ref({ ...DEFAULT_LIBRARY_CARD_FIELDS })
  const libraryAuthorTagTypeId = ref(null)

  const ensureLoaded = async () => {
    if (loaded.value || loading.value) {
      return
    }
    loading.value = true
    lastError.value = ''
    try {
      const response = await axios.get('/api/v1/settings')
      const settings = response.data || {}

      const rawColumns = safeParseJson(settings[SETTINGS_KEYS.gridColumns], DEFAULT_LIBRARY_GRID_COLUMNS)
      libraryGridColumns.value = normalizeGridColumns(rawColumns)

      const rawFields = safeParseJson(settings[SETTINGS_KEYS.cardFields], DEFAULT_LIBRARY_CARD_FIELDS)
      libraryCardFields.value = normalizeCardFields(rawFields)

      const rawAuthorTypeId = settings[SETTINGS_KEYS.authorTagTypeId]
      const normalizedAuthorTypeId = clampInt(rawAuthorTypeId, { min: 1, max: 2147483647 })
      libraryAuthorTagTypeId.value = normalizedAuthorTypeId
      loaded.value = true
    } catch (error) {
      lastError.value = error?.response?.data?.error || '加载设置失败'
    } finally {
      loading.value = false
    }
  }

  const saveLibraryDisplaySettings = async ({ gridColumns, cardFields, authorTagTypeId } = {}) => {
    const ops = []

    if (gridColumns) {
      const normalized = normalizeGridColumns(gridColumns)
      ops.push(
        axios.post(`/api/v1/settings/${SETTINGS_KEYS.gridColumns}`, {
          value: JSON.stringify(normalized)
        })
      )
    }

    if (cardFields) {
      const normalized = normalizeCardFields(cardFields)
      ops.push(
        axios.post(`/api/v1/settings/${SETTINGS_KEYS.cardFields}`, {
          value: JSON.stringify(normalized)
        })
      )
    }

    if (authorTagTypeId !== undefined) {
      const normalized = clampInt(authorTagTypeId, { min: 1, max: 2147483647 })
      ops.push(
        axios.post(`/api/v1/settings/${SETTINGS_KEYS.authorTagTypeId}`, {
          value: normalized ? String(normalized) : ''
        })
      )
    }

    await Promise.all(ops)
    loaded.value = false
    await ensureLoaded()
  }

  const resetLibraryDisplaySettings = async () => {
    await saveLibraryDisplaySettings({
      gridColumns: DEFAULT_LIBRARY_GRID_COLUMNS,
      cardFields: DEFAULT_LIBRARY_CARD_FIELDS,
      authorTagTypeId: null
    })
  }

  const fieldsForViewMode = computed(() => (mode) => {
    const resolved = libraryCardFields.value || DEFAULT_LIBRARY_CARD_FIELDS
    if (mode === 'list') {
      return resolved.list || DEFAULT_LIBRARY_CARD_FIELDS.list
    }
    return resolved.grid || DEFAULT_LIBRARY_CARD_FIELDS.grid
  })

  return {
    loaded,
    loading,
    lastError,
    libraryGridColumns,
    libraryCardFields,
    libraryAuthorTagTypeId,
    ensureLoaded,
    saveLibraryDisplaySettings,
    resetLibraryDisplaySettings,
    fieldsForViewMode
  }
})

