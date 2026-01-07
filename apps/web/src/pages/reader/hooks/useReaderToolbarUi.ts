import { useCallback, useMemo, useReducer } from 'react'
import type { ReaderPanelKey } from '@/pages/reader/types'

export type ReaderToolbarUiState = {
  expanded: boolean
  activePanel: ReaderPanelKey
}

type ReaderToolbarUiAction =
  | { type: 'setExpanded'; expanded: boolean }
  | { type: 'setActivePanel'; panel: ReaderPanelKey }
  | { type: 'toggleExpanded' }
  | { type: 'togglePanel'; panel: ReaderPanelKey }
  | { type: 'closePanel' }

const reducer = (state: ReaderToolbarUiState, action: ReaderToolbarUiAction): ReaderToolbarUiState => {
  switch (action.type) {
    case 'setExpanded': {
      if (action.expanded) return { ...state, expanded: true }
      return { expanded: false, activePanel: '' }
    }
    case 'setActivePanel': {
      if (!action.panel) return { ...state, activePanel: '' }
      return { expanded: true, activePanel: action.panel }
    }
    case 'toggleExpanded': {
      if (state.expanded) return { expanded: false, activePanel: '' }
      return { ...state, expanded: true }
    }
    case 'togglePanel': {
      if (!action.panel) return { ...state, activePanel: '' }
      if (state.activePanel === action.panel) return { ...state, activePanel: '' }
      return { expanded: true, activePanel: action.panel }
    }
    case 'closePanel': {
      return { ...state, activePanel: '' }
    }
    default: {
      return state
    }
  }
}

export type ReaderToolbarUiActions = {
  setExpanded: (expanded: boolean) => void
  toggleExpanded: () => void
  setActivePanel: (panel: ReaderPanelKey) => void
  togglePanel: (panel: ReaderPanelKey) => void
  closePanel: () => void
}

export const useReaderToolbarUi = (initialState?: Partial<ReaderToolbarUiState>) => {
  const [state, dispatch] = useReducer(reducer, {
    expanded: Boolean(initialState?.expanded),
    activePanel: (initialState?.activePanel ?? '') as ReaderPanelKey
  })

  const actions = useMemo<ReaderToolbarUiActions>(() => {
    return {
      setExpanded: (expanded) => dispatch({ type: 'setExpanded', expanded }),
      toggleExpanded: () => dispatch({ type: 'toggleExpanded' }),
      setActivePanel: (panel) => dispatch({ type: 'setActivePanel', panel }),
      togglePanel: (panel) => dispatch({ type: 'togglePanel', panel }),
      closePanel: () => dispatch({ type: 'closePanel' })
    }
  }, [])

  const getIsPanelVisible = useCallback((panel: ReaderPanelKey) => state.expanded && state.activePanel === panel, [state.activePanel, state.expanded])

  return { state, actions, getIsPanelVisible }
}

