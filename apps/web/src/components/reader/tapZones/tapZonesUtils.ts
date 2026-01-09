import type { ReaderTapZonesConfig } from '@/store/appSettings'

export type TapZoneSplitAxis = 'x' | 'y'

export const calcMinZoneWidthRatio = (zoneCount: number) => Math.min(0.08, 0.8 / Math.max(1, zoneCount))

export const buildTapZoneBoundaries = (splits: number[]) => [0, ...splits, 1]

export const resolveTapZoneRowCol = (zoneIndex: number, colCount: number) => {
  const resolvedColCount = Math.max(1, Number(colCount) || 1)
  const resolvedIndex = Math.max(0, Number(zoneIndex) || 0)
  return {
    row: Math.floor(resolvedIndex / resolvedColCount),
    col: resolvedIndex % resolvedColCount
  }
}

export const resolveTapZoneIndex = ({ xRatio, yRatio, xSplits, ySplits }: { xRatio: number; yRatio: number; xSplits: number[]; ySplits: number[] }) => {
  const resolvedXSplits = Array.isArray(xSplits) ? xSplits : []
  const resolvedYSplits = Array.isArray(ySplits) ? ySplits : []
  const colCount = resolvedXSplits.length + 1

  let col = 0
  for (let index = 0; index < resolvedXSplits.length; index += 1) {
    if (xRatio < Number(resolvedXSplits[index] ?? 0)) {
      col = index
      break
    }
    col = resolvedXSplits.length
  }

  let row = 0
  for (let index = 0; index < resolvedYSplits.length; index += 1) {
    if (yRatio < Number(resolvedYSplits[index] ?? 0)) {
      row = index
      break
    }
    row = resolvedYSplits.length
  }

  return { row, col, colCount, index: row * colCount + col }
}

export const resolveCenterTapZoneIndex = (xSplits: number[], ySplits: number[]) => resolveTapZoneIndex({ xRatio: 0.5, yRatio: 0.5, xSplits, ySplits }).index

export const splitTapZone = (
  config: ReaderTapZonesConfig,
  zoneIndex: number,
  axis: TapZoneSplitAxis
): { config: ReaderTapZonesConfig; nextSelectedZone: number } | null => {
  const xSplits = Array.isArray(config?.xSplits) ? config.xSplits : []
  const ySplits = Array.isArray(config?.ySplits) ? config.ySplits : []
  const actions = Array.isArray(config?.actions) ? config.actions : []

  const colCount = xSplits.length + 1
  const rowCount = ySplits.length + 1
  const zoneCount = colCount * rowCount
  if (zoneCount < 2) return null
  if (actions.length !== zoneCount) return null

  if (!Number.isFinite(zoneIndex) || zoneIndex < 0 || zoneIndex >= zoneCount) return null

  const { row, col } = resolveTapZoneRowCol(zoneIndex, colCount)

  if (axis === 'x') {
    const nextColCount = colCount + 1
    const minWidthRatio = calcMinZoneWidthRatio(nextColCount)
    const boundaries = buildTapZoneBoundaries(xSplits)
    const start = Number(boundaries[col] ?? 0)
    const end = Number(boundaries[col + 1] ?? 1)
    if (end - start < minWidthRatio * 2) return null

    const nextSplit = (start + end) / 2
    const nextXSplits = xSplits.slice()
    nextXSplits.splice(col, 0, nextSplit)

    const nextActions: ReaderTapZonesConfig['actions'] = []
    for (let r = 0; r < rowCount; r += 1) {
      for (let c = 0; c < colCount; c += 1) {
        const oldIndex = r * colCount + c
        const action = actions[oldIndex] ?? 'none'
        nextActions.push(action)
        if (c === col) {
          nextActions.push(action)
        }
      }
    }

    return {
      config: { version: 3, xSplits: nextXSplits, ySplits: ySplits.slice(), actions: nextActions },
      nextSelectedZone: row * nextColCount + Math.min(col + 1, nextColCount - 1)
    }
  }

  const nextRowCount = rowCount + 1
  const minHeightRatio = calcMinZoneWidthRatio(nextRowCount)
  const boundaries = buildTapZoneBoundaries(ySplits)
  const start = Number(boundaries[row] ?? 0)
  const end = Number(boundaries[row + 1] ?? 1)
  if (end - start < minHeightRatio * 2) return null

  const nextSplit = (start + end) / 2
  const nextYSplits = ySplits.slice()
  nextYSplits.splice(row, 0, nextSplit)

  const nextActions: ReaderTapZonesConfig['actions'] = []
  for (let r = 0; r < rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const oldIndex = r * colCount + c
      const action = actions[oldIndex] ?? 'none'
      nextActions.push(action)
    }
    if (r === row) {
      for (let c = 0; c < colCount; c += 1) {
        const oldIndex = r * colCount + c
        nextActions.push(actions[oldIndex] ?? 'none')
      }
    }
  }

  return {
    config: { version: 3, xSplits: xSplits.slice(), ySplits: nextYSplits, actions: nextActions },
    nextSelectedZone: Math.min(row + 1, nextRowCount - 1) * colCount + col
  }
}

export const removeTapZone = (
  config: ReaderTapZonesConfig,
  zoneIndex: number,
  axis: TapZoneSplitAxis
): { config: ReaderTapZonesConfig; nextSelectedZone: number } | null => {
  const xSplits = Array.isArray(config?.xSplits) ? config.xSplits : []
  const ySplits = Array.isArray(config?.ySplits) ? config.ySplits : []
  const actions = Array.isArray(config?.actions) ? config.actions : []

  const colCount = xSplits.length + 1
  const rowCount = ySplits.length + 1
  const zoneCount = colCount * rowCount
  if (zoneCount <= 2) return null
  if (actions.length !== zoneCount) return null
  if (!Number.isFinite(zoneIndex) || zoneIndex < 0 || zoneIndex >= zoneCount) return null

  const { row, col } = resolveTapZoneRowCol(zoneIndex, colCount)

  if (axis === 'x') {
    if (colCount <= 1) return null

    const removeSplitIndex = col === 0 ? 0 : col - 1
    const nextXSplits = xSplits.filter((_, index) => index !== removeSplitIndex)
    const nextColCount = colCount - 1
    const mergedColIndex = col === 0 ? 0 : col - 1

    const nextActions: ReaderTapZonesConfig['actions'] = []
    for (let r = 0; r < rowCount; r += 1) {
      const start = r * colCount
      const rowActions = actions.slice(start, start + colCount)

      if (col === 0) {
        nextActions.push(rowActions[0] ?? 'none')
        nextActions.push(...rowActions.slice(2))
      } else {
        nextActions.push(...rowActions.slice(0, col - 1))
        nextActions.push(rowActions[col] ?? 'none')
        nextActions.push(...rowActions.slice(col + 1))
      }
    }

    return {
      config: { version: 3, xSplits: nextXSplits, ySplits: ySplits.slice(), actions: nextActions },
      nextSelectedZone: row * nextColCount + mergedColIndex
    }
  }

  if (rowCount <= 1) return null

  const removeSplitIndex = row === 0 ? 0 : row - 1
  const nextYSplits = ySplits.filter((_, index) => index !== removeSplitIndex)
  const nextRowCount = rowCount - 1
  const mergedRowIndex = row === 0 ? 0 : row - 1

  const nextActions: ReaderTapZonesConfig['actions'] = []
  for (let rNew = 0; rNew < nextRowCount; rNew += 1) {
    let srcRow = 0
    if (row === 0) {
      srcRow = rNew === 0 ? 0 : rNew + 1
    } else {
      srcRow = rNew < row - 1 ? rNew : rNew === row - 1 ? row : rNew + 1
    }

    const start = srcRow * colCount
    nextActions.push(...actions.slice(start, start + colCount))
  }

  return {
    config: { version: 3, xSplits: xSplits.slice(), ySplits: nextYSplits, actions: nextActions },
    nextSelectedZone: mergedRowIndex * colCount + col
  }
}
