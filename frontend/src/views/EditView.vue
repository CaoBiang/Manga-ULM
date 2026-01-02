<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { message } from 'ant-design-vue'
import { DeleteOutlined } from '@ant-design/icons-vue'
import TagSelector from '@/components/TagSelector.vue'

const route = useRoute()
const router = useRouter()
const { t } = useI18n()

const file = ref(null)
const bookmarks = ref([])
const loading = ref(true)
const error = ref('')

const editableFilename = ref('')
const isRenaming = ref(false)
const renameStatus = ref('idle') // idle, success, error
const renameError = ref('')

const renameFileOnSave = ref(true)
const isSaving = ref(false)
const saveStatus = ref('idle') // idle, success, error
const saveError = ref('')

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
  const dotIndex = name.lastIndexOf('.')
  editableFilename.value = dotIndex > 0 ? name.slice(0, dotIndex) : name
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
    const [fileResponse, bookmarksResponse] = await Promise.all([
      axios.get(`/api/v1/files/${fileId.value}`),
      axios.get(`/api/v1/files/${fileId.value}/bookmarks`)
    ])
    file.value = fileResponse.data
    bookmarks.value = (bookmarksResponse.data || []).slice().sort((a, b) => a.page_number - b.page_number)
    syncEditableFilename()
  } catch (err) {
    error.value = err.response?.data?.error || err.message || t('errorLoadingData', { error: '' })
  } finally {
    loading.value = false
  }
}

const handleRename = async () => {
  if (!editableFilename.value || !file.value) {
    return
  }

  const filenameWithoutExt = editableFilename.value.includes('.')
    ? editableFilename.value.substring(0, editableFilename.value.lastIndexOf('.'))
    : editableFilename.value

  isRenaming.value = true
  renameStatus.value = 'idle'
  renameError.value = ''
  try {
    await axios.post(`/api/v1/rename/file/${file.value.id}`, {
      new_filename: filenameWithoutExt
    })

    renameStatus.value = 'success'
    message.success(t('renameSuccess'))

    const pathParts = file.value.file_path.split(/[\\/]/)
    const oldFilename = pathParts.pop() || ''
    const ext = oldFilename.includes('.') ? oldFilename.split('.').pop() : ''
    const nextFilename = ext ? `${filenameWithoutExt}.${ext}` : filenameWithoutExt
    pathParts.push(nextFilename)
    file.value.file_path = pathParts.join('/')

    editableFilename.value = filenameWithoutExt
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

const handleSave = async () => {
  if (!file.value) {
    return
  }

  isSaving.value = true
  saveStatus.value = 'idle'
  saveError.value = ''
  try {
    const payload = {
      tags: file.value.tags,
      rename_file: renameFileOnSave.value
    }
    const response = await axios.put(`/api/v1/files/${file.value.id}`, payload)
    file.value = response.data
    saveStatus.value = 'success'
    message.success(t('successfullySaved'))
    setTimeout(() => {
      saveStatus.value = 'idle'
    }, 3000)
  } catch (err) {
    saveStatus.value = 'error'
    saveError.value = err.response?.data?.error || t('unexpectedSaveError')
    message.error(saveError.value)
  } finally {
    isSaving.value = false
  }
}

const bookmarkColumns = computed(() => [
  {
    title: t('page'),
    dataIndex: 'page_number',
    key: 'page',
    width: 120
  },
  {
    title: t('noteOptional'),
    dataIndex: 'note',
    key: 'note'
  },
  {
    title: '',
    key: 'action',
    width: 64,
    align: 'center'
  }
])

onMounted(fetchData)
</script>

<template>
  <a-space direction="vertical" size="large" class="w-full">
    <a-card class="shadow-sm" :bodyStyle="{ padding: '20px 24px' }">
      <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div class="min-w-0">
          <a-typography-title :level="4" class="!mb-0">
            {{ $t('editFileDetails') }}
          </a-typography-title>
          <a-typography-text type="secondary" class="block truncate">
            {{ fileNameFromPath }}
          </a-typography-text>
        </div>
        <a-space>
          <a-button @click="goBack">
            {{ $t('back') }}
          </a-button>
          <a-button type="primary" :loading="isSaving" @click="handleSave">
            {{ isSaving ? $t('saving') : $t('saveChanges') }}
          </a-button>
        </a-space>
      </div>
    </a-card>

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
        <a-card class="shadow-sm" :title="$t('metadata')">
          <a-form layout="vertical" @submit.prevent>
            <a-form-item :label="$t('filename')">
              <a-space class="w-full" wrap>
                <a-input
                  v-model:value="editableFilename"
                  :placeholder="$t('filename')"
                  style="min-width: 260px"
                />
                <a-button :loading="isRenaming" @click="handleRename">
                  {{ isRenaming ? $t('renaming') : $t('rename') }}
                </a-button>
              </a-space>
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
        </a-card>

        <a-card class="shadow-sm" :title="$t('tags')">
          <a-space direction="vertical" size="middle" class="w-full">
            <TagSelector v-model="file.tags" />
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
        </a-card>

        <a-card class="shadow-sm" :title="$t('bookmarks')">
          <a-form layout="inline" @submit.prevent class="mb-4 flex flex-wrap gap-2">
            <a-form-item :label="$t('page')">
              <a-input-number
                v-model:value="newBookmark.page"
                :min="1"
                :max="totalPages || undefined"
                style="width: 120px"
              />
            </a-form-item>
            <a-form-item :label="$t('noteOptional')" class="flex-1 min-w-[240px]">
              <a-input v-model:value="newBookmark.note" :placeholder="$t('noteOptional')" />
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
        </a-card>

        <a-card class="shadow-sm" :bodyStyle="{ padding: '16px 24px' }">
          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <a-checkbox v-model:checked="renameFileOnSave">
              {{ $t('renameFileOnSave') }}
            </a-checkbox>
            <div class="flex items-center gap-3">
              <a-typography-text v-if="saveStatus === 'success'" type="success">
                {{ $t('successfullySaved') }}
              </a-typography-text>
              <a-typography-text v-if="saveStatus === 'error'" type="danger">
                {{ saveError }}
              </a-typography-text>
              <a-button type="primary" :loading="isSaving" @click="handleSave">
                {{ isSaving ? $t('saving') : $t('saveChanges') }}
              </a-button>
            </div>
          </div>
        </a-card>
      </template>
    </a-spin>
  </a-space>
</template>
