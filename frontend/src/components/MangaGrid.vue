<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useUiSettingsStore, DEFAULT_LIBRARY_GRID_COLUMNS } from '@/store/uiSettings'

const props = defineProps({
  columns: {
    type: Object,
    default: null
  },
  gap: {
    type: Number,
    default: 16
  }
})

const clampInt = (value, { min = 1, max = 24 } = {}) => {
  const parsed = Number.parseInt(String(value), 10)
  if (Number.isNaN(parsed)) {
    return null
  }
  return Math.min(max, Math.max(min, parsed))
}

const uiSettingsStore = useUiSettingsStore()
const { libraryGridColumns } = storeToRefs(uiSettingsStore)

const resolvedColumns = computed(() => {
  const source = props.columns || libraryGridColumns.value || {}
  const fallback = DEFAULT_LIBRARY_GRID_COLUMNS
  const merged = { ...fallback }

  for (const key of Object.keys(fallback)) {
    const nextValue = clampInt(source[key])
    if (nextValue !== null) {
      merged[key] = nextValue
    }
  }

  return merged
})

const styleVars = computed(() => ({
  '--cols-base': String(resolvedColumns.value.base),
  '--cols-sm': String(resolvedColumns.value.sm),
  '--cols-md': String(resolvedColumns.value.md),
  '--cols-lg': String(resolvedColumns.value.lg),
  '--cols-xl': String(resolvedColumns.value.xl),
  '--cols-2xl': String(resolvedColumns.value['2xl']),
  '--gap': `${props.gap}px`
}))
</script>

<template>
  <div class="manga-grid" :style="styleVars">
    <slot />
  </div>
</template>

<style scoped>
.manga-grid {
  display: grid;
  gap: var(--gap, 16px);
  grid-template-columns: repeat(var(--cols-base, 2), minmax(0, 1fr));
}

@media (min-width: 640px) {
  .manga-grid {
    grid-template-columns: repeat(var(--cols-sm, 3), minmax(0, 1fr));
  }
}

@media (min-width: 768px) {
  .manga-grid {
    grid-template-columns: repeat(var(--cols-md, 4), minmax(0, 1fr));
  }
}

@media (min-width: 1024px) {
  .manga-grid {
    grid-template-columns: repeat(var(--cols-lg, 5), minmax(0, 1fr));
  }
}

@media (min-width: 1280px) {
  .manga-grid {
    grid-template-columns: repeat(var(--cols-xl, 6), minmax(0, 1fr));
  }
}

@media (min-width: 1536px) {
  .manga-grid {
    grid-template-columns: repeat(var(--cols-2xl, 8), minmax(0, 1fr));
  }
}
</style>

