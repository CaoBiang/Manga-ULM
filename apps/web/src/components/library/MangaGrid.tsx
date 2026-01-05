import type { CSSProperties, ReactNode } from 'react'
import { useMemo } from 'react'
import type { LibraryGridColumns } from '@/store/uiSettings'
import { DEFAULT_LIBRARY_GRID_COLUMNS, useUiSettingsStore } from '@/store/uiSettings'

export type MangaGridProps = {
  columns?: Partial<LibraryGridColumns> | null
  gap?: number
  children: ReactNode
}

const clampInt = (value: unknown, { min = 1, max = 24 }: { min?: number; max?: number } = {}) => {
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed)) {
    return null
  }
  return Math.min(max, Math.max(min, parsed))
}

export default function MangaGrid({ columns = null, gap = 16, children }: MangaGridProps) {
  const libraryGridColumns = useUiSettingsStore((state) => state.libraryGridColumns)

  const resolvedColumns = useMemo(() => {
    const source = columns || libraryGridColumns || {}
    const fallback = DEFAULT_LIBRARY_GRID_COLUMNS
    const merged: Record<string, number> = { ...fallback }

    for (const key of Object.keys(fallback)) {
      const nextValue = clampInt((source as any)[key])
      if (nextValue !== null) {
        merged[key] = nextValue
      }
    }

    return merged as LibraryGridColumns
  }, [columns, libraryGridColumns])

  const styleVars = useMemo(
    () =>
      ({
        '--cols-base': String(resolvedColumns.base),
        '--cols-sm': String(resolvedColumns.sm),
        '--cols-md': String(resolvedColumns.md),
        '--cols-lg': String(resolvedColumns.lg),
        '--cols-xl': String(resolvedColumns.xl),
        '--cols-2xl': String(resolvedColumns['2xl']),
        '--gap': `${gap}px`
      }) as CSSProperties,
    [gap, resolvedColumns]
  )

  return (
    <div className="manga-grid" style={styleVars}>
      {children}
    </div>
  )
}

