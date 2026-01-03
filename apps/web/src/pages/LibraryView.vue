<script setup>
import { ref, computed, watch, onActivated, onDeactivated, nextTick, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import MangaCard from '@/components/MangaCard.vue'
import MangaGrid from '@/components/MangaGrid.vue'
import TagSelector from '@/components/TagSelector.vue'
import { useUiSettingsStore } from '@/store/uiSettings'
import { useAppSettingsStore } from '@/store/appSettings'
import GlassPage from '@/components/glass/ui/GlassPage.vue'
import GlassSurface from '@/components/glass/ui/GlassSurface.vue'

const { t } = useI18n()
const appSettingsStore = useAppSettingsStore()
const { libraryViewMode: viewMode, libraryLazyRootMarginPx } = storeToRefs(appSettingsStore)
const uiSettingsStore = useUiSettingsStore()

const library = ref([])
const pagination = ref({
  page: 1,
  per_page: 20,
  total_pages: 1,
  total_items: 0,
})
const isLoading = ref(true)
const isLoadingMore = ref(false)
const errorMessage = ref('')
const currentPage = ref(1)

const keyword = ref('')
const selectedTags = ref([])
const selectedStatuses = ref([])
const likedFilter = ref('all')
const tagMode = ref('any')
const perPageOptions = [20, 50, 100, 200]
const perPageSelectOptions = computed(() =>
  perPageOptions.map(size => ({
    label: `${size}`,
    value: size,
  }))
)
const currentPageSize = computed({
  get: () => appSettingsStore.libraryPerPage,
  set: (value) => {
    appSettingsStore.setLibraryPerPage(value).catch((error) => {
      console.error('保存每页数量失败：', error)
    })
  }
})
const filterPanelKey = 'filters-panel'
const activeFilterPanels = ref([])

const sortValue = ref('add_date:desc')

const libraryStats = ref(null)
const statsLoading = ref(false)
let statsFetched = false

const scrollPosition = ref(0)
let keywordDebounceHandle = null
let statsRefreshHandle = null
let isLoaded = false
const isActive = ref(false)
const loadMoreSentinel = ref(null)
let loadMoreObserver = null

const sortOptions = computed(() => [
  { label: t('sortNewest'), value: 'add_date:desc' },
  { label: t('sortOldest'), value: 'add_date:asc' },
  { label: t('sortTitleAsc'), value: 'file_path:asc' },
  { label: t('sortTitleDesc'), value: 'file_path:desc' },
  { label: t('sortLastRead'), value: 'last_read_date:desc' },
  { label: t('sortProgress'), value: 'last_read_page:desc' },
  { label: t('sortPageCountDesc'), value: 'total_pages:desc' },
  { label: t('sortPageCountAsc'), value: 'total_pages:asc' },
  { label: t('sortFileSizeDesc'), value: 'file_size:desc' },
  { label: t('sortFileSizeAsc'), value: 'file_size:asc' },
])

const statusOptions = computed(() => [
  { value: 'all', label: t('statusAll'), color: 'default' },
  { value: 'unread', label: t('statusUnread'), color: 'blue' },
  { value: 'in_progress', label: t('statusInProgress'), color: 'orange' },
  { value: 'finished', label: t('statusFinished'), color: 'green' },
])

const likedOptions = computed(() => [
  { value: 'all', label: t('likedFilterAll') },
  { value: 'liked', label: t('likedFilterOnly') },
  { value: 'unliked', label: t('likedFilterNot') },
])
const tagModeOptions = computed(() => [
  { value: 'any', label: t('tagModeAny') },
  { value: 'all', label: t('tagModeAll') },
])

const statusCounts = computed(() => libraryStats.value?.status_counts ?? {})
const paginationTotalItems = computed(() => pagination.value.total_items ?? library.value.length ?? 0)
const hasMore = computed(() => (pagination.value.page ?? 1) < (pagination.value.total_pages ?? 1))

const parseSortValue = (value) => {
  const [by, order] = (value || '').split(':')
  return {
    by: by || 'add_date',
    order: order === 'asc' ? 'asc' : 'desc',
  }
}

const resetAndFetch = async ({ scrollToTop = true } = {}) => {
  currentPage.value = 1
  await fetchLibrary({ page: 1, append: false })
  if (scrollToTop) {
    scrollPosition.value = 0
    nextTick(() => window.scrollTo(0, 0))
  }
}

const statusCount = (status) => statusCounts.value[status] ?? 0
const isStatusButtonActive = (status) => {
  if (status === 'all') {
    return selectedStatuses.value.length === 0
  }
  return selectedStatuses.value.includes(status)
}

const fetchLibrary = async ({ page = 1, append = false } = {}) => {
  if (append) {
    if (isLoading.value || isLoadingMore.value) {
      return
    }
    isLoadingMore.value = true
  } else {
    isLoading.value = true
  }

  errorMessage.value = ''
  try {
    const { by, order } = parseSortValue(sortValue.value)
    const params = {
      page,
      per_page: currentPageSize.value,
      sort_by: by,
      sort_order: order,
      tag_mode: tagMode.value,
    }

    if (selectedTags.value.length) {
      params.tags = selectedTags.value.map(tag => tag.id).join(',')
    }

    const trimmedKeyword = keyword.value.trim()
    if (trimmedKeyword) {
      params.keyword = trimmedKeyword
    }

    if (selectedStatuses.value.length) {
      params.statuses = selectedStatuses.value.join(',')
    }

    if (likedFilter.value === 'liked') {
      params.liked = 'true'
    } else if (likedFilter.value === 'unliked') {
      params.liked = 'false'
    }

    const response = await axios.get('/api/v1/files', { params })
    const files = response.data.files || []

    if (append) {
      const existingIds = new Set(library.value.map(item => item.id))
      const merged = [...library.value]
      for (const item of files) {
        if (!existingIds.has(item.id)) {
          merged.push(item)
        }
      }
      library.value = merged
    } else {
      library.value = files
    }

    const newPage = response.data.pagination?.page ?? params.page
    pagination.value = {
      page: newPage,
      per_page: response.data.pagination?.per_page ?? params.per_page,
      total_pages: response.data.pagination?.total_pages ?? 1,
      total_items: response.data.pagination?.total_items ?? library.value.length,
    }

    currentPage.value = newPage
  } catch (error) {
    console.error('Failed to fetch library:', error)
    errorMessage.value = error.response?.data?.error || t('failedToFetchLibrary')
  } finally {
    if (append) {
      isLoadingMore.value = false
    } else {
      isLoading.value = false
    }
    if (isActive.value) {
      nextTick(() => setupLoadMoreObserver())
    }
  }
}

const loadMore = async () => {
  if (isLoading.value || isLoadingMore.value) {
    return
  }
  if (!hasMore.value) {
    return
  }
  const nextPage = (pagination.value.page ?? currentPage.value ?? 1) + 1
  await fetchLibrary({ page: nextPage, append: true })
}

const teardownLoadMoreObserver = () => {
  if (loadMoreObserver) {
    loadMoreObserver.disconnect()
    loadMoreObserver = null
  }
}

const setupLoadMoreObserver = () => {
  teardownLoadMoreObserver()
  if (!('IntersectionObserver' in window)) {
    return
  }
  if (!loadMoreSentinel.value) {
    return
  }

  loadMoreObserver = new IntersectionObserver(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        loadMore()
      }
    },
    { rootMargin: `${libraryLazyRootMarginPx.value}px 0px` }
  )

  loadMoreObserver.observe(loadMoreSentinel.value)
}

const fetchStats = async (force = false) => {
  if (statsLoading.value) {
    return
  }
  if (!force && statsFetched) {
    return
  }

  statsLoading.value = true
  try {
    const response = await axios.get('/api/v1/files/stats')
    libraryStats.value = response.data
    statsFetched = true
  } catch (error) {
    console.error('Failed to fetch library stats:', error)
  } finally {
    statsLoading.value = false
  }
}

const scheduleStatsRefresh = () => {
  if (statsRefreshHandle) {
    clearTimeout(statsRefreshHandle)
  }
  statsRefreshHandle = setTimeout(() => {
    fetchStats(true)
  }, 500)
}

const toggleStatus = (status) => {
  if (status === 'all') {
    if (selectedStatuses.value.length) {
      selectedStatuses.value = []
    }
    return
  }

  if (selectedStatuses.value.includes(status)) {
    selectedStatuses.value = selectedStatuses.value.filter(s => s !== status)
  } else {
    selectedStatuses.value = [...selectedStatuses.value, status]
  }
}

const setLikedFilter = (value) => {
  if (likedFilter.value !== value) {
    likedFilter.value = value
  }
}

const setTagMode = (value) => {
  if (!value) {
    return
  }
  tagMode.value = value
}


const toggleTag = (tag) => {
  const index = selectedTags.value.findIndex(t => t.id === tag.id)
  if (index > -1) {
    selectedTags.value.splice(index, 1)
    selectedTags.value = [...selectedTags.value]
  } else {
    selectedTags.value = [...selectedTags.value, tag]
  }
}

const handleMangaUpdate = (updatedManga) => {
  if (!updatedManga?.id) {
    return
  }

  const index = library.value.findIndex(item => item.id === updatedManga.id)
  if (index !== -1) {
    library.value.splice(index, 1, updatedManga)
  }
  scheduleStatsRefresh()
}

watch(() => currentPageSize.value, () => resetAndFetch())
watch(() => sortValue.value, () => resetAndFetch())
watch(() => tagMode.value, () => resetAndFetch())
watch(() => likedFilter.value, () => resetAndFetch())

watch(() => selectedTags.value.map(tag => tag.id).sort().join(','), () => resetAndFetch())
watch(() => selectedStatuses.value.slice().sort().join(','), () => resetAndFetch())

watch(keyword, () => {
  if (keywordDebounceHandle) {
    clearTimeout(keywordDebounceHandle)
  }
  keywordDebounceHandle = setTimeout(() => {
    const trimmed = (keyword.value || '').trim()
    if (keyword.value !== trimmed) {
      keyword.value = trimmed
      return
    }
    resetAndFetch()
  }, 300)
})

onActivated(() => {
  isActive.value = true
  uiSettingsStore.ensureLoaded()
  if (!isLoaded) {
    fetchLibrary({ page: 1, append: false })
    fetchStats()
    isLoaded = true
    nextTick(() => setupLoadMoreObserver())
  }

  nextTick(() => {
    window.scrollTo(0, scrollPosition.value)
    setupLoadMoreObserver()
  })
})

onDeactivated(() => {
  scrollPosition.value = window.scrollY
  isActive.value = false
  teardownLoadMoreObserver()
})

onBeforeUnmount(() => {
  isActive.value = false
  if (keywordDebounceHandle) {
    clearTimeout(keywordDebounceHandle)
  }
  if (statsRefreshHandle) {
    clearTimeout(statsRefreshHandle)
  }
  teardownLoadMoreObserver()
})
</script>

<template>
  <GlassPage>
    <a-space direction="vertical" size="large" class="w-full">
      <GlassSurface class="filters-card" padding="none">
        <a-collapse
          v-model:activeKey="activeFilterPanels"
          :bordered="false"
          expand-icon-position="start"
        >
          <a-collapse-panel
            :key="filterPanelKey"
            :header="t('filtersPanelTitle')"
            class="filters-card__panel"
          >
            <a-form layout="vertical" class="filters-form">
              <div class="filters-section filters-section--search">
                <a-form-item :label="t('keywordPlaceholder')" class="filters-field">
                  <a-input-search
                    v-model:value="keyword"
                    :placeholder="t('keywordPlaceholder')"
                    allow-clear
                    size="large"
                  />
                </a-form-item>
                <a-form-item :label="t('filterByTags')" class="filters-field">
                  <TagSelector v-model="selectedTags" />
                </a-form-item>
              </div>

              <div class="filters-section filters-section--controls">
                <a-form-item :label="t('itemsPerPage')" class="filters-field">
                  <a-select
                    v-model:value="currentPageSize"
                    :options="perPageSelectOptions"
                    size="large"
                  />
                </a-form-item>
                <a-form-item :label="t('sortOrder')" class="filters-field">
                  <a-select
                    v-model:value="sortValue"
                    :options="sortOptions"
                    size="large"
                  />
                </a-form-item>
                <a-form-item :label="t('tagModeLabel')" class="filters-field">
                  <a-segmented
                    :value="tagMode"
                    :options="tagModeOptions"
                    size="large"
                    @change="setTagMode"
                  />
                </a-form-item>
                <a-form-item :label="t('likedFilterLabel')" class="filters-field">
                  <a-segmented
                    :value="likedFilter"
                    :options="likedOptions"
                    size="large"
                    @change="setLikedFilter"
                  />
                </a-form-item>
              </div>

              <a-divider class="filters-divider" />

              <div class="filters-section filters-section--status">
                <span class="filters-section__label">{{ t('statFilterByStatus') }}</span>
                <a-space wrap>
                  <a-tag
                    v-for="option in statusOptions"
                    :key="`filter-status-${option.value}`"
                    :color="isStatusButtonActive(option.value) ? option.color : undefined"
                    class="cursor-pointer"
                    :class="{ 'opacity-60': !isStatusButtonActive(option.value) }"
                    @click="toggleStatus(option.value)"
                  >
                    {{ option.label }}
                    <span v-if="option.value !== 'all'" class="ml-1 text-xs">({{ statusCount(option.value) }})</span>
                  </a-tag>
                </a-space>
              </div>

              <div v-if="selectedTags.length > 0" class="filters-active-tags">
                <span class="filters-section__label">{{ t('activeTagFilters') }}</span>
                <a-space wrap>
                  <a-tag
                    v-for="tag in selectedTags"
                    :key="`active-tag-${tag.id}`"
                    color="blue"
                    closable
                    @close.prevent="toggleTag(tag)"
                  >
                    {{ tag.name }}
                  </a-tag>
                </a-space>
              </div>
            </a-form>
          </a-collapse-panel>
        </a-collapse>
      </GlassSurface>

      <a-alert
        v-if="errorMessage"
        type="error"
        show-icon
        :message="errorMessage"
      />

      <GlassSurface v-if="isLoading">
        <div class="flex justify-center py-12">
          <a-spin :tip="t('loadingLibrary')" size="large" />
        </div>
      </GlassSurface>

      <GlassSurface v-else>
        <template v-if="library.length > 0">
          <MangaGrid v-if="viewMode === 'grid'">
            <MangaCard
              v-for="manga in library"
              :key="manga.id"
              :manga="manga"
              :view-mode="viewMode"
              @metadata-updated="handleMangaUpdate"
              v-memo="[manga.id, manga.is_liked, manga.reading_status, manga.progress_percent]"
            />
          </MangaGrid>
          <div v-else class="space-y-3">
            <MangaCard
              v-for="manga in library"
              :key="`list-${manga.id}`"
              :manga="manga"
              :view-mode="viewMode"
              @metadata-updated="handleMangaUpdate"
            />
          </div>

          <div class="mt-8 flex flex-col items-center gap-3">
            <a-spin v-if="isLoadingMore" :tip="t('loadingMore')" />
            <a-button v-else-if="hasMore" @click="loadMore">
              {{ t('loadMore') }}
            </a-button>
            <a-typography-text v-else type="secondary">
              {{ t('noMoreManga') }}
            </a-typography-text>
            <a-typography-text type="secondary">
              {{ t('loadedCount', { loaded: library.length, total: paginationTotalItems }) }}
            </a-typography-text>
            <div ref="loadMoreSentinel" style="height: 1px; width: 1px"></div>
          </div>
        </template>
        <template v-else>
          <a-empty :description="t('noMangaFoundTip')">
            <template #description>
              <span>{{ t('noMangaFoundTip') }}</span>
            </template>
            <span class="font-medium text-gray-700">{{ t('noMangaFound') }}</span>
          </a-empty>
        </template>
      </GlassSurface>
    </a-space>
  </GlassPage>
</template>

<style>
.filters-card :deep(.ant-collapse) {
  background: transparent;
  border: none;
}

.filters-card :deep(.ant-collapse-item) {
  border-bottom: 1px solid var(--manager-ui-surface-border, rgba(255, 255, 255, 0.14));
  border-radius: 0;
  background: transparent;
}

.filters-card :deep(.ant-collapse-item:last-child) {
  border-bottom: none;
}

.filters-card :deep(.ant-collapse-header) {
  padding: 16px 24px;
  font-size: 1rem;
  font-weight: 600;
  color: var(--manager-ui-text, rgba(15, 23, 42, 0.92));
}

.filters-card :deep(.ant-collapse-content-box) {
  padding: 20px 24px 24px;
}

.filters-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.filters-field {
  margin-bottom: 0;
}

.filters-section {
  display: grid;
  gap: 16px;
}

.filters-section--search {
  grid-template-columns: 1fr;
}

.filters-section--controls {
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.filters-section--status {
  gap: 8px;
}

.filters-section__label {
  font-size: 0.875rem;
  font-weight: 600;
  color: #475467;
}

.filters-divider {
  margin: 0;
}

.filters-active-tags {
  border-top: 1px solid #f2f4f7;
  padding-top: 12px;
}

@media (min-width: 768px) {
  .filters-section--search {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
