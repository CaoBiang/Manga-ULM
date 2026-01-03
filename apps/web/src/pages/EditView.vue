<script setup>
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { message } from 'ant-design-vue'
import { DeleteOutlined } from '@ant-design/icons-vue'
import TagSelector from '@/components/TagSelector.vue'
import GlassPage from '@/components/glass/ui/GlassPage.vue'
import GlassSurface from '@/components/glass/ui/GlassSurface.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const file = ref(null)
const bookmarks = ref([])
const loading = ref(true)
const error = ref('')

const editableFilename = ref('')
const isRenaming = ref(false)
const renameStatus = ref('idle') // 空闲、成功、失败
const renameError = ref('')

const isTagSaving = ref(false)
const tagSaveStatus = ref('idle') // 空闲、保存中、成功、失败
const tagSaveError = ref('')
const tagSavePending = ref(false)
const suppressTagAutoSave = ref(false)
let tagSaveTimer = null

const newBookmark = ref({ page: null, note: '' })
const bookmarkError = ref('')
const bookmarkSaving = ref(false)

const fileId = computed(() => route.params.id)
const totalPages = computed(() => Number(file.value?.total_pages || 0))

const fileNameFromPath = computed(() => {
  if (!file.value?.file_path) {
    return ''
  }
  return file.value.file_path.split(/[\\/]/).pop() || ''
})

const goBack = () => {
  router.back()
}

const syncEditableFilename = () => {
  const name = fileNameFromPath.value
  if (!name) {
    editableFilename.value = ''
    return
  }
  editableFilename.value = name
}

const removeTag = (tag) => {
  if (!file.value?.tags) {
    return
  }
  file.value.tags = file.value.tags.filter(item => item.id !== tag.id)
}

const fetchData = async () => {
  loading.value = true
  error.value = ''
  try {
    suppressTagAutoSave.value = true
    const [fileResponse, bookmarksResponse] = await Promise.all([
      axios.get(`/api/v1/files/${fileId.value}`),
      axios.get(`/api/v1/files/${fileId.value}/bookmarks`)
    ])
    file.value = fileResponse.data
    bookmarks.value = (bookmarksResponse.data || []).slice().sort((a, b) => a.page_number - b.page_number)
    syncEditableFilename()
    await nextTick()
  } catch (err) {
    error.value = err.response?.data?.error || err.message || t('errorLoadingData', { error: '' })
  } finally {
    suppressTagAutoSave.value = false
    loading.value = false
  }
}

const handleRename = async () => {
  if (!editableFilename.value || !file.value) {
    return
  }

  isRenaming.value = true
  renameStatus.value = 'idle'
  renameError.value = ''
  try {
    const response = await axios.post(`/api/v1/rename/file/${file.value.id}`, {
      new_filename: editableFilename.value
    })

    renameStatus.value = 'success'
    message.success(t('renameSuccess'))

    file.value = response.data
    syncEditableFilename()
    setTimeout(() => {
      renameStatus.value = 'idle'
    }, 3000)
  } catch (err) {
    renameStatus.value = 'error'
    renameError.value = err.response?.data?.error || t('unexpectedRenameError')
    message.error(renameError.value)
  } finally {
    isRenaming.value = false
  }
}

const handleSaveTags = async ({ renameFile = false, silent = true } = {}) => {
  if (!file.value) {
    return
  }

  if (isTagSaving.value) {
    tagSavePending.value = true
    return
  }

  isTagSaving.value = true
  tagSaveStatus.value = 'saving'
  tagSaveError.value = ''
  try {
    const payload = {
      tags: file.value.tags,
      rename_file: renameFile
    }
    const response = await axios.put(`/api/v1/files/${file.value.id}`, payload)

    suppressTagAutoSave.value = true
    file.value = response.data
    syncEditableFilename()
    await nextTick()
    suppressTagAutoSave.value = false

    tagSaveStatus.value = 'success'
    if (!silent) {
      message.success(t('successfullySaved'))
    }
    setTimeout(() => {
      if (tagSaveStatus.value === 'success') {
        tagSaveStatus.value = 'idle'
      }
    }, 2000)
  } catch (err) {
    tagSaveStatus.value = 'error'
    tagSaveError.value = err.response?.data?.error || t('unexpectedSaveError')
    message.error(tagSaveError.value)
  } finally {
    isTagSaving.value = false
    if (tagSavePending.value) {
      tagSavePending.value = false
      await handleSaveTags()
    }
  }
}

const handleRenameByTags = async () => {
  await handleSaveTags({ renameFile: true, silent: false })
}

const scheduleTagAutoSave = () => {
  if (!file.value) {
    return
  }
  if (suppressTagAutoSave.value) {
    return
  }
  if (tagSaveTimer) {
    clearTimeout(tagSaveTimer)
  }
  tagSaveTimer = setTimeout(() => {
    handleSaveTags({ renameFile: false, silent: true })
  }, 500)
}

const addBookmark = async () => {
  bookmarkError.value = ''
  if (!file.value) {
    return
  }

  const pageNumberUi = Number(newBookmark.value.page)
  if (!pageNumberUi || pageNumberUi < 1) {
    bookmarkError.value = t('bookmarkPagePositiveNumber')
    return
  }

  if (totalPages.value && pageNumberUi > totalPages.value) {
    bookmarkError.value = t('goToPageOutOfRange', { total: totalPages.value })
    return
  }

  bookmarkSaving.value = true
  try {
    const response = await axios.post(`/api/v1/files/${file.value.id}/bookmarks`, {
      page_number: pageNumberUi - 1,
      note: newBookmark.value.note
    })
    bookmarks.value = bookmarks.value
      .concat([response.data])
      .slice()
      .sort((a, b) => a.page_number - b.page_number)
    newBookmark.value = { page: null, note: '' }
    message.success(t('save'))
  } catch (err) {
    bookmarkError.value = err.response?.data?.error || t('failedToAddBookmark')
    message.error(bookmarkError.value)
  } finally {
    bookmarkSaving.value = false
  }
}

const deleteBookmark = async (bookmarkId) => {
  bookmarkError.value = ''
  try {
    await axios.delete(`/api/v1/bookmarks/${bookmarkId}`)
    bookmarks.value = bookmarks.value.filter(b => b.id !== bookmarkId)
    message.success(t('remove'))
  } catch (err) {
    bookmarkError.value = err.response?.data?.error || t('failedToDeleteBookmark')
    message.error(bookmarkError.value)
  }
}

const bookmarkColumns = computed(() => [
  {
    title: t('pageNumber'),
    dataIndex: 'page_number',
    key: 'page',
    width: 110
  },
  {
    title: t('note'),
    dataIndex: 'note',
    key: 'note'
  },
  {
    title: t('actions'),
    key: 'action',
    width: 56,
    align: 'center'
  }
])

watch(() => file.value?.tags, scheduleTagAutoSave, { deep: true })

onMounted(fetchData)
</script>

<template>
  <GlassPage>
    <a-space direction="vertical" size="large" class="w-full">
      <a-spin :spinning="loading">
        <a-result
          v-if="error"
          status="error"
          :title="$t('failedToLoadLibrary')"
          :sub-title="error"
        >
          <template #extra>
            <a-button type="primary" @click="fetchData">
              {{ $t('retry') }}
            </a-button>
          </template>
        </a-result>

        <template v-else-if="file">
          <a-space direction="vertical" size="large" class="w-full">
            <GlassSurface :title="$t('metadata')">
              <template #extra>
                <a-button @click="goBack">
                  {{ $t('back') }}
                </a-button>
              </template>
              <a-form layout="vertical" @submit.prevent>
                <a-form-item :label="$t('filename')">
                  <div class="w-full flex flex-col gap-2 sm:flex-row sm:items-center">
                    <a-input
                      v-model:value="editableFilename"
                      :placeholder="$t('filename')"
                      class="w-full flex-1 min-w-0"
                    />
                    <a-button :loading="isRenaming" class="shrink-0" @click="handleRename">
                      {{ isRenaming ? $t('renaming') : $t('rename') }}
                    </a-button>
                  </div>
                  <a-typography-text v-if="renameStatus === 'error'" type="danger" class="block mt-2">
                    {{ renameError }}
                  </a-typography-text>
                  <a-typography-text v-else-if="renameStatus === 'success'" type="success" class="block mt-2">
                    {{ $t('renameSuccess') }}
                  </a-typography-text>
                </a-form-item>
              </a-form>

              <a-descriptions bordered size="small" :column="1">
                <a-descriptions-item :label="$t('pages')">
                  {{ file.total_pages }}
                </a-descriptions-item>
                <a-descriptions-item :label="$t('fullPath')">
                  <span class="break-all">{{ file.file_path }}</span>
                </a-descriptions-item>
                <a-descriptions-item :label="$t('hash')">
                  <span class="break-all">{{ file.file_hash }}</span>
                </a-descriptions-item>
              </a-descriptions>
            </GlassSurface>

            <GlassSurface :title="$t('tags')">
              <template #extra>
                <a-typography-text v-if="tagSaveStatus === 'saving'" type="secondary">
                  {{ $t('saving') }}
                </a-typography-text>
                <a-typography-text v-else-if="tagSaveStatus === 'success'" type="success">
                  {{ $t('successfullySaved') }}
                </a-typography-text>
                <a-typography-text v-else-if="tagSaveStatus === 'error'" type="danger">
                  {{ tagSaveError || $t('unexpectedSaveError') }}
                </a-typography-text>
              </template>
              <a-space direction="vertical" size="middle" class="w-full">
                <div class="w-full flex flex-col gap-2 sm:flex-row sm:items-start">
                  <div class="flex-1 min-w-0">
                    <TagSelector v-model="file.tags" />
                  </div>
                  <a-tooltip :title="$t('renameFileOnSaveTip')">
                    <span class="inline-flex">
                      <a-button
                        type="primary"
                        :loading="isTagSaving"
                        :disabled="!file"
                        class="shrink-0"
                        @click="handleRenameByTags"
                      >
                        {{ $t('renameFileOnSave') }}
                      </a-button>
                    </span>
                  </a-tooltip>
                </div>
                <a-typography-text v-if="tagSaveStatus === 'error'" type="danger">
                  {{ tagSaveError }}
                </a-typography-text>
                <a-divider class="my-0" />
                <a-space v-if="file.tags && file.tags.length" wrap>
                  <a-tag
                    v-for="tag in file.tags"
                    :key="tag.id"
                    color="blue"
                    closable
                    @close.prevent="removeTag(tag)"
                  >
                    {{ tag.name }}
                  </a-tag>
                </a-space>
                <a-empty v-else :description="$t('tagsEmpty')" />
              </a-space>
            </GlassSurface>

            <GlassSurface :title="$t('bookmarks')">
              <a-form layout="inline" @submit.prevent class="mb-4 flex flex-wrap gap-2">
                <a-form-item :label="$t('pageNumber')">
                  <a-input-number
                    v-model:value="newBookmark.page"
                    :min="1"
                    :max="totalPages || undefined"
                    style="width: 120px"
                  />
                </a-form-item>
                <a-form-item :label="$t('note')" class="flex-1 min-w-[240px]">
                  <a-input v-model:value="newBookmark.note" :placeholder="$t('note')" />
                </a-form-item>
                <a-button
                  type="primary"
                  :loading="bookmarkSaving"
                  :disabled="!newBookmark.page"
                  @click="addBookmark"
                >
                  {{ $t('add') }}
                </a-button>
              </a-form>

              <a-alert v-if="bookmarkError" type="error" show-icon :message="bookmarkError" class="mb-4" />

              <a-table
                :columns="bookmarkColumns"
                :data-source="bookmarks"
                :row-key="record => record.id"
                size="small"
                :pagination="false"
                :locale="{ emptyText: $t('noBookmarksYet') }"
              >
                <template #bodyCell="{ column, record }">
                  <template v-if="column.key === 'page'">
                    {{ record.page_number + 1 }}
                  </template>
                  <template v-else-if="column.key === 'note'">
                    {{ record.note || '--' }}
                  </template>
                  <template v-else-if="column.key === 'action'">
                    <a-button type="text" danger size="small" @click="deleteBookmark(record.id)">
                      <DeleteOutlined />
                    </a-button>
                  </template>
                </template>
              </a-table>
            </GlassSurface>
          </a-space>
        </template>
      </a-spin>
    </a-space>
  </GlassPage>
</template>
