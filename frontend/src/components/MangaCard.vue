<script setup>
import { computed, ref, watch } from 'vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import {
  HeartFilled,
  HeartOutlined,
  ReadOutlined,
  EditOutlined
} from '@ant-design/icons-vue'

const { t } = useI18n()

const sizeUnits = computed(() => [
  t('sizeUnitB'),
  t('sizeUnitKB'),
  t('sizeUnitMB'),
  t('sizeUnitGB'),
  t('sizeUnitTB')
])

const fallbackCover = computed(
  () => `https://via.placeholder.com/300x400.png?text=${encodeURIComponent(t('noCoverPlaceholder'))}`
)

const emit = defineEmits(['metadata-updated'])
const statusOrder = ['unread', 'in_progress', 'finished']

const props = defineProps({
  manga: {
    type: Object,
    required: true
  },
  hideWishlistButton: {
    type: Boolean,
    default: false
  },
  viewMode: {
    type: String,
    default: 'grid',
    validator: value => ['grid', 'list'].includes(value)
  }
})

const isLiked = ref(!!props.manga.is_liked)
const localStatus = ref(props.manga.reading_status || 'unread')
const progressPercent = ref(props.manga.progress_percent ?? 0)
const localLastReadPage = ref(props.manga.last_read_page ?? 0)
const updatingStatus = ref(false)

watch(
  () => props.manga.is_liked,
  newVal => {
    isLiked.value = !!newVal
  }
)
watch(
  () => props.manga.reading_status,
  newVal => {
    localStatus.value = newVal || 'unread'
  }
)
watch(
  () => props.manga.progress_percent,
  newVal => {
    progressPercent.value = newVal ?? 0
  }
)
watch(
  () => props.manga.last_read_page,
  newVal => {
    localLastReadPage.value = newVal ?? 0
  }
)

const fileName = computed(() => props.manga.file_path?.split(/[\\/]/).pop() || '')
const displayName = computed(() => props.manga.display_name || fileName.value)
const folderName = computed(() => props.manga.folder_name || '')
const sanitizedTags = computed(() => props.manga.tags || [])

const normalizedProgress = computed(() => Math.min(100, Math.max(0, progressPercent.value ?? 0)))
const progressPercentDisplay = computed(() => `${Math.round(normalizedProgress.value)}%`)

const statusMetaMap = computed(() => ({
  unread: {
    label: t('statusUnread'),
    short: t('statusUnreadShort'),
    color: 'default',
    progress: '#bfbfbf'
  },
  in_progress: {
    label: t('statusInProgress'),
    short: t('statusInProgressShort'),
    color: 'orange',
    progress: '#fa8c16'
  },
  finished: {
    label: t('statusFinished'),
    short: t('statusFinishedShort'),
    color: 'green',
    progress: '#52c41a'
  }
}))

const statusMeta = computed(() => statusMetaMap.value[localStatus.value] || statusMetaMap.value.unread)
const statusButtons = computed(() =>
  statusOrder.map(value => ({
    value,
    label: statusMetaMap.value[value].short
  }))
)

const formatBytes = bytes => {
  if (!bytes) {
    return `0 ${sizeUnits.value[0]}`
  }
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizeUnits.value.length - 1)
  const size = bytes / Math.pow(1024, exponent)
  const unit = sizeUnits.value[exponent] || sizeUnits.value[sizeUnits.value.length - 1]
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${unit}`
}

const formatDateTime = isoString => {
  if (!isoString) {
    return '--'
  }
  try {
    return new Date(isoString).toLocaleString()
  } catch (_error) {
    return isoString
  }
}

const fileSizeDisplay = computed(() =>
  props.manga.file_size ? formatBytes(props.manga.file_size) : '--'
)
const lastReadDisplay = computed(() =>
  props.manga.last_read_date ? formatDateTime(props.manga.last_read_date) : t('lastReadNever')
)

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

const applyServerUpdate = payload => {
  if (!payload) {
    return
  }
  localStatus.value = payload.reading_status || localStatus.value
  progressPercent.value = payload.progress_percent ?? progressPercent.value
  localLastReadPage.value = payload.last_read_page ?? localLastReadPage.value
  isLiked.value = payload.is_liked ?? isLiked.value
  emit('metadata-updated', payload)
}

const updateStatus = async status => {
  if (updatingStatus.value || !status) {
    return
  }
  updatingStatus.value = true
  try {
    const response = await axios.post(`/api/v1/files/${props.manga.id}/status`, { status })
    applyServerUpdate(response.data)
  } catch (error) {
    console.error('Failed to update status:', error)
    message.error(t('failedToUpdateStatus'))
  } finally {
    updatingStatus.value = false
  }
}

const cycleStatus = async event => {
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

const toggleLike = async event => {
  event?.stopPropagation()
  event?.preventDefault()

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
      liked_at: isLiked.value ? new Date().toISOString() : null
    })
  } catch (error) {
    isLiked.value = originalLikedState
    console.error('Failed to update like status:', error)
    message.error(t('failedToToggleLike'))
  }
}

const likeTooltip = computed(() =>
  isLiked.value ? t('removeFromWishlist') : t('likeIt')
)
</script>

<template>
  <div v-if="viewMode === 'grid'" class="manga-card-grid">
    <a-card hoverable class="manga-card-grid__card" :bodyStyle="{ padding: '12px' }">
      <template #cover>
        <div class="manga-card-grid__cover">
          <a-image
            :src="manga.cover_url"
            :alt="displayName"
            :fallback="fallbackCover"
            :preview="false"
          />
          <a-tag
            class="manga-card-grid__status"
            :color="statusMeta.color"
            @click.stop="cycleStatus"
          >
            {{ statusMeta.label }}
          </a-tag>
          <a-tooltip v-if="!hideWishlistButton" :title="likeTooltip" placement="left">
            <a-button
              type="text"
              shape="circle"
              size="small"
              class="manga-card-grid__like"
              @click="toggleLike"
            >
              <HeartFilled v-if="isLiked" style="color: #f5222d" />
              <HeartOutlined v-else />
            </a-button>
          </a-tooltip>
        </div>
      </template>

      <a-card-meta
        :title="displayName"
        :description="folderName"
      />

      <div class="manga-card-grid__meta">
        <div class="manga-card-grid__row">
          <a-typography-text type="secondary">{{ fileSizeDisplay }}</a-typography-text>
          <a-typography-text type="secondary">{{ progressPercentDisplay }}</a-typography-text>
        </div>
        <a-progress
          :percent="normalizedProgress"
          :show-info="false"
          :stroke-color="statusMeta.progress"
        />
        <a-typography-text type="secondary" class="manga-card-grid__subtitle">
          {{ progressSummary }}
        </a-typography-text>
        <div class="manga-card-grid__row">
          <a-typography-text type="secondary">
            {{ manga.total_pages || 0 }} {{ t('pages') }}
          </a-typography-text>
          <a-typography-text type="secondary">
            {{ lastReadDisplay }}
          </a-typography-text>
        </div>
      </div>

      <div v-if="sanitizedTags.length" class="manga-card-grid__tags">
        <a-tag
          v-for="tag in sanitizedTags"
          :key="`grid-tag-${tag.id}`"
        >
          {{ tag.name }}
        </a-tag>
      </div>

      <div class="manga-card-grid__actions">
        <RouterLink :to="{ name: 'reader', params: { id: manga.id } }" custom v-slot="{ navigate }">
          <a-button type="primary" size="small" block @click="navigate">
            <template #icon>
              <ReadOutlined />
            </template>
            {{ t('read') }}
          </a-button>
        </RouterLink>
        <RouterLink :to="{ name: 'edit', params: { id: manga.id } }" custom v-slot="{ navigate }">
          <a-button size="small" block @click="navigate">
            <template #icon>
              <EditOutlined />
            </template>
            {{ t('edit') }}
          </a-button>
        </RouterLink>
      </div>
    </a-card>
  </div>
  <a-card v-else class="manga-card-list" :bodyStyle="{ padding: '16px' }">
    <a-row :gutter="16" align="middle">
      <a-col :xs="8" :sm="6" :md="5">
        <div class="manga-card-list__cover">
          <a-image
            :src="manga.cover_url"
            :alt="displayName"
            :fallback="fallbackCover"
            :preview="false"
          />
          <a-tooltip v-if="!hideWishlistButton" :title="likeTooltip">
            <a-button
              type="text"
              shape="circle"
              size="small"
              class="manga-card-list__like"
              @click="toggleLike"
            >
              <HeartFilled v-if="isLiked" style="color: #f5222d" />
              <HeartOutlined v-else />
            </a-button>
          </a-tooltip>
        </div>
      </a-col>
      <a-col :xs="16" :sm="18" :md="19">
        <div class="manga-card-list__header">
          <RouterLink
            :to="{ name: 'reader', params: { id: manga.id } }"
            class="manga-card-list__title"
          >
            {{ displayName }}
          </RouterLink>
          <a-tag
            :color="statusMeta.color"
            class="manga-card-list__status"
            @click.prevent="cycleStatus"
          >
            {{ statusMeta.label }}
          </a-tag>
        </div>
        <a-typography-text type="secondary" class="manga-card-list__folder">
          {{ folderName }}
        </a-typography-text>

        <div class="manga-card-list__progress">
          <a-progress
            :percent="normalizedProgress"
            :stroke-color="statusMeta.progress"
            size="small"
            :show-info="false"
          />
          <a-typography-text type="secondary">{{ progressPercentDisplay }}</a-typography-text>
        </div>
        <a-typography-text type="secondary" class="manga-card-list__summary">
          {{ progressSummary }}
        </a-typography-text>

        <a-space wrap size="small" class="manga-card-list__stats">
          <span>{{ t('pages') }}: {{ manga.total_pages || 0 }}</span>
          <span>{{ t('fileSizeLabel') }}: {{ fileSizeDisplay }}</span>
          <span>{{ t('lastReadAt') }}: {{ lastReadDisplay }}</span>
        </a-space>

        <div v-if="sanitizedTags.length" class="manga-card-list__tags">
          <a-tag
            v-for="tag in sanitizedTags"
            :key="`list-tag-${tag.id}`"
          >
            {{ tag.name }}
          </a-tag>
        </div>

        <div class="manga-card-list__actions">
          <RouterLink :to="{ name: 'reader', params: { id: manga.id } }" custom v-slot="{ navigate }">
            <a-button type="primary" @click="navigate">
              <template #icon>
                <ReadOutlined />
              </template>
              {{ t('read') }}
            </a-button>
          </RouterLink>
          <RouterLink :to="{ name: 'edit', params: { id: manga.id } }" custom v-slot="{ navigate }">
            <a-button @click="navigate">
              <template #icon>
                <EditOutlined />
              </template>
              {{ t('edit') }}
            </a-button>
          </RouterLink>
          <a-segmented
            class="manga-card-list__status-switcher"
            :value="localStatus"
            :options="statusButtons"
            size="small"
            :block="true"
            :disabled="updatingStatus"
            @change="value => setStatus(value)"
          />
        </div>
      </a-col>
    </a-row>
  </a-card>
</template>

<style scoped>
.manga-card-grid__card {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.manga-card-grid__cover {
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 150%;
  overflow: hidden;
  border-radius: 12px;
}

.manga-card-grid__cover :deep(.ant-image) {
  position: absolute;
  inset: 0;
}

.manga-card-grid__cover :deep(.ant-image-img),
.manga-card-list__cover :deep(.ant-image-img) {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.manga-card-grid__status {
  position: absolute;
  top: 12px;
  left: 12px;
  cursor: pointer;
}

.manga-card-grid__like {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.9);
}

.manga-card-grid__meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.manga-card-grid__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.manga-card-grid__tags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.manga-card-grid__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: auto;
}

.manga-card-list {
  width: 100%;
}

.manga-card-list__cover {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}

.manga-card-list__cover :deep(.ant-image) {
  width: 100%;
  display: block;
}

.manga-card-list__like {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.85);
}

.manga-card-list__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 8px;
}

.manga-card-list__title {
  font-size: 1.1rem;
  font-weight: 600;
  color: #1f2937;
  text-decoration: none;
}

.manga-card-list__title:hover {
  color: #1677ff;
}

.manga-card-list__status {
  cursor: pointer;
}

.manga-card-list__folder {
  display: block;
  margin-bottom: 6px;
}

.manga-card-list__progress {
  display: flex;
  align-items: center;
  gap: 12px;
}

.manga-card-list__summary {
  display: block;
  margin-top: 4px;
}

.manga-card-list__stats {
  font-size: 0.85rem;
  color: #475467;
  margin-top: 8px;
}

.manga-card-list__tags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.manga-card-list__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 12px;
}

.manga-card-list__status-switcher {
  min-width: 200px;
}
</style>
