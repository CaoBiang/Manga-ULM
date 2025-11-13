import { defineStore } from 'pinia'
import { ref } from 'vue'

const allowedViewModes = new Set(['grid', 'list'])

const readInitialViewMode = () => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('libraryViewMode')
    if (saved && allowedViewModes.has(saved)) {
      return saved
    }
  }
  return 'grid'
}

export const useLibraryPreferencesStore = defineStore('libraryPreferences', () => {
  const viewMode = ref(readInitialViewMode())

  const setViewMode = (mode) => {
    if (!allowedViewModes.has(mode)) {
      return
    }
    viewMode.value = mode
    if (typeof window !== 'undefined') {
      localStorage.setItem('libraryViewMode', mode)
    }
  }

  return {
    viewMode,
    setViewMode
  }
})
