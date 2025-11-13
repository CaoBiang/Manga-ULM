<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const router = useRouter()

const libraryStats = ref(null)
const statsLoading = ref(false)
const statsError = ref('')
const lastUpdated = ref('')

const totals = computed(() => libraryStats.value?.totals ?? {
  items: 0,
  pages: 0,
  file_size_bytes: 0,
  liked_items: 0,
  average_pages: 0
})
const statusCounts = computed(() => libraryStats.value?.status_counts ?? {})
const highlights = computed(() => libraryStats.value?.highlights ?? { recently_added: [], recently_read: [], largest_files: [] })
const topTags = computed(() => libraryStats.value?.top_tags ?? [])

const topTagsPreview = computed(() => topTags.value.slice(0, 8))
const highlightRecentlyAdded = computed(() => highlights.value.recently_added ?? [])
const highlightRecentlyRead = computed(() => highlights.value.recently_read ?? [])
const hasHighlights = computed(() =>
  highlightRecentlyAdded.value.length > 0 || highlightRecentlyRead.value.length > 0
)

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
const lastUpdatedDisplay = computed(() => lastUpdated.value ? formatDateTime(lastUpdated.value) : '')

const statusCount = (status) => statusCounts.value[status] ?? 0
const statusSummary = computed(() => [
  { key: 'unread', label: t('statusUnread'), color: 'blue', count: statusCount('unread') },
  { key: 'in_progress', label: t('statusInProgress'), color: 'orange', count: statusCount('in_progress') },
  { key: 'finished', label: t('statusFinished'), color: 'green', count: statusCount('finished') }
])

const fetchStats = async (force = false) => {
  if (statsLoading.value) {
    return
  }
  if (libraryStats.value && !force) {
    return
  }

  statsLoading.value = true
  statsError.value = ''
  try {
    const response = await axios.get('/api/v1/files/stats')
    libraryStats.value = response.data
    lastUpdated.value = new Date().toISOString()
  } catch (error) {
    console.error('Failed to fetch library stats:', error)
    statsError.value = error.response?.data?.error || error.message || t('failedToFetchStats')
  } finally {
    statsLoading.value = false
  }
}

const refreshStats = () => fetchStats(true)

const goToLibrary = () => {
  router.push({ name: 'library' })
}

onMounted(() => {
  fetchStats()
})

onActivated(() => {
  fetchStats(true)
})
</script>

<template>
  <a-space direction="vertical" size="large" class="w-full">
    <a-card class="shadow-sm" :bodyStyle="{ padding: '20px 24px' }">
      <div class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-sm font-semibold uppercase tracking-wide text-monet-blue">
            {{ t('home') }}
          </p>
          <h1 class="text-3xl font-bold text-gray-900">{{ t('libraryDashboardTitle') }}</h1>
          <p class="text-sm text-gray-500">{{ t('libraryDashboardSubtitle') }}</p>
        </div>
        <div class="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a-button size="large" @click="refreshStats" :loading="statsLoading">
            {{ t('refresh') }}
          </a-button>
          <a-button type="primary" size="large" @click="goToLibrary">
            {{ t('viewLibraryButton') }}
          </a-button>
        </div>
      </div>
    </a-card>

    <a-card class="shadow-sm">
      <template #title>
        {{ t('libraryOverview') }}
      </template>

      <template #extra>
        <a-space align="center">
          <a-typography-text v-if="lastUpdatedDisplay" type="secondary">
            {{ t('lastUpdatedLabel', { time: lastUpdatedDisplay }) }}
          </a-typography-text>
          <a-typography-text v-if="statsError" type="danger">
            {{ statsError }}
          </a-typography-text>
          <a-button size="small" :loading="statsLoading" @click="refreshStats">
            {{ statsLoading ? t('loading') : t('refresh') }}
          </a-button>
        </a-space>
      </template>

      <div v-if="statsLoading && !libraryStats" class="flex justify-center py-12">
        <a-spin :tip="t('loading')" size="large" />
      </div>

      <template v-else-if="libraryStats">
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
                  v-for="item in statusSummary"
                  :key="`status-summary-${item.key}`"
                  :color="item.color"
                >
                  {{ item.label }}
                  <span class="ml-1 text-xs text-white/80">({{ item.count }})</span>
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
                  color="geekblue"
                >
                  {{ tag.name }}
                  <span class="ml-1 text-xs text-white/80">({{ tag.usage_count }})</span>
                </a-tag>
                <span v-if="!topTagsPreview.length" class="text-xs text-gray-400">{{ t('statEmptyList') }}</span>
              </a-space>
            </a-card>
          </a-col>
        </a-row>

        <a-row v-if="hasHighlights" :gutter="[16, 16]">
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
      </template>

      <a-empty v-else :description="statsError || t('failedToFetchStats')" />
    </a-card>
  </a-space>
</template>
