import { create } from 'zustand'
import { http } from '@/api/http'

export const DEFAULT_LIBRARY_GRID_COLUMNS = Object.freeze({
  base: 2,
  sm: 3,
  md: 4,
  lg: 5,
  xl: 6,
  '2xl': 8
})

export const LIBRARY_CARD_FIELD_DEFS = Object.freeze([
  { key: 'reading_status_tag', labelKey: 'libraryFieldReadingStatusTag' },
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
] as const)

export type LibraryCardFieldKey = (typeof LIBRARY_CARD_FIELD_DEFS)[number]['key']

export const DEFAULT_LIBRARY_CARD_FIELDS = Object.freeze({
  grid: Object.freeze([
    'reading_status_tag',
    'file_size',
    'progress_percent',
    'progress_bar',
    'progress_summary',
    'total_pages',
    'last_read_date'
  ] as const),
  list: Object.freeze(['reading_status_tag', 'total_pages', 'file_size', 'last_read_date'] as const)
}) satisfies Readonly<{ grid: readonly LibraryCardFieldKey[]; list: readonly LibraryCardFieldKey[] }>

const SETTINGS_KEYS = Object.freeze({
  gridColumns: 'ui.library.grid.columns',
  cardFields: 'ui.library.card.fields',
  authorTagTypeId: 'ui.library.card.author_tag_type_id'
})

export type LibraryGridColumns = {
  base: number
  sm: number
  md: number
  lg: number
  xl: number
  '2xl': number
}

export type LibraryCardFields = {
  grid: LibraryCardFieldKey[]
  list: LibraryCardFieldKey[]
}

export type UiSettingsState = {
  loaded: boolean
  loading: boolean
  lastError: string

  libraryGridColumns: LibraryGridColumns
  libraryCardFields: LibraryCardFields
  libraryAuthorTagTypeId: number | null

  ensureLoaded: () => Promise<void>
  saveLibraryDisplaySettings: (payload?: {
    gridColumns?: Partial<LibraryGridColumns> | null
    cardFields?: Partial<LibraryCardFields> | null
    authorTagTypeId?: number | null
  }) => Promise<void>
  resetLibraryDisplaySettings: () => Promise<void>
  fieldsForViewMode: (mode: 'grid' | 'list') => LibraryCardFieldKey[]
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

const clampInt = (value: unknown, { min = 1, max = 24 }: { min?: number; max?: number } = {}) => {
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed)) {
    return null
  }
  return Math.min(max, Math.max(min, parsed))
}

const normalizeGridColumns = (rawColumns: unknown): LibraryGridColumns => {
  const fallback = DEFAULT_LIBRARY_GRID_COLUMNS
  if (!rawColumns || typeof rawColumns !== 'object') {
    return { ...fallback }
  }

  const normalized: Record<string, number> = { ...fallback }
  for (const key of Object.keys(fallback)) {
    const nextValue = clampInt((rawColumns as any)[key])
    if (nextValue !== null) {
      normalized[key] = nextValue
    }
  }

  return normalized as LibraryGridColumns
}

const normalizeCardFields = (rawFields: unknown): LibraryCardFields => {
  const fallback = DEFAULT_LIBRARY_CARD_FIELDS
  const allowed = new Set<LibraryCardFieldKey>(LIBRARY_CARD_FIELD_DEFS.map((item) => item.key))

  if (!rawFields || typeof rawFields !== 'object') {
    return { grid: [...fallback.grid], list: [...fallback.list] }
  }

  const normalizeList = (value: unknown, fallbackList: readonly LibraryCardFieldKey[]) => {
    if (!Array.isArray(value)) {
      return [...fallbackList]
    }
    return value
      .map((item) => String(item) as LibraryCardFieldKey)
      .filter((item) => allowed.has(item))
  }

  return {
    grid: normalizeList((rawFields as any).grid, fallback.grid),
    list: normalizeList((rawFields as any).list, fallback.list)
  }
}

export const useUiSettingsStore = create<UiSettingsState>((set, get) => ({
  loaded: false,
  loading: false,
  lastError: '',

  libraryGridColumns: { ...DEFAULT_LIBRARY_GRID_COLUMNS },
  libraryCardFields: { grid: [...DEFAULT_LIBRARY_CARD_FIELDS.grid], list: [...DEFAULT_LIBRARY_CARD_FIELDS.list] },
  libraryAuthorTagTypeId: null,

  ensureLoaded: async () => {
    const state = get()
    if (state.loaded || state.loading) {
      return
    }
    set({ loading: true, lastError: '' })
    try {
      const response = await http.get('/api/v1/settings')
      const settings = (response?.data ?? {}) as Record<string, unknown>

      const rawColumns = safeParseJson(settings[SETTINGS_KEYS.gridColumns], DEFAULT_LIBRARY_GRID_COLUMNS)
      const libraryGridColumns = normalizeGridColumns(rawColumns)

      const rawFields = safeParseJson(settings[SETTINGS_KEYS.cardFields], DEFAULT_LIBRARY_CARD_FIELDS)
      const libraryCardFields = normalizeCardFields(rawFields)

      const rawAuthorTypeId = settings[SETTINGS_KEYS.authorTagTypeId]
      const normalizedAuthorTypeId = clampInt(rawAuthorTypeId, { min: 1, max: 2147483647 })

      set({
        loaded: true,
        libraryGridColumns,
        libraryCardFields,
        libraryAuthorTagTypeId: normalizedAuthorTypeId
      })
    } catch (error) {
      const message = (error as any)?.response?.data?.error || '加载设置失败'
      set({ lastError: String(message) })
    } finally {
      set({ loading: false })
    }
  },

  saveLibraryDisplaySettings: async (payload) => {
    const ops: Promise<unknown>[] = []

    if (payload?.gridColumns) {
      const normalized = normalizeGridColumns(payload.gridColumns)
      ops.push(
        http.put(`/api/v1/settings/${SETTINGS_KEYS.gridColumns}`, {
          value: JSON.stringify(normalized)
        })
      )
    }

    if (payload?.cardFields) {
      const normalized = normalizeCardFields(payload.cardFields)
      ops.push(
        http.put(`/api/v1/settings/${SETTINGS_KEYS.cardFields}`, {
          value: JSON.stringify(normalized)
        })
      )
    }

    if (payload && 'authorTagTypeId' in payload) {
      const normalized = clampInt(payload.authorTagTypeId, { min: 1, max: 2147483647 })
      ops.push(
        http.put(`/api/v1/settings/${SETTINGS_KEYS.authorTagTypeId}`, {
          value: normalized ? String(normalized) : ''
        })
      )
    }

    await Promise.all(ops)
    set({ loaded: false })
    await get().ensureLoaded()
  },

  resetLibraryDisplaySettings: async () => {
    await get().saveLibraryDisplaySettings({
      gridColumns: DEFAULT_LIBRARY_GRID_COLUMNS,
      cardFields: { grid: [...DEFAULT_LIBRARY_CARD_FIELDS.grid], list: [...DEFAULT_LIBRARY_CARD_FIELDS.list] },
      authorTagTypeId: null
    })
  },

  fieldsForViewMode: (mode) => {
    const fields = get().libraryCardFields
    return mode === 'list' ? fields.list : fields.grid
  }
}))
