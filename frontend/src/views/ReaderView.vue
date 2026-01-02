<template>
  <div class="reader-view" :style="toolbarStyleVars">
    <div class="reader-view__top">
      <ReaderButton
        variant="default"
        shape="circle"
        size="lg"
        class="reader-view__back-button reader-view__glass-control"
        :aria-label="$t('back')"
        @click.stop="router.back()"
      >
        <template #icon>
          <ArrowLeftOutlined />
        </template>
      </ReaderButton>
      <a-tag v-if="isCurrentPageSpread" color="purple">
        {{ $t('spread') }}
      </a-tag>
    </div>

    <a-alert v-if="error" type="error" show-icon :message="error" class="reader-view__alert" />

    <div v-else-if="isLoading" class="reader-view__spinner">
      <a-spin size="large" :tip="$t('loading')" />
    </div>

    <div v-else class="reader-view__canvas" @click="handleCanvasClick">
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
      <div
        class="reader-view__toolbar-shell"
        :class="{ 'is-expanded': isToolbarExpanded }"
        :style="toolbarStyleVars"
        @click="handleToolbarShellClick"
      >
        <div class="reader-view__toolbar-slider-row" :aria-hidden="!isToolbarExpanded">
          <a-slider
            v-model:value="currentPage"
            :min="0"
            :max="totalPages > 0 ? totalPages - 1 : 0"
            :tooltip-open="false"
            :disabled="!isToolbarExpanded"
            @afterChange="jumpToPage"
          />
        </div>

        <div class="reader-view__toolbar-controls-row">
          <span ref="pageIndicatorRef" class="reader-view__toolbar-page-indicator">
            <a-typography-text strong class="reader-view__toolbar-page-indicator-text">
              {{ currentPage + 1 }} / {{ totalPages }}
            </a-typography-text>
          </span>

          <div class="reader-view__toolbar-actions-wrap" :aria-hidden="!isToolbarExpanded">
            <div class="reader-view__toolbar-actions">
              <a-tooltip :title="$t('toggleSplitView')">
                <ReaderButton
                  shape="circle"
                  :active="isPagingEnabled"
                  class="reader-view__toolbar-action reader-view__glass-control"
                  :aria-label="$t('toggleSplitView')"
                  @click.stop="togglePagingMode"
                >
                  <ColumnWidthOutlined />
                </ReaderButton>
              </a-tooltip>
              <a-tooltip :title="$t('bookmarks')">
                <ReaderButton
                  shape="circle"
                  :active="activePanel === 'bookmarks'"
                  class="reader-view__toolbar-action reader-view__glass-control"
                  :aria-label="$t('bookmarks')"
                  @click.stop="togglePanel('bookmarks')"
                >
                  <UnorderedListOutlined />
                </ReaderButton>
              </a-tooltip>
              <a-tooltip :title="$t('addBookmark')">
                <ReaderButton
                  shape="circle"
                  :active="activePanel === 'addBookmark'"
                  class="reader-view__toolbar-action reader-view__glass-control"
                  :aria-label="$t('addBookmark')"
                  @click.stop="handleBookmarkButtonClick"
                >
                  <PlusOutlined />
                </ReaderButton>
              </a-tooltip>
              <a-tooltip :title="$t('fileInfo')">
                <ReaderButton
                  shape="circle"
                  :active="activePanel === 'fileInfo'"
                  class="reader-view__toolbar-action reader-view__glass-control"
                  :aria-label="$t('fileInfo')"
                  @click.stop="togglePanel('fileInfo')"
                >
                  <InfoCircleOutlined />
                </ReaderButton>
              </a-tooltip>
            </div>
          </div>
        </div>

        <transition name="panel">
          <div v-if="activePanel" class="reader-view__panel">
            <div v-if="activePanel === 'addBookmark'" class="reader-view__panel-section">
              <ReaderInput
                ref="bookmarkNoteInputRef"
                v-model="newBookmarkNote"
                :placeholder="$t('bookmarkNotePlaceholder')"
                @pressEnter="saveNewBookmark"
                class="reader-view__bookmark-input"
              />
              <div class="reader-view__panel-actions">
                <ReaderButton variant="ghost" @click="activePanel = ''">
                  {{ $t('cancel') }}
                </ReaderButton>
                <ReaderButton variant="primary" @click="saveNewBookmark">
                  {{ $t('save') }}
                </ReaderButton>
              </div>
            </div>
            <div v-else-if="activePanel === 'bookmarks'" class="reader-view__panel-section">
              <ReaderTable
                :columns="bookmarkColumns"
                :data-source="bookmarks"
                :row-key="record => record.id"
                :custom-row="bookmarkRowProps"
                :empty-text="$t('noBookmarks')"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'page'">
                    <strong>{{ $t('page') }} {{ record.page_number + 1 }}</strong>
                  </template>
                  <template v-else-if="column.key === 'note'">
                    <span class="reader-view__table-note">
                      {{ record.note || '--' }}
                    </span>
                  </template>
                  <template v-else-if="column.key === 'action'">
                    <ReaderButton
                      variant="danger"
                      shape="circle"
                      size="sm"
                      class="reader-view__bookmark-delete"
                      :aria-label="$t('delete')"
                      @click.stop="deleteBookmark(record.id)"
                    >
                      <DeleteOutlined />
                    </ReaderButton>
                  </template>
                </template>
              </ReaderTable>
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
                    <ReaderButton variant="primary" size="sm" @click="fetchFileInfo">
                      {{ $t('retry') }}
                    </ReaderButton>
                  </template>
                </a-result>
                <ReaderTable
                  v-else-if="fileInfo.data"
                  :columns="fileInfoColumns"
                  :data-source="fileInfoRows"
                  :row-key="record => record.key"
                  :show-header="false"
                >
                  <template #bodyCell="{ column, record }">
                    <template v-if="column.key === 'label'">
                      <strong>{{ record.label }}</strong>
                    </template>
                    <template v-else-if="column.key === 'value'">
                      <div class="reader-view__fileinfo-value">
                        <div>{{ record.filename }}</div>
                        <a-typography-text type="secondary">
                          {{ record.filesize }}
                        </a-typography-text>
                      </div>
                    </template>
                  </template>
                </ReaderTable>
              </a-spin>
          </div>
        </div>
      </transition>
      </div>
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
  InfoCircleOutlined,
  DeleteOutlined
} from '@ant-design/icons-vue'
import { storeToRefs } from 'pinia'
import { useAppSettingsStore } from '@/store/appSettings'
import ReaderTable from '@/components/reader/ReaderTable.vue'
import ReaderButton from '@/components/reader/ui/ReaderButton.vue'
import ReaderInput from '@/components/reader/ui/ReaderInput.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const appSettingsStore = useAppSettingsStore()
const {
  readerPreloadAhead,
  readerSplitDefaultEnabled,
  readerWideRatioThreshold,
  readerToolbarAnimationMs,
  readerToolbarBackgroundOpacity,
  readerToolbarCenterClickToggleEnabled,
  readerUiBlurEnabled,
  readerUiBlurRadiusPx,
  readerUiControlBgOpacity,
  readerUiControlBorderOpacity
} = storeToRefs(appSettingsStore)

const fileId = route.params.id
const currentPage = ref(0)
const totalPages = ref(0)
const spreadPages = ref([])
const isLoading = ref(true)
const error = ref(null)
const isToolbarExpanded = ref(false)
const bookmarks = ref([])
const newBookmarkNote = ref('')
const bookmarkNoteInputRef = ref(null)
const activePanel = ref('')
const pageIndicatorRef = ref(null)
const fileInfo = ref({
  loading: false,
  error: null,
  data: null
})
const imageRef = ref(null)

const bookmarkColumns = computed(() => [
  {
    title: t('page'),
    dataIndex: 'page_number',
    key: 'page',
    width: 110
  },
  {
    title: t('noteOptional'),
    dataIndex: 'note',
    key: 'note'
  },
  {
    title: '',
    key: 'action',
    width: 56,
    align: 'center'
  }
])

const bookmarkRowProps = record => ({
  onClick: () => jumpToBookmark(record.page_number)
})

const fileInfoColumns = computed(() => [
  { title: '', dataIndex: 'label', key: 'label', width: 140 },
  { title: '', dataIndex: 'value', key: 'value' }
])

const fileInfoRows = computed(() => {
  if (!fileInfo.value.data) {
    return []
  }
  return [
    {
      key: 'manga',
      label: t('mangaFile'),
      filename: fileInfo.value.data.manga_filename,
      filesize: formatBytes(fileInfo.value.data.manga_filesize)
    },
    {
      key: 'page',
      label: t('currentPageFile'),
      filename: fileInfo.value.data.page_filename,
      filesize: formatBytes(fileInfo.value.data.page_filesize)
    }
  ]
})

const sizeUnits = computed(() => [
  t('sizeUnitB'),
  t('sizeUnitKB'),
  t('sizeUnitMB'),
  t('sizeUnitGB'),
  t('sizeUnitTB')
])

const normalizeToolbarAnimationMs = computed(() => {
  const parsed = Number.parseInt(String(readerToolbarAnimationMs.value ?? 240), 10)
  if (Number.isNaN(parsed)) {
    return 240
  }
  return Math.min(600, Math.max(120, parsed))
})

const normalizeToolbarBackgroundOpacity = computed(() => {
  const parsed = Number.parseFloat(String(readerToolbarBackgroundOpacity.value ?? 0.28))
  if (Number.isNaN(parsed)) {
    return 0.28
  }
  return Math.min(0.8, Math.max(0.08, parsed))
})

const normalizeReaderUiBlurRadiusPx = computed(() => {
  const parsed = Number.parseInt(String(readerUiBlurRadiusPx.value ?? 12), 10)
  if (Number.isNaN(parsed)) {
    return 12
  }
  return Math.min(30, Math.max(0, parsed))
})

const normalizeReaderUiControlBgOpacity = computed(() => {
  const parsed = Number.parseFloat(String(readerUiControlBgOpacity.value ?? 0.46))
  if (Number.isNaN(parsed)) {
    return 0.46
  }
  return Math.min(0.7, Math.max(0.12, parsed))
})

const normalizeReaderUiControlBorderOpacity = computed(() => {
  const parsed = Number.parseFloat(String(readerUiControlBorderOpacity.value ?? 0.16))
  if (Number.isNaN(parsed)) {
    return 0.16
  }
  return Math.min(0.4, Math.max(0.06, parsed))
})

const toolbarStyleVars = computed(() => {
  const ms = normalizeToolbarAnimationMs.value
  const bgOpacity = normalizeReaderUiControlBgOpacity.value
  const borderOpacity = normalizeReaderUiControlBorderOpacity.value
  const bgHover = Math.min(0.94, bgOpacity + 0.1)
  const bgActive = Math.min(0.96, bgOpacity + 0.14)
  const borderHover = Math.min(0.6, borderOpacity + 0.06)

  const toolbarBgOpacity = normalizeToolbarBackgroundOpacity.value
  const toolbarBgHoverOpacity = Math.min(0.95, toolbarBgOpacity + 0.08)
  const toolbarBgActiveOpacity = Math.min(0.98, toolbarBgOpacity + 0.12)
  const toolbarBorderOpacity = Math.min(0.32, borderOpacity + 0.02)
  const toolbarBorderHoverOpacity = Math.min(0.42, toolbarBorderOpacity + 0.08)
  const toolbarControlBgOpacity = Math.min(0.36, Math.max(0.12, toolbarBgOpacity - 0.06))
  const toolbarControlBgHoverOpacity = Math.min(0.46, toolbarControlBgOpacity + 0.1)
  const toolbarControlBgActiveOpacity = Math.min(0.54, toolbarControlBgOpacity + 0.18)

  const blurEnabled = readerUiBlurEnabled.value ?? true
  const blurValue = blurEnabled
    ? `blur(${normalizeReaderUiBlurRadiusPx.value}px) saturate(1.25)`
    : 'none'

  return {
    '--reader-toolbar-bg': `rgba(18, 18, 18, ${toolbarBgOpacity})`,
    '--reader-toolbar-bg-hover': `rgba(18, 18, 18, ${toolbarBgHoverOpacity})`,
    '--reader-toolbar-bg-active': `rgba(18, 18, 18, ${toolbarBgActiveOpacity})`,
    '--reader-toolbar-border': `rgba(255, 255, 255, ${toolbarBorderOpacity})`,
    '--reader-toolbar-border-hover': `rgba(255, 255, 255, ${toolbarBorderHoverOpacity})`,
    '--reader-toolbar-shadow': '0 14px 40px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
    '--reader-toolbar-control-shadow': '0 10px 26px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
    '--reader-toolbar-control-bg': `rgba(18, 18, 18, ${toolbarControlBgOpacity})`,
    '--reader-toolbar-control-bg-hover': `rgba(26, 26, 26, ${toolbarControlBgHoverOpacity})`,
    '--reader-toolbar-control-bg-active': `rgba(32, 32, 32, ${toolbarControlBgActiveOpacity})`,
    '--reader-toolbar-anim-ms': `${ms}ms`,
    '--reader-toolbar-anim-fast-ms': `${Math.round(ms * 0.65)}ms`,
    '--reader-toolbar-anim-delay-ms': `${Math.round(ms * 0.18)}ms`,
    '--reader-ui-control-backdrop-filter': blurValue,
    '--reader-ui-control-bg': `rgba(18, 18, 18, ${bgOpacity})`,
    '--reader-ui-control-bg-hover': `rgba(28, 28, 28, ${bgHover})`,
    '--reader-ui-control-bg-active': `rgba(34, 34, 34, ${bgActive})`,
    '--reader-ui-control-border': `rgba(255, 255, 255, ${borderOpacity})`,
    '--reader-ui-control-border-hover': `rgba(255, 255, 255, ${borderHover})`
  }
})

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
    console.error('保存阅读进度失败：', err)
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
      console.error('解析 spread_pages 失败：', err)
      spreadPages.value = []
    }
    preloadImages()
  } catch (err) {
    console.error('获取漫画详情失败：', err)
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
    console.error('获取书签失败：', err)
    bookmarks.value = []
    message.error(t('failedToFetchBookmarks'))
  }
}

const handleBookmarkButtonClick = async () => {
  await setToolbarExpanded(true)
  if (isCurrentPageBookmarked.value) {
    activePanel.value = 'bookmarks'
    fetchBookmarks()
    message.info(t('bookmarkAlreadyExists'))
    return
  }
  newBookmarkNote.value = ''
  activePanel.value = 'addBookmark'
  nextTick(() => {
    bookmarkNoteInputRef.value?.focus()
  })
}

const saveNewBookmark = async () => {
  if (!isToolbarExpanded.value) {
    return
  }
  try {
    await axios.post(`/api/v1/files/${fileId}/bookmarks`, {
      page_number: currentPage.value,
      note: newBookmarkNote.value || null
    })
    newBookmarkNote.value = ''
    activePanel.value = ''
    fetchBookmarks()
    message.success(t('bookmarkSaved'))
  } catch (err) {
    console.error('保存书签失败：', err)
    const serverError = err?.response?.data?.error
    message.error(serverError || t('failedToSaveBookmark'))
  }
}

const deleteBookmark = async bookmarkId => {
  try {
    await axios.delete(`/api/v1/bookmarks/${bookmarkId}`)
    fetchBookmarks()
  } catch (err) {
    console.error('删除书签失败：', err)
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

const togglePanel = async panel => {
  await setToolbarExpanded(true)
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
    console.error('获取文件信息失败：', err)
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

let pageIndicatorFlipAnimation = null

const setToolbarExpanded = async expanded => {
  if (isToolbarExpanded.value === expanded) {
    if (!expanded && activePanel.value) {
      activePanel.value = ''
    }
    return
  }

  const indicatorEl = pageIndicatorRef.value
  const canAnimate =
    indicatorEl &&
    typeof indicatorEl.getBoundingClientRect === 'function' &&
    typeof indicatorEl.animate === 'function'

  const firstRect = canAnimate ? indicatorEl.getBoundingClientRect() : null

  if (!expanded) {
    activePanel.value = ''
  }
  isToolbarExpanded.value = expanded

  if (!canAnimate) {
    return
  }

  await nextTick()
  const lastRect = indicatorEl.getBoundingClientRect()
  const dx = firstRect.left - lastRect.left
  const dy = firstRect.top - lastRect.top

  if (pageIndicatorFlipAnimation) {
    pageIndicatorFlipAnimation.cancel()
  }
  pageIndicatorFlipAnimation = indicatorEl.animate(
    [{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
    {
      duration: normalizeToolbarAnimationMs.value,
      easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
    }
  )
}

const expandToolbar = () => setToolbarExpanded(true)

const collapseToolbar = () => setToolbarExpanded(false)

const handleToolbarShellClick = () => {
  if (!isToolbarExpanded.value) {
    expandToolbar()
  }
}

const handleCanvasClick = e => {
  const canvas = e.currentTarget
  if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
    collapseToolbar()
    return
  }

  if (!readerToolbarCenterClickToggleEnabled.value) {
    collapseToolbar()
    return
  }

  const rect = canvas.getBoundingClientRect()
  if (!rect.width || !rect.height) {
    collapseToolbar()
    return
  }

  const xRatio = (e.clientX - rect.left) / rect.width
  const yRatio = (e.clientY - rect.top) / rect.height
  const isCenterClick = xRatio >= 0.3 && xRatio <= 0.7 && yRatio >= 0.2 && yRatio <= 0.8

  if (isCenterClick) {
    setToolbarExpanded(!isToolbarExpanded.value)
    return
  }

  collapseToolbar()
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

.reader-view__glass-control {
  --reader-ui-control-bg: var(--reader-toolbar-control-bg, var(--reader-toolbar-bg));
  --reader-ui-control-bg-hover: var(--reader-toolbar-control-bg-hover, var(--reader-toolbar-bg-hover));
  --reader-ui-control-bg-active: var(--reader-toolbar-control-bg-active, var(--reader-toolbar-bg-active));
  --reader-ui-control-border: var(--reader-toolbar-border);
  --reader-ui-control-border-hover: var(--reader-toolbar-border-hover);
  --reader-ui-control-shadow: var(--reader-toolbar-control-shadow);
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
  width: auto;
  max-width: min(900px, 90%);
}

.reader-view__toolbar-shell {
  --reader-toolbar-bg: rgba(18, 18, 18, 0.28);
  --reader-toolbar-bg-hover: rgba(18, 18, 18, 0.36);
  --reader-toolbar-bg-active: rgba(18, 18, 18, 0.42);
  --reader-toolbar-border: rgba(255, 255, 255, 0.18);
  --reader-toolbar-border-hover: rgba(255, 255, 255, 0.26);
  --reader-toolbar-shadow: 0 14px 40px rgba(0, 0, 0, 0.32), inset 0 1px 0 rgba(255, 255, 255, 0.06);
  --reader-toolbar-control-shadow: 0 10px 26px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  --reader-toolbar-anim-ms: 240ms;
  --reader-toolbar-anim-fast-ms: 160ms;
  --reader-toolbar-anim-delay-ms: 40ms;

  --reader-toolbar-shell-bg: var(--reader-toolbar-control-bg, var(--reader-toolbar-bg));
  --reader-toolbar-shell-bg-hover: var(
    --reader-toolbar-control-bg-hover,
    var(--reader-toolbar-bg-hover, var(--reader-toolbar-shell-bg))
  );
  --reader-toolbar-shell-bg-active: var(
    --reader-toolbar-control-bg-active,
    var(--reader-toolbar-bg-active, var(--reader-toolbar-shell-bg))
  );
  --reader-toolbar-shell-shadow: var(--reader-toolbar-control-shadow, var(--reader-toolbar-shadow));

  background: var(--reader-toolbar-shell-bg);
  border: 1px solid var(--reader-toolbar-border, rgba(255, 255, 255, 0.12));
  backdrop-filter: var(--reader-ui-control-backdrop-filter, blur(10px));
  -webkit-backdrop-filter: var(--reader-ui-control-backdrop-filter, blur(10px));
  border-radius: 16px;
  padding: 8px 14px;
  color: #fff;
  box-shadow: var(--reader-toolbar-shell-shadow, 0 10px 30px rgba(0, 0, 0, 0.45));
  width: fit-content;
  max-width: min(900px, 90vw);

  transition:
    padding var(--reader-toolbar-anim-ms) cubic-bezier(0.22, 1, 0.36, 1),
    background var(--reader-toolbar-anim-fast-ms) ease,
    border-color var(--reader-toolbar-anim-fast-ms) ease,
    box-shadow var(--reader-toolbar-anim-fast-ms) ease;
}

.reader-view__toolbar-shell:not(.is-expanded):hover {
  background: var(--reader-toolbar-shell-bg-hover);
  border-color: var(--reader-toolbar-border-hover, var(--reader-toolbar-border));
}

.reader-view__toolbar-shell:not(.is-expanded):active {
  background: var(--reader-toolbar-shell-bg-active);
}

.reader-view__toolbar-shell.is-expanded {
  padding: 12px;
  width: min(900px, 90vw);
}

.reader-view__toolbar-slider-row {
  max-height: 0;
  opacity: 0;
  overflow: hidden;
  pointer-events: none;
  transform: translateY(2px) scaleX(0.92);
  transform-origin: center;

  transition:
    max-height var(--reader-toolbar-anim-ms) cubic-bezier(0.22, 1, 0.36, 1),
    opacity var(--reader-toolbar-anim-fast-ms) ease,
    transform var(--reader-toolbar-anim-ms) cubic-bezier(0.22, 1, 0.36, 1);
}

.reader-view__toolbar-shell.is-expanded .reader-view__toolbar-slider-row {
  max-height: 48px;
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0) scaleX(1);
}

.reader-view__toolbar-shell :deep(.ant-slider-rail) {
  background: rgba(255, 255, 255, 0.16);
}

.reader-view__toolbar-shell :deep(.ant-slider-track) {
  background: rgba(255, 255, 255, 0.55);
}

.reader-view__toolbar-shell :deep(.ant-slider-handle) {
  border-color: rgba(255, 255, 255, 0.7);
}

.reader-view__toolbar-page-indicator {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.reader-view__toolbar-page-indicator-text {
  color: rgba(255, 255, 255, 0.9);
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.02em;
  user-select: none;
}

.reader-view__toolbar-controls-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  margin-top: 0;
  cursor: pointer;

  transition: margin-top var(--reader-toolbar-anim-ms) cubic-bezier(0.22, 1, 0.36, 1);
}

.reader-view__toolbar-shell.is-expanded .reader-view__toolbar-controls-row {
  margin-top: 10px;
  gap: 10px;
  cursor: default;
}

.reader-view__toolbar-actions-wrap {
  flex: 0 0 auto;
  width: 0;
  min-width: 0;
  max-width: 0;
  opacity: 0;
  overflow: hidden;
  background: transparent;
  pointer-events: none;
  transform: translateX(6px) scale(0.96);
  transform-origin: left center;

  transition:
    max-width var(--reader-toolbar-anim-ms) cubic-bezier(0.22, 1, 0.36, 1),
    opacity var(--reader-toolbar-anim-fast-ms) ease,
    transform var(--reader-toolbar-anim-ms) cubic-bezier(0.22, 1, 0.36, 1);
}

.reader-view__toolbar-shell.is-expanded .reader-view__toolbar-actions-wrap {
  width: auto;
  max-width: 420px;
  opacity: 1;
  pointer-events: auto;
  overflow: visible;
  transform: translateX(0) scale(1);
  transition-delay: var(--reader-toolbar-anim-delay-ms);
}

.reader-view__toolbar-actions {
  display: flex;
  align-items: center;
  gap: 10px;
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

.reader-view :deep(.ant-typography.ant-typography-secondary) {
  color: rgba(255, 255, 255, 0.72);
}

.reader-view__panel-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
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

.reader-view__table-note {
  color: rgba(255, 255, 255, 0.8);
}

.reader-view__bookmark-delete :deep(.anticon) {
  font-size: 16px;
}

.reader-view__fileinfo-value {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.panel-enter-active,
.panel-leave-active {
  overflow: hidden;
  transition:
    max-height var(--reader-toolbar-anim-ms) cubic-bezier(0.22, 1, 0.36, 1),
    opacity var(--reader-toolbar-anim-fast-ms) ease,
    transform var(--reader-toolbar-anim-ms) cubic-bezier(0.22, 1, 0.36, 1);
}

.panel-enter-from,
.panel-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(6px);
}

.panel-enter-to,
.panel-leave-from {
  max-height: 520px;
  opacity: 1;
  transform: translateY(0);
}
</style>
