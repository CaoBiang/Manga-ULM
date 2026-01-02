<template>
  <div class="reader-view" @click="collapseToolbar">
    <div class="reader-view__top">
      <a-button type="primary" shape="round" size="large" @click.stop="router.back()">
        <template #icon>
          <ArrowLeftOutlined />
        </template>
        {{ $t('backToLibrary') }}
      </a-button>
      <a-tag v-if="isCurrentPageSpread" color="purple">
        {{ $t('spread') }}
      </a-tag>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="error" class="reader-view__alert" />

    <div v-else-if="isLoading" class="reader-view__spinner">
      <a-spin size="large" :tip="$t('loading')" />
    </div>

    <div v-else class="reader-view__canvas" @click="collapseToolbar">
      <img
        ref="imageRef"
        :src="imageUrl"
        :alt="`${$t('page')} ${currentPage + 1}`"
        :class="imageClass"
        :style="imageStyles"
        @load="onImageLoad"
      />
      <div class="reader-view__nav reader-view__nav--left" @click.stop="prevPage"></div>
      <div class="reader-view__nav reader-view__nav--right" @click.stop="nextPage"></div>
    </div>

    <div class="reader-view__toolbar" @click.stop>
      <transition name="toolbar">
        <div
          v-if="!isToolbarExpanded"
          class="reader-view__toolbar-collapsed"
          @click="expandToolbar"
        >
          <a-typography-text strong class="reader-view__toolbar-progress">
            {{ currentPage + 1 }} / {{ totalPages }}
          </a-typography-text>
        </div>
        <a-card
          v-else
          class="reader-view__toolbar-card"
          :bodyStyle="{ padding: '12px', background: 'rgba(0,0,0,0.75)' }"
          :bordered="false"
        >
          <div class="reader-view__toolbar-top">
            <a-slider
              v-model:value="currentPage"
              :min="0"
              :max="totalPages > 0 ? totalPages - 1 : 0"
              :tooltip-open="false"
              @afterChange="jumpToPage"
            />
            <a-typography-text strong class="reader-view__page-indicator">
              {{ currentPage + 1 }} / {{ totalPages }}
            </a-typography-text>
            <a-space>
              <a-tooltip :title="$t('toggleSplitView')">
                <a-button
                  shape="circle"
                  :type="isPagingEnabled ? 'primary' : 'default'"
                  @click.stop="togglePagingMode"
                >
                  <ColumnWidthOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip :title="$t('bookmarks')">
                <a-button
                  shape="circle"
                  :type="activePanel === 'bookmarks' ? 'primary' : 'default'"
                  @click.stop="togglePanel('bookmarks')"
                >
                  <UnorderedListOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip :title="$t('addBookmark')">
                <a-button
                  shape="circle"
                  :type="activePanel === 'addBookmark' || isCurrentPageBookmarked ? 'primary' : 'default'"
                  @click.stop="handleBookmarkButtonClick"
                >
                  <PlusOutlined />
                </a-button>
              </a-tooltip>
              <a-tooltip :title="$t('fileInfo')">
                <a-button
                  shape="circle"
                  :type="activePanel === 'fileInfo' ? 'primary' : 'default'"
                  @click.stop="togglePanel('fileInfo')"
                >
                  <InfoCircleOutlined />
                </a-button>
              </a-tooltip>
            </a-space>
          </div>

          <transition name="fade">
            <div v-if="activePanel" class="reader-view__panel">
              <div v-if="activePanel === 'addBookmark'" class="reader-view__panel-section">
                <a-typography-text type="secondary">
                  {{ $t('addBookmarkPrompt', { page: currentPage + 1 }) }}
                </a-typography-text>
                <a-input
                  ref="bookmarkNameInputRef"
                  v-model:value="newBookmarkName"
                  :placeholder="$t('bookmarkNamePlaceholder')"
                  @pressEnter="saveNewBookmark"
                  class="reader-view__bookmark-input"
                />
                <a-space align="center" class="reader-view__panel-actions">
                  <a-button @click="activePanel = ''">{{ $t('cancel') }}</a-button>
                  <a-button type="primary" @click="saveNewBookmark">{{ $t('save') }}</a-button>
                </a-space>
              </div>
              <div v-else-if="activePanel === 'bookmarks'" class="reader-view__panel-section">
                <a-list
                  :data-source="bookmarks"
                  size="small"
                  bordered
                  :locale="{ emptyText: $t('noBookmarks') }"
                >
                  <template #renderItem="{ item }">
                    <a-list-item class="reader-view__bookmark-item">
                      <div
                        class="reader-view__bookmark-info"
                        @click="jumpToBookmark(item.page_number)"
                      >
                        <strong>{{ $t('page') }} {{ item.page_number + 1 }}</strong>
                        <span v-if="item.note" class="reader-view__bookmark-note">{{ item.note }}</span>
                      </div>
                      <a-button type="link" danger size="small" @click.stop="deleteBookmark(item.id)">
                        {{ $t('remove') }}
                      </a-button>
                    </a-list-item>
                  </template>
                </a-list>
              </div>
              <div v-else-if="activePanel === 'fileInfo'" class="reader-view__panel-section">
                <a-spin :spinning="fileInfo.loading">
                  <a-result
                    v-if="fileInfo.error"
                    status="warning"
                    :title="$t('failedToLoadFileInfo')"
                    :sub-title="fileInfo.error"
                  >
                    <template #extra>
                      <a-button type="primary" size="small" @click="fetchFileInfo">
                        {{ $t('retry') }}
                      </a-button>
                    </template>
                  </a-result>
                  <a-descriptions v-else-if="fileInfo.data" size="small" :column="1" bordered>
                    <a-descriptions-item :label="$t('mangaFile')">
                      <div>{{ fileInfo.data.manga_filename }}</div>
                      <a-typography-text type="secondary">
                        {{ formatBytes(fileInfo.data.manga_filesize) }}
                      </a-typography-text>
                    </a-descriptions-item>
                    <a-descriptions-item :label="$t('currentPageFile')">
                      <div>{{ fileInfo.data.page_filename }}</div>
                      <a-typography-text type="secondary">
                        {{ formatBytes(fileInfo.data.page_filesize) }}
                      </a-typography-text>
                    </a-descriptions-item>
                  </a-descriptions>
                </a-spin>
              </div>
            </div>
          </transition>
        </a-card>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import {
  ArrowLeftOutlined,
  ColumnWidthOutlined,
  UnorderedListOutlined,
  PlusOutlined,
  InfoCircleOutlined
} from '@ant-design/icons-vue'
import { storeToRefs } from 'pinia'
import { useAppSettingsStore } from '@/store/appSettings'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const appSettingsStore = useAppSettingsStore()
const { readerPreloadAhead, readerSplitDefaultEnabled, readerWideRatioThreshold } = storeToRefs(appSettingsStore)

const fileId = route.params.id
const currentPage = ref(0)
const totalPages = ref(0)
const spreadPages = ref([])
const isLoading = ref(true)
const error = ref(null)
const isToolbarExpanded = ref(false)
const bookmarks = ref([])
const newBookmarkName = ref('')
const bookmarkNameInputRef = ref(null)
const activePanel = ref('')
const fileInfo = ref({
  loading: false,
  error: null,
  data: null
})
const imageRef = ref(null)

const sizeUnits = computed(() => [
  t('sizeUnitB'),
  t('sizeUnitKB'),
  t('sizeUnitMB'),
  t('sizeUnitGB'),
  t('sizeUnitTB')
])

const isPagingEnabled = ref(!!readerSplitDefaultEnabled.value)
const isCurrentImageWide = ref(false)
const showRightHalf = ref(false)

const shouldShowSplitView = computed(() => isPagingEnabled.value && isCurrentImageWide.value)

const imageClass = computed(() => [
  'reader-view__image',
  { 'reader-view__image--split': shouldShowSplitView.value }
])

const imageStyles = computed(() => {
  if (!shouldShowSplitView.value || !imageRef.value) {
    return { transform: 'translateX(0)' }
  }
  const imageWidth = imageRef.value.offsetWidth
  const translateX = showRightHalf.value ? -imageWidth * 0.25 : imageWidth * 0.25
  return { transform: `translateX(${translateX}px)` }
})

const onImageLoad = event => {
  const img = event.target
  const ratio = img.naturalHeight > 0 ? img.naturalWidth / img.naturalHeight : 1
  isCurrentImageWide.value = ratio >= (readerWideRatioThreshold.value || 1.0)
}

const togglePagingMode = () => {
  isPagingEnabled.value = !isPagingEnabled.value
  showRightHalf.value = false
}

const imageUrl = computed(() => {
  if (!totalPages.value) {
    return ''
  }
  return `/api/v1/files/${fileId}/page/${currentPage.value}`
})

const isCurrentPageSpread = computed(() => spreadPages.value.includes(currentPage.value))
const isCurrentPageBookmarked = computed(() =>
  bookmarks.value.some(b => b.page_number === currentPage.value)
)

const preloadedImages = ref({})

const preloadImages = () => {
  const ahead = readerPreloadAhead.value || 0
  for (let i = 1; i <= ahead; i += 1) {
    const pageToLoad = currentPage.value + i
    if (pageToLoad < totalPages.value && !preloadedImages.value[pageToLoad]) {
      const img = new Image()
      img.src = `/api/v1/files/${fileId}/page/${pageToLoad}`
      preloadedImages.value[pageToLoad] = img
    }
  }
}

watch(currentPage, (newPage, oldPage) => {
  preloadImages()
  debouncedUpdateProgress()
  showRightHalf.value = false

  if (activePanel.value) {
    activePanel.value = ''
  }

  if (fileInfo.value.data && newPage !== oldPage) {
    fileInfo.value.data = null
  }
})

const debounce = (func, delay) => {
  let timeoutId
  const debounced = (...args) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => {
      func.apply(this, args)
    }, delay)
  }
  debounced.flush = () => {
    clearTimeout(timeoutId)
    func()
  }
  return debounced
}

const updateProgress = async () => {
  try {
    await axios.post(`/api/v1/files/${fileId}/progress`, { page: currentPage.value })
  } catch (err) {
    console.error('Failed to save progress:', err)
  }
}

const debouncedUpdateProgress = debounce(updateProgress, 1500)

const fetchMangaDetails = async () => {
  try {
    const response = await axios.get(`/api/v1/files/${fileId}`)
    const fileData = response.data
    if (!fileData) {
      throw new Error(t('mangaNotFound'))
    }
    totalPages.value = fileData.total_pages
    currentPage.value = fileData.last_read_page || 0
    try {
      spreadPages.value = JSON.parse(fileData.spread_pages || '[]')
    } catch (err) {
      console.error('Failed to parse spread_pages', err)
      spreadPages.value = []
    }
    preloadImages()
  } catch (err) {
    console.error('Failed to fetch manga details:', err)
    error.value = t('failedToLoadMangaDetails')
  } finally {
    isLoading.value = false
  }
}

const fetchBookmarks = async () => {
  try {
    const response = await axios.get(`/api/v1/files/${fileId}/bookmarks`)
    bookmarks.value = response.data
  } catch (err) {
    console.error('Failed to fetch bookmarks:', err)
    bookmarks.value = []
    message.error(t('failedToFetchBookmarks'))
  }
}

const handleBookmarkButtonClick = () => {
  if (!isToolbarExpanded.value) {
    isToolbarExpanded.value = true
  }
  newBookmarkName.value = ''
  activePanel.value = 'addBookmark'
  nextTick(() => {
    bookmarkNameInputRef.value?.focus()
  })
}

const saveNewBookmark = async () => {
  if (!isToolbarExpanded.value) {
    return
  }
  try {
    await axios.post(`/api/v1/files/${fileId}/bookmarks`, {
      page: currentPage.value,
      note: newBookmarkName.value || null
    })
    newBookmarkName.value = ''
    activePanel.value = ''
    fetchBookmarks()
    message.success(t('bookmarkSaved'))
  } catch (err) {
    console.error('Error saving bookmark:', err)
    message.error(t('failedToSaveBookmark'))
  }
}

const deleteBookmark = async bookmarkId => {
  try {
    await axios.delete(`/api/v1/bookmarks/${bookmarkId}`)
    fetchBookmarks()
  } catch (err) {
    console.error('Failed to delete bookmark:', err)
    message.error(t('failedToDeleteBookmark'))
  }
}

const jumpToBookmark = page => {
  currentPage.value = page
  activePanel.value = ''
}

const nextPage = () => {
  if (shouldShowSplitView.value && !showRightHalf.value) {
    showRightHalf.value = true
  } else if (currentPage.value < totalPages.value - 1) {
    currentPage.value += 1
  }
}

const prevPage = () => {
  if (shouldShowSplitView.value && showRightHalf.value) {
    showRightHalf.value = false
  } else if (currentPage.value > 0) {
    currentPage.value -= 1
  }
}

const jumpToPage = page => {
  const target = Array.isArray(page) ? page[0] : page
  currentPage.value = parseInt(target, 10)
}

const handleKeydown = e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return
  }
  if (e.key === 'ArrowLeft') {
    prevPage()
  } else if (e.key === 'ArrowRight') {
    nextPage()
  } else if (e.key.toLowerCase() === 'b') {
    handleBookmarkButtonClick()
  } else if (e.key.toLowerCase() === 'f') {
    togglePanel('fileInfo')
  } else if (e.key.toLowerCase() === 'l') {
    togglePanel('bookmarks')
  } else if (e.key.toLowerCase() === 'p') {
    togglePagingMode()
  } else if (e.key === 'Escape') {
    if (activePanel.value) {
      activePanel.value = ''
    } else if (isToolbarExpanded.value) {
      collapseToolbar()
    } else {
      router.back()
    }
  }
}

const togglePanel = panel => {
  if (!isToolbarExpanded.value) {
    isToolbarExpanded.value = true
  }
  if (activePanel.value === panel) {
    activePanel.value = ''
    return
  }
  activePanel.value = panel
  if (panel === 'bookmarks') {
    fetchBookmarks()
  } else if (panel === 'fileInfo') {
    fetchFileInfo()
  }
}

const fetchFileInfo = async () => {
  if (!isToolbarExpanded.value) {
    return
  }
  fileInfo.value.loading = true
  fileInfo.value.error = null
  try {
    const response = await axios.get(`/api/v1/files/${fileId}/page/${currentPage.value}/details`)
    fileInfo.value.data = response.data
  } catch (err) {
    console.error('Failed to fetch file info:', err)
    fileInfo.value.error = t('failedToLoadFileInfo')
  } finally {
    fileInfo.value.loading = false
  }
}

const formatBytes = (bytes, decimals = 2) => {
  if (!bytes) {
    return `0 ${sizeUnits.value[0]}`
  }
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
  const unit = sizeUnits.value[i] || sizeUnits.value[sizeUnits.value.length - 1]
  return `${value} ${unit}`
}

const expandToolbar = () => {
  isToolbarExpanded.value = true
}

const collapseToolbar = () => {
  activePanel.value = ''
  isToolbarExpanded.value = false
}

onMounted(() => {
  fetchMangaDetails()
  fetchBookmarks()
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  debouncedUpdateProgress.flush()
})
</script>

<style scoped>
.reader-view {
  position: fixed;
  inset: 0;
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.reader-view__top {
  position: absolute;
  top: 24px;
  left: 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 10;
}

.reader-view__alert {
  position: absolute;
  top: 24px;
  right: 24px;
  max-width: 320px;
}

.reader-view__spinner {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.reader-view__canvas {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.reader-view__image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  transition: transform 0.3s ease;
}

.reader-view__image--split {
  height: 100%;
  width: auto;
  max-width: none;
}

.reader-view__nav {
  position: absolute;
  top: 0;
  width: 30%;
  height: 100%;
  cursor: pointer;
}

.reader-view__nav--left {
  left: 0;
}

.reader-view__nav--right {
  right: 0;
}

.reader-view__toolbar {
  position: absolute;
  bottom: 32px;
  left: 50%;
  transform: translateX(-50%);
  width: min(900px, 90%);
}

.reader-view__toolbar-collapsed {
  background: rgba(0, 0, 0, 0.65);
  border-radius: 999px;
  padding: 6px 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.reader-view__toolbar-progress {
  color: rgba(255, 255, 255, 0.9);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  user-select: none;
}

.reader-view__toolbar-card {
  border-radius: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
  color: #fff;
}

.reader-view__toolbar-top {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reader-view__page-indicator {
  color: #fff;
}

.reader-view__panel {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.2);
}

.reader-view__panel-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reader-view__bookmark-input :deep(.ant-input) {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.reader-view__panel-actions {
  justify-content: flex-end;
}

.reader-view__bookmark-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.reader-view__bookmark-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  cursor: pointer;
}

.reader-view__bookmark-note {
  color: rgba(255, 255, 255, 0.65);
  font-size: 0.85rem;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.toolbar-enter-active,
.toolbar-leave-active {
  transition: all 0.2s ease-out;
}

.toolbar-enter-from,
.toolbar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
