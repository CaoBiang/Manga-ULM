<script setup>
import { ref, computed, watch, onActivated, onDeactivated, nextTick, onBeforeUnmount } from 'vue'
import { storeToRefs } from 'pinia'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import MangaCard from '@/components/MangaCard.vue'
import TagSelector from '@/components/TagSelector.vue'
import { useLibraryPreferencesStore } from '@/store/preferences'

const { t } = useI18n()
const libraryPreferencesStore = useLibraryPreferencesStore()
const { viewMode } = storeToRefs(libraryPreferencesStore)

const library = ref([])
const pagination = ref({
  page: 1,
  per_page: 20,
  total_pages: 1,
  total_items: 0,
})
const isLoading = ref(true)
const errorMessage = ref('')
const currentPage = ref(1)
const goToPageInput = ref(1)

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
const currentPageSize = ref(200)
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

const parseSortValue = (value) => {
  const [by, order] = (value || '').split(':')
  return {
    by: by || 'add_date',
    order: order === 'asc' ? 'asc' : 'desc',
  }
}

const resetToFirstPage = () => {
  if (currentPage.value !== 1) {
    currentPage.value = 1
  } else {
    fetchLibrary()
  }
}

const statusCount = (status) => statusCounts.value[status] ?? 0
const isStatusButtonActive = (status) => {
  if (status === 'all') {
    return selectedStatuses.value.length === 0
  }
  return selectedStatuses.value.includes(status)
}

const fetchLibrary = async () => {
  isLoading.value = true
  errorMessage.value = ''
  try {
    const { by, order } = parseSortValue(sortValue.value)
    const params = {
      page: currentPage.value,
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
    library.value = response.data.files || []

    const newPage = response.data.pagination?.page ?? params.page
    pagination.value = {
      page: newPage,
      per_page: response.data.pagination?.per_page ?? params.per_page,
      total_pages: response.data.pagination?.total_pages ?? 1,
      total_items: response.data.pagination?.total_items ?? library.value.length,
    }

    if (currentPage.value !== newPage) {
      currentPage.value = newPage
    }
    goToPageInput.value = newPage
  } catch (error) {
    console.error('Failed to fetch library:', error)
    errorMessage.value = error.response?.data?.error || t('failedToFetchLibrary')
  } finally {
    isLoading.value = false
  }
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

const handlePageChange = (page) => {
  if (page > 0 && page <= pagination.value.total_pages) {
    currentPage.value = page
  }
}

const goToPage = () => {
  const page = Number(goToPageInput.value)
  const totalPages = pagination.value.total_pages || 1

  if (Number.isInteger(page) && page > 0 && page <= totalPages) {
    handlePageChange(page)
  } else {
    window.alert(t('goToPageOutOfRange', { total: totalPages }))
    goToPageInput.value = pagination.value.page
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

watch(currentPage, fetchLibrary)

watch(() => currentPageSize.value, () => resetToFirstPage())
watch(() => sortValue.value, () => resetToFirstPage())
watch(() => tagMode.value, () => resetToFirstPage())
watch(() => likedFilter.value, () => resetToFirstPage())

watch(() => selectedTags.value.map(tag => tag.id).sort().join(','), () => resetToFirstPage())
watch(() => selectedStatuses.value.slice().sort().join(','), () => resetToFirstPage())

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
    resetToFirstPage()
  }, 300)
})

onActivated(() => {
  if (!isLoaded) {
    fetchLibrary()
    fetchStats()
    isLoaded = true
  } else {
    fetchLibrary()
    fetchStats(true)
  }

  nextTick(() => {
    window.scrollTo(0, scrollPosition.value)
  })
})

onDeactivated(() => {
  scrollPosition.value = window.scrollY
})

onBeforeUnmount(() => {
  if (keywordDebounceHandle) {
    clearTimeout(keywordDebounceHandle)
  }
  if (statsRefreshHandle) {
    clearTimeout(statsRefreshHandle)
  }
})
</script>

<template>
  <a-space direction="vertical" size="large" class="w-full">
    <a-card class="shadow-sm filters-card" :bodyStyle="{ padding: 0 }">
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
    </a-card>

    <a-alert
      v-if="errorMessage"
      type="error"
      show-icon
      :message="errorMessage"
    />

    <a-card v-if="isLoading" class="shadow-sm">
      <div class="flex justify-center py-12">
        <a-spin :tip="t('loadingLibrary')" size="large" />
      </div>
    </a-card>

    <a-card v-else class="shadow-sm">
      <template v-if="library.length > 0">
        <div v-if="viewMode === 'grid'" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
          <MangaCard
            v-for="manga in library"
            :key="manga.id"
            :manga="manga"
            :view-mode="viewMode"
            @metadata-updated="handleMangaUpdate"
            v-memo="[manga.id, manga.is_liked, manga.reading_status, manga.progress_percent]"
          />
        </div>
        <div v-else class="space-y-3">
          <MangaCard
            v-for="manga in library"
            :key="`list-${manga.id}`"
            :manga="manga"
            :view-mode="viewMode"
            @metadata-updated="handleMangaUpdate"
          />
        </div>

        <div class="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <a-pagination
            :current="pagination.page"
            :total="paginationTotalItems"
            :page-size="pagination.per_page"
            :show-size-changer="false"
            :hide-on-single-page="pagination.total_pages <= 1"
            show-less-items
            @change="handlePageChange"
          />
          <a-space align="center">
            <span class="text-sm text-gray-600">
              {{ t('pageIndicator', { currentPage: pagination.page, totalPages: pagination.total_pages }) }}
            </span>
            <a-input-number
              v-model:value="goToPageInput"
              :min="1"
              :max="pagination.total_pages"
              :precision="0"
              style="width: 100px"
            />
            <a-button @click="goToPage">{{ t('go') }}</a-button>
          </a-space>
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
    </a-card>
  </a-space>
</template>

<style>
.filters-card :deep(.ant-collapse) {
  background: transparent;
  border: none;
}

.filters-card :deep(.ant-collapse-item) {
  border-bottom: 1px solid #f2f4f7;
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
  color: #0f172a;
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
