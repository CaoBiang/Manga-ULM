<script setup>
import { computed, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import {
  HeartFilled,
  HeartOutlined,
  ReadOutlined,
  EditOutlined
} from '@ant-design/icons-vue'
import { useUiSettingsStore } from '@/store/uiSettings'
import { useAppSettingsStore } from '@/store/appSettings'

const { t } = useI18n()
const router = useRouter()

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

const uiSettingsStore = useUiSettingsStore()
const { libraryAuthorTagTypeId } = storeToRefs(uiSettingsStore)
const appSettingsStore = useAppSettingsStore()
const { libraryLazyRootMarginPx } = storeToRefs(appSettingsStore)

const visibleFields = computed(() => uiSettingsStore.fieldsForViewMode(props.viewMode))
const hasField = (key) => visibleFields.value.includes(key)
const hasAnyField = (keys) => keys.some(key => hasField(key))

const coverHost = ref(null)
const shouldLoadCover = ref(false)
let coverObserver = null

const teardownCoverObserver = () => {
  if (coverObserver) {
    coverObserver.disconnect()
    coverObserver = null
  }
}

const setupCoverObserver = () => {
  if (shouldLoadCover.value) {
    return
  }
  teardownCoverObserver()

  if (!coverHost.value) {
    return
  }
  if (!('IntersectionObserver' in window)) {
    shouldLoadCover.value = true
    return
  }

  coverObserver = new IntersectionObserver(
    entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        shouldLoadCover.value = true
        teardownCoverObserver()
      }
    },
    { rootMargin: `${libraryLazyRootMarginPx.value}px 0px` }
  )
  coverObserver.observe(coverHost.value)
}

const isLiked = ref(!!props.manga.is_liked)
const localStatus = ref(props.manga.reading_status || 'unread')
const progressPercent = ref(props.manga.progress_percent ?? 0)
const localLastReadPage = ref(props.manga.last_read_page ?? 0)
const updatingStatus = ref(false)

onMounted(() => nextTick(() => setupCoverObserver()))
onBeforeUnmount(() => teardownCoverObserver())

watch(
  () => props.viewMode,
  () => nextTick(() => setupCoverObserver())
)
watch(
  () => props.manga.cover_url,
  () => {
    shouldLoadCover.value = false
    nextTick(() => setupCoverObserver())
  }
)

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
const addedAtDisplay = computed(() =>
  props.manga.add_date ? formatDateTime(props.manga.add_date) : '--'
)
const likedAtDisplay = computed(() =>
  props.manga.liked_at ? formatDateTime(props.manga.liked_at) : '--'
)

const authorNames = computed(() => {
  const typeId = libraryAuthorTagTypeId.value
  if (!typeId) {
    return []
  }
  return sanitizedTags.value
    .filter(tag => tag.type_id === typeId)
    .map(tag => tag.name)
    .filter(Boolean)
})
const authorsDisplay = computed(() => authorNames.value.slice(0, 4).join(' / '))

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
    console.error('更新阅读状态失败：', error)
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
    console.error('更新喜欢状态失败：', error)
    message.error(t('failedToToggleLike'))
  }
}

const openReader = () => {
  router.push({ name: 'reader', params: { id: props.manga.id } })
}

const openEdit = (event) => {
  event?.stopPropagation()
  event?.preventDefault()
  router.push({ name: 'edit', params: { id: props.manga.id } })
}
</script>

<template>
  <div v-if="viewMode === 'grid'" class="manga-card-grid">
    <a-card
      hoverable
      class="manga-card-grid__card"
      :bodyStyle="{ padding: '12px' }"
      @click="openReader"
    >
      <template #cover>
        <div ref="coverHost" class="manga-card-grid__cover">
          <a-image
            v-if="shouldLoadCover"
            :src="manga.cover_url"
            :alt="displayName"
            :fallback="fallbackCover"
            :preview="false"
          />
          <div v-else class="manga-card-cover__placeholder"></div>
          <a-tag
            v-if="hasField('reading_status_tag')"
            class="manga-card-grid__status"
            :color="statusMeta.color"
            @click.stop="cycleStatus"
          >
            {{ statusMeta.label }}
          </a-tag>
          <a-button
            v-if="!hideWishlistButton"
            type="text"
            shape="circle"
            size="small"
            class="manga-card-grid__like"
            @click="toggleLike"
          >
            <HeartFilled v-if="isLiked" style="color: #f5222d" />
            <HeartOutlined v-else />
          </a-button>
          <div class="manga-card-grid__cover-edit">
            <a-button type="primary" size="small" block @click="openEdit">
              <template #icon>
                <EditOutlined />
              </template>
              {{ t('edit') }}
            </a-button>
          </div>
        </div>
      </template>

      <a-card-meta
        :title="displayName"
        :description="hasField('folder_name') ? folderName : ''"
      />

      <div class="manga-card-grid__meta">
        <div v-if="hasAnyField(['file_size', 'progress_percent'])" class="manga-card-grid__row">
          <a-typography-text v-if="hasField('file_size')" type="secondary">
            {{ fileSizeDisplay }}
          </a-typography-text>
          <a-typography-text v-if="hasField('progress_percent')" type="secondary">
            {{ progressPercentDisplay }}
          </a-typography-text>
        </div>

        <a-progress
          v-if="hasField('progress_bar')"
          :percent="normalizedProgress"
          :show-info="false"
          :stroke-color="statusMeta.progress"
        />

        <a-typography-text
          v-if="hasField('progress_summary')"
          type="secondary"
          class="manga-card-grid__subtitle"
        >
          {{ progressSummary }}
        </a-typography-text>

        <a-typography-text v-if="hasField('authors') && authorsDisplay" type="secondary" class="manga-card-grid__subtitle">
          {{ t('authorsLabel') }}: {{ authorsDisplay }}
        </a-typography-text>

        <a-typography-text v-if="hasField('add_date')" type="secondary" class="manga-card-grid__subtitle">
          {{ t('addedAtLabel') }}: {{ addedAtDisplay }}
        </a-typography-text>

        <a-typography-text v-if="hasField('liked_at') && manga.is_liked" type="secondary" class="manga-card-grid__subtitle">
          {{ t('likedAtLabel') }}: {{ likedAtDisplay }}
        </a-typography-text>

        <div v-if="hasAnyField(['total_pages', 'last_read_date'])" class="manga-card-grid__row">
          <a-typography-text v-if="hasField('total_pages')" type="secondary">
            {{ manga.total_pages || 0 }} {{ t('pages') }}
          </a-typography-text>
          <a-typography-text v-if="hasField('last_read_date')" type="secondary">
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
    </a-card>
  </div>
  <a-card v-else class="manga-card-list" :bodyStyle="{ padding: '16px' }">
    <a-row :gutter="16" align="middle">
      <a-col :xs="8" :sm="6" :md="5">
        <div ref="coverHost" class="manga-card-list__cover">
          <a-image
            v-if="shouldLoadCover"
            :src="manga.cover_url"
            :alt="displayName"
            :fallback="fallbackCover"
            :preview="false"
          />
          <div v-else class="manga-card-cover__placeholder"></div>
          <a-button
            v-if="!hideWishlistButton"
            type="text"
            shape="circle"
            size="small"
            class="manga-card-list__like"
            @click="toggleLike"
          >
            <HeartFilled v-if="isLiked" style="color: #f5222d" />
            <HeartOutlined v-else />
          </a-button>
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
            v-if="hasField('reading_status_tag')"
            :color="statusMeta.color"
            class="manga-card-list__status"
            @click.prevent="cycleStatus"
          >
            {{ statusMeta.label }}
          </a-tag>
        </div>
        <a-typography-text v-if="hasField('folder_name')" type="secondary" class="manga-card-list__folder">
          {{ folderName }}
        </a-typography-text>

        <div v-if="hasAnyField(['progress_bar', 'progress_percent'])" class="manga-card-list__progress">
          <a-progress
            v-if="hasField('progress_bar')"
            :percent="normalizedProgress"
            :stroke-color="statusMeta.progress"
            size="small"
            :show-info="false"
          />
          <a-typography-text v-if="hasField('progress_percent')" type="secondary">
            {{ progressPercentDisplay }}
          </a-typography-text>
        </div>
        <a-typography-text v-if="hasField('progress_summary')" type="secondary" class="manga-card-list__summary">
          {{ progressSummary }}
        </a-typography-text>

        <a-typography-text v-if="hasField('authors') && authorsDisplay" type="secondary">
          {{ t('authorsLabel') }}: {{ authorsDisplay }}
        </a-typography-text>

        <a-space v-if="hasAnyField(['total_pages', 'file_size', 'last_read_date', 'add_date', 'liked_at'])" wrap size="small" class="manga-card-list__stats">
          <span v-if="hasField('total_pages')">{{ t('pages') }}: {{ manga.total_pages || 0 }}</span>
          <span v-if="hasField('file_size')">{{ t('fileSizeLabel') }}: {{ fileSizeDisplay }}</span>
          <span v-if="hasField('last_read_date')">{{ t('lastReadAt') }}: {{ lastReadDisplay }}</span>
          <span v-if="hasField('add_date')">{{ t('addedAtLabel') }}: {{ addedAtDisplay }}</span>
          <span v-if="hasField('liked_at') && manga.is_liked">{{ t('likedAtLabel') }}: {{ likedAtDisplay }}</span>
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

.manga-card-grid__cover-edit {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  opacity: 0;
  transform: translateY(6px);
  pointer-events: none;

  transition: opacity 160ms ease, transform 160ms ease;
}

.manga-card-grid__cover:hover .manga-card-grid__cover-edit {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}

.manga-card-grid__cover-edit :deep(.ant-btn) {
  background: rgba(0, 0, 0, 0.55);
  border-color: rgba(255, 255, 255, 0.25);
  color: #fff;
}

.manga-card-grid__cover-edit :deep(.ant-btn:hover) {
  background: rgba(0, 0, 0, 0.65);
  border-color: rgba(255, 255, 255, 0.38);
  color: #fff;
}

.manga-card-cover__placeholder {
  position: absolute;
  inset: 0;
  background: #f2f4f7;
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

.manga-card-grid__like:hover,
.manga-card-grid__like:focus {
  background: rgba(255, 255, 255, 0.9) !important;
}

.manga-card-grid__like:hover :deep(.anticon) {
  color: #f5222d;
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

.manga-card-list {
  width: 100%;
}

.manga-card-list__cover {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
  width: 100%;
  aspect-ratio: 3 / 4;
}

.manga-card-list__cover :deep(.ant-image) {
  position: absolute;
  inset: 0;
}

.manga-card-list__like {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(255, 255, 255, 0.85);
}

.manga-card-list__like:hover,
.manga-card-list__like:focus {
  background: rgba(255, 255, 255, 0.85) !important;
}

.manga-card-list__like:hover :deep(.anticon) {
  color: #f5222d;
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
