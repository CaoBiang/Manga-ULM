<script setup>
import { computed, ref, watch } from 'vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const emit = defineEmits(['metadata-updated'])

const statusOrder = ['unread', 'in_progress', 'finished']

const props = defineProps({
  manga: {
    type: Object,
    required: true,
  },
  hideWishlistButton: {
    type: Boolean,
    default: false,
  },
  viewMode: {
    type: String,
    default: 'grid',
    validator: value => ['grid', 'list'].includes(value),
  },
})

const isLiked = ref(!!props.manga.is_liked)
const localStatus = ref(props.manga.reading_status || 'unread')
const progressPercent = ref(props.manga.progress_percent ?? 0)
const localLastReadPage = ref(props.manga.last_read_page ?? 0)
const updatingStatus = ref(false)

watch(() => props.manga.is_liked, (newVal) => {
  isLiked.value = !!newVal
})
watch(() => props.manga.reading_status, (newVal) => {
  localStatus.value = newVal || 'unread'
})
watch(() => props.manga.progress_percent, (newVal) => {
  progressPercent.value = newVal ?? 0
})
watch(() => props.manga.last_read_page, (newVal) => {
  localLastReadPage.value = newVal ?? 0
})

const fileName = computed(() => props.manga.file_path?.split(/[\\/]/).pop() || '')
const displayName = computed(() => props.manga.display_name || fileName.value)
const folderName = computed(() => props.manga.folder_name || '')
const sanitizedTags = computed(() => props.manga.tags || [])

const normalizedProgress = computed(() => Math.min(100, Math.max(0, progressPercent.value ?? 0)))
const progressBarStyle = computed(() => ({ width: `${normalizedProgress.value}%` }))
const progressPercentDisplay = computed(() => `${Math.round(normalizedProgress.value)}%`)

const statusMetaMap = computed(() => ({
  unread: {
    label: t('statusUnread'),
    short: t('statusUnreadShort'),
    badge: 'bg-gray-100 text-gray-700',
    bar: 'bg-gray-400',
  },
  in_progress: {
    label: t('statusInProgress'),
    short: t('statusInProgressShort'),
    badge: 'bg-amber-100 text-amber-800',
    bar: 'bg-amber-500',
  },
  finished: {
    label: t('statusFinished'),
    short: t('statusFinishedShort'),
    badge: 'bg-emerald-100 text-emerald-800',
    bar: 'bg-emerald-500',
  },
}))

const statusMeta = computed(() => statusMetaMap.value[localStatus.value] || statusMetaMap.value.unread)
const statusButtons = computed(() => statusOrder.map(value => ({
  value,
  label: statusMetaMap.value[value].short,
})))

const formatBytes = (bytes) => {
  if (!bytes) {
    return '0 B'
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const size = bytes / Math.pow(1024, exponent)
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[exponent]}`
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

const fileSizeDisplay = computed(() => props.manga.file_size ? formatBytes(props.manga.file_size) : '--')
const lastReadDisplay = computed(() => props.manga.last_read_date ? formatDateTime(props.manga.last_read_date) : t('lastReadNever'))

const progressSummary = computed(() => {
  const total = props.manga.total_pages || 0
  const lastRead = localLastReadPage.value || 0

  if (!total) {
    return t('progressUnknown')
  }
  if (localStatus.value === 'finished') {
    return t('progressFinished')
  }
  if (localStatus.value === 'unread') {
    return t('progressUnread')
  }
  return t('progressCurrent', { page: Math.min(total, lastRead + 1), total })
})

const applyServerUpdate = (payload) => {
  if (!payload) {
    return
  }
  localStatus.value = payload.reading_status || localStatus.value
  progressPercent.value = payload.progress_percent ?? progressPercent.value
  localLastReadPage.value = payload.last_read_page ?? localLastReadPage.value
  isLiked.value = payload.is_liked ?? isLiked.value
  emit('metadata-updated', payload)
}

const updateStatus = async (status) => {
  if (updatingStatus.value || !status) {
    return
  }
  updatingStatus.value = true
  try {
    const response = await axios.post(`/api/v1/files/${props.manga.id}/status`, { status })
    applyServerUpdate(response.data)
  } catch (error) {
    console.error('Failed to update status:', error)
    window.alert(t('failedToUpdateStatus'))
  } finally {
    updatingStatus.value = false
  }
}

const cycleStatus = async (event) => {
  event?.stopPropagation()
  event?.preventDefault()
  const currentIndex = Math.max(0, statusOrder.indexOf(localStatus.value))
  const nextStatus = statusOrder[(currentIndex + 1) % statusOrder.length]
  await updateStatus(nextStatus)
}

const setStatus = async (status, event) => {
  event?.stopPropagation()
  event?.preventDefault()
  await updateStatus(status)
}

const toggleLike = async (event) => {
  event.stopPropagation()
  event.preventDefault()

  const originalLikedState = isLiked.value
  isLiked.value = !isLiked.value

  try {
    if (isLiked.value) {
      await axios.post(`/api/v1/likes/${props.manga.id}`)
    } else {
      await axios.delete(`/api/v1/likes/${props.manga.id}`)
    }
    emit('metadata-updated', {
      ...props.manga,
      is_liked: isLiked.value,
      liked_at: isLiked.value ? new Date().toISOString() : null,
    })
  } catch (error) {
    isLiked.value = originalLikedState
    console.error('Failed to update like status:', error)
    window.alert(t('failedToToggleLike'))
  }
}
</script>

<template>
  <div v-if="viewMode === 'grid'" class="group relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
    <button
      class="absolute top-2 left-2 z-10 px-2 py-1 text-xs font-semibold rounded-full cursor-pointer shadow"
      :class="statusMeta.badge"
      @click="cycleStatus"
      :title="t('statusCycleHint')"
    >
      {{ statusMeta.label }}
    </button>

    <button
      v-if="!hideWishlistButton"
      @click="toggleLike"
      class="absolute top-2 right-2 z-10 p-1.5 bg-white bg-opacity-60 rounded-full text-gray-700 hover:text-red-500 transition-colors"
      :title="isLiked ? t('removeFromWishlist') : t('likeIt')"
    >
      <svg v-if="isLiked" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>

    <div class="w-full h-64 bg-gray-100">
      <img
        :src="manga.cover_url"
        :alt="displayName"
        class="w-full h-full object-cover"
        @error.once="e => e.target.src = 'https://via.placeholder.com/300x400.png?text=No+Cover'"
        loading="lazy"
      />
    </div>

    <div class="p-3 space-y-2">
      <div class="flex items-start justify-between gap-2">
        <h3 class="text-sm font-semibold text-gray-800 truncate" :title="displayName">
          {{ displayName }}
        </h3>
        <span class="text-xs font-semibold text-gray-500">
          {{ progressPercentDisplay }}
        </span>
      </div>

      <div class="flex items-center justify-between text-xs text-gray-500">
        <span class="truncate" :title="folderName">{{ folderName }}</span>
        <span>{{ fileSizeDisplay }}</span>
      </div>

      <div class="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div class="h-full transition-all duration-200" :class="statusMeta.bar" :style="progressBarStyle"></div>
      </div>
      <p class="text-[11px] text-gray-500">{{ progressSummary }}</p>

      <div class="flex items-center justify-between text-[11px] text-gray-500">
        <span>{{ manga.total_pages || 0 }} {{ t('pages') }}</span>
        <span>{{ lastReadDisplay }}</span>
      </div>

      <div v-if="sanitizedTags.length" class="flex flex-wrap gap-1">
        <span
          v-for="tag in sanitizedTags"
          :key="tag.id"
          class="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full"
        >
          {{ tag.name }}
        </span>
      </div>
    </div>

    <div class="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-center gap-y-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <RouterLink :to="{ name: 'reader', params: { id: manga.id } }" class="btn btn-primary">
        {{ t('read') }}
      </RouterLink>
      <RouterLink :to="{ name: 'edit', params: { id: manga.id } }" class="btn btn-secondary">
        {{ t('edit') }}
      </RouterLink>
    </div>
  </div>

  <div v-else class="bg-white border border-gray-200 rounded-lg shadow-sm p-3 flex gap-4 hover:shadow-md transition-shadow duration-200">
    <div class="relative w-24 h-32 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
      <img
        :src="manga.cover_url"
        :alt="displayName"
        class="w-full h-full object-cover"
        @error.once="e => e.target.src = 'https://via.placeholder.com/300x400.png?text=No+Cover'"
        loading="lazy"
      />
      <button
        v-if="!hideWishlistButton"
        @click="toggleLike"
        class="absolute top-2 right-2 z-10 p-1 bg-white bg-opacity-80 rounded-full text-gray-700 hover:text-red-500 transition-colors"
        :title="isLiked ? t('removeFromWishlist') : t('likeIt')"
      >
        <svg v-if="isLiked" xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
        </svg>
      </button>
    </div>

    <div class="flex-1 flex flex-col gap-2">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div>
          <RouterLink
            :to="{ name: 'reader', params: { id: manga.id } }"
            class="text-base font-semibold text-gray-800 hover:text-indigo-600 transition-colors"
          >
            {{ displayName }}
          </RouterLink>
          <p class="text-xs text-gray-500 truncate" :title="folderName">{{ folderName }}</p>
        </div>
        <button
          class="px-2 py-1 text-xs font-semibold rounded-full shadow border border-transparent self-start transition-colors"
          :class="statusMeta.badge"
          :disabled="updatingStatus"
          @click="cycleStatus"
        >
          {{ statusMeta.label }}
        </button>
      </div>

      <div class="flex items-center gap-2">
        <div class="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
          <div class="h-full transition-all duration-200" :class="statusMeta.bar" :style="progressBarStyle"></div>
        </div>
        <span class="text-xs font-semibold text-gray-500 w-12 text-right">{{ progressPercentDisplay }}</span>
      </div>
      <p class="text-xs text-gray-500">{{ progressSummary }}</p>

      <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>{{ t('pages') }}: {{ manga.total_pages || 0 }}</span>
        <span>{{ t('fileSizeLabel') }}: {{ fileSizeDisplay }}</span>
        <span>{{ t('lastReadAt') }}: {{ lastReadDisplay }}</span>
      </div>

      <div v-if="sanitizedTags.length" class="flex flex-wrap gap-1">
        <span
          v-for="tag in sanitizedTags"
          :key="`list-tag-${tag.id}`"
          class="px-2 py-0.5 text-xs bg-gray-100 text-gray-700 rounded-full"
        >
          {{ tag.name }}
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-2 pt-1">
        <RouterLink
          :to="{ name: 'reader', params: { id: manga.id } }"
          class="px-3 py-1.5 text-xs font-semibold bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
        >
          {{ t('read') }}
        </RouterLink>
        <RouterLink
          :to="{ name: 'edit', params: { id: manga.id } }"
          class="px-3 py-1.5 text-xs font-semibold bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
        >
          {{ t('edit') }}
        </RouterLink>
        <div class="flex items-center gap-1 ml-auto">
          <span class="text-[10px] uppercase text-gray-400 tracking-wide">{{ t('quickStatus') }}</span>
          <button
            v-for="button in statusButtons"
            :key="`status-btn-${button.value}`"
            type="button"
            class="px-2 py-1 text-[11px] font-semibold rounded-md border border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
            :class="{ 'bg-indigo-600 text-white border-indigo-600': button.value === localStatus, 'opacity-60': updatingStatus }"
            :disabled="updatingStatus"
            @click="setStatus(button.value, $event)"
          >
            {{ button.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
