<script setup>
import { ref, computed, watch, onActivated, onDeactivated, nextTick, onBeforeUnmount } from 'vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import MangaCard from '@/components/MangaCard.vue'
import TagSelector from '@/components/TagSelector.vue'

const { t } = useI18n()

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
const viewMode = ref('grid')
const viewToggleOptions = computed(() => [
  { label: t('viewGrid'), value: 'grid' },
  { label: t('viewList'), value: 'list' },
])

const sortValue = ref('add_date:desc')

const libraryStats = ref(null)
const statsLoading = ref(false)
const statsError = ref('')
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

const totals = computed(() => libraryStats.value?.totals ?? {
  items: 0,
  pages: 0,
  file_size_bytes: 0,
  liked_items: 0,
  average_pages: 0,
})
const statusCounts = computed(() => libraryStats.value?.status_counts ?? {})
const highlights = computed(() => libraryStats.value?.highlights ?? { recently_added: [], recently_read: [], largest_files: [] })
const topTags = computed(() => libraryStats.value?.top_tags ?? [])
const paginationTotalItems = computed(() => pagination.value.total_items ?? library.value.length ?? 0)

const topTagsPreview = computed(() => topTags.value.slice(0, 8))
const highlightRecentlyAdded = computed(() => highlights.value.recently_added ?? [])
const highlightRecentlyRead = computed(() => highlights.value.recently_read ?? [])

const totalSizeReadable = computed(() => formatBytes(totals.value.file_size_bytes || 0))
const totalTitlesDisplay = computed(() => (totals.value.items || 0).toLocaleString())
const totalPagesDisplay = computed(() => (totals.value.pages || 0).toLocaleString())
const likedCountDisplay = computed(() => (totals.value.liked_items || 0).toLocaleString())
const averagePagesDisplay = computed(() => {
  const value = Number(totals.value.average_pages || 0)
  if (!value) {
    return '0'
  }
  return value >= 10 ? value.toFixed(0) : value.toFixed(1)
})

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

const sizeUnits = computed(() => [
  t('sizeUnitB'),
  t('sizeUnitKB'),
  t('sizeUnitMB'),
  t('sizeUnitGB'),
  t('sizeUnitTB')
])

const formatBytes = (bytes) => {
  if (!bytes) {
    return `0 ${sizeUnits.value[0]}`
  }
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizeUnits.value.length - 1)
  const size = bytes / Math.pow(1024, exponent)
  const unit = sizeUnits.value[exponent] || sizeUnits.value[sizeUnits.value.length - 1]
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`
}

const formatDateTime = (isoString) => {
  if (!isoString) {
    return '--'
  }
  try {
    return new Date(isoString).toLocaleString()
  } catch (_error) {
    return isoString
  }
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
  statsError.value = ''
  try {
    const response = await axios.get('/api/v1/files/stats')
    libraryStats.value = response.data
    statsFetched = true
  } catch (error) {
    console.error('Failed to fetch library stats:', error)
    statsError.value = error.response?.data?.error || error.message || t('failedToFetchStats')
  } finally {
    statsLoading.value = false
  }
}

const refreshStats = () => fetchStats(true)

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

const setViewMode = (mode) => {
  viewMode.value = mode
}

const applyTopTag = (tag) => {
  if (!tag) {
    return
  }
  if (!selectedTags.value.some(selected => selected.id === tag.id)) {
    selectedTags.value = [...selectedTags.value, { id: tag.id, name: tag.name }]
  }
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
    <a-card class="shadow-sm" :bodyStyle="{ padding: '20px 24px' }">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 class="text-3xl font-bold text-gray-900">{{ t('library') }}</h1>
          <p class="text-sm text-gray-500">{{ t('libraryOverview') }}</p>
        </div>
        <div class="flex flex-col gap-2 text-sm text-gray-600 md:flex-row md:items-center">
          <span class="font-medium">{{ t('viewModeLabel') }}</span>
          <a-segmented
            :value="viewMode"
            :options="viewToggleOptions"
            size="large"
            @change="setViewMode"
          />
        </div>
      </div>
    </a-card>

    <template v-if="libraryStats">
      <a-card
        class="shadow-sm"
        :title="t('libraryOverview')"
      >
      <template #extra>
        <a-space align="center">
          <a-typography-text v-if="statsError" type="danger">{{ statsError }}</a-typography-text>
          <a-button size="small" :loading="statsLoading" @click="refreshStats">
            {{ statsLoading ? t('loading') : t('refresh') }}
          </a-button>
        </a-space>
      </template>

      <a-row :gutter="[16, 16]" class="mb-4">
        <a-col :xs="24" :md="12" :xl="6">
          <a-card size="small" class="h-full bg-gradient-to-br from-monet-blue/60 to-white" :bordered="false">
            <a-statistic
              :title="t('statTitlesTotal')"
              :value="totals.items || 0"
              :value-style="{ fontWeight: 700, color: '#1f2937' }"
            />
            <a-typography-text type="secondary">
              {{ t('statPagesTotal', { count: totalPagesDisplay }) }}
            </a-typography-text>
            <br>
            <a-typography-text type="secondary">
              {{ t('statAveragePages', { count: averagePagesDisplay }) }}
            </a-typography-text>
          </a-card>
        </a-col>
        <a-col :xs="24" :md="12" :xl="6">
          <a-card size="small" class="h-full" :bordered="false">
            <p class="text-sm font-medium text-gray-600">{{ t('statFilterByStatus') }}</p>
            <a-space wrap class="mt-3">
              <a-tag
                v-for="option in statusOptions"
                :key="`status-chip-${option.value}`"
                :color="isStatusButtonActive(option.value) ? option.color : undefined"
                class="cursor-pointer transition"
                :class="{ 'opacity-60': !isStatusButtonActive(option.value) }"
                @click="toggleStatus(option.value)"
              >
                {{ option.label }}
                <span v-if="option.value !== 'all'" class="ml-1 text-xs">({{ statusCount(option.value) }})</span>
              </a-tag>
            </a-space>
          </a-card>
        </a-col>
        <a-col :xs="24" :md="12" :xl="6">
          <a-card size="small" class="h-full" :bordered="false">
            <p class="text-sm font-medium text-gray-600">{{ t('statEngagement') }}</p>
            <a-typography-text class="block mt-2">
              {{ t('statLikedCount', { count: likedCountDisplay }) }}
            </a-typography-text>
            <a-typography-text class="block">
              {{ t('statTotalSize', { size: totalSizeReadable }) }}
            </a-typography-text>
          </a-card>
        </a-col>
        <a-col :xs="24" :md="12" :xl="6">
          <a-card size="small" class="h-full" :bordered="false">
            <p class="text-sm font-medium text-gray-600">{{ t('statTopTags') }}</p>
            <a-space wrap class="mt-3">
              <a-tag
                v-for="tag in topTagsPreview"
                :key="`top-tag-${tag.id}`"
                class="cursor-pointer"
                color="geekblue"
                @click="applyTopTag(tag)"
              >
                {{ tag.name }}
                <span class="ml-1 text-xs text-white/80">({{ tag.usage_count }})</span>
              </a-tag>
              <span v-if="!topTagsPreview.length" class="text-xs text-gray-400">{{ t('statEmptyList') }}</span>
            </a-space>
          </a-card>
        </a-col>
      </a-row>

      <a-row :gutter="[16, 16]">
        <a-col :xs="24" :md="12">
          <a-card size="small" type="inner" :title="t('recentlyAdded')">
            <a-list
              :data-source="highlightRecentlyAdded"
              :locale="{ emptyText: t('statEmptyList') }"
              size="small"
              bordered
            >
              <template #renderItem="{ item }">
                <a-list-item class="!px-0 flex items-center justify-between gap-3">
                  <RouterLink
                    :to="{ name: 'reader', params: { id: item.id } }"
                    class="font-medium text-monet-blue hover:underline truncate flex-1"
                  >
                    {{ item.display_name || item.file_path }}
                  </RouterLink>
                  <span class="text-xs text-gray-500 whitespace-nowrap">{{ formatDateTime(item.add_date) }}</span>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>
        <a-col :xs="24" :md="12">
          <a-card size="small" type="inner" :title="t('recentlyRead')">
            <a-list
              :data-source="highlightRecentlyRead"
              :locale="{ emptyText: t('statEmptyList') }"
              size="small"
              bordered
            >
              <template #renderItem="{ item }">
                <a-list-item class="!px-0 flex items-center justify-between gap-3">
                  <RouterLink
                    :to="{ name: 'reader', params: { id: item.id } }"
                    class="font-medium text-monet-blue hover:underline truncate flex-1"
                  >
                    {{ item.display_name || item.file_path }}
                  </RouterLink>
                  <span class="text-xs text-gray-500 whitespace-nowrap">{{ formatDateTime(item.last_read_date) }}</span>
                </a-list-item>
              </template>
            </a-list>
          </a-card>
        </a-col>
      </a-row>
    </a-card>
    </template>

    <a-card
      v-else
      class="shadow-sm space-y-2"
    >
      <p class="text-sm text-gray-600">{{ t('failedToFetchStats') }}</p>
      <a-button @click="refreshStats(true)">
        {{ t('retry') }}
      </a-button>
    </a-card>

    <a-card class="shadow-sm" :title="t('filtersPanelTitle')">
      <a-form layout="vertical">
        <a-row :gutter="[16, 16]">
          <a-col :xs="24" :lg="12">
            <a-form-item :label="t('filterByTags')">
              <TagSelector v-model="selectedTags" />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :lg="12">
            <a-form-item :label="t('keywordPlaceholder')">
              <a-input-search
                v-model:value="keyword"
                :placeholder="t('keywordPlaceholder')"
                allow-clear
                size="large"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12" :xl="6">
            <a-form-item :label="t('itemsPerPage')">
              <a-select
                v-model:value="currentPageSize"
                :options="perPageSelectOptions"
                size="large"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12" :xl="6">
            <a-form-item :label="t('sortOrder')">
              <a-select
                v-model:value="sortValue"
                :options="sortOptions"
                size="large"
              />
            </a-form-item>
          </a-col>
        </a-row>
      </a-form>

      <a-divider />

      <a-row :gutter="[16, 16]" class="items-center">
        <a-col :xs="24" :md="12">
          <span class="block text-sm font-medium text-gray-600 mb-2">{{ t('likedFilterLabel') }}</span>
          <a-segmented
            :value="likedFilter"
            :options="likedOptions"
            size="large"
            @change="setLikedFilter"
          />
        </a-col>
        <a-col :xs="24" :md="12">
          <span class="block text-sm font-medium text-gray-600 mb-2">{{ t('tagModeLabel') }}</span>
          <a-segmented
            :value="tagMode"
            :options="tagModeOptions"
            size="large"
            @change="setTagMode"
          />
        </a-col>
      </a-row>

      <div class="mt-4">
        <p class="text-sm font-medium text-gray-600 mb-2">{{ t('statFilterByStatus') }}</p>
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

      <div v-if="selectedTags.length > 0" class="mt-4 border-t border-gray-100 pt-3">
        <p class="text-xs font-semibold text-gray-500 mb-2">{{ t('activeTagFilters') }}</p>
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
/* Page-specific styles can be added here if needed. */
</style>
