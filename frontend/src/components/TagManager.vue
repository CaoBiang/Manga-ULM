<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'
import Pagination from './Pagination.vue'
import { useLibraryStore } from '@/store/library'

const { t } = useI18n()
const libraryStore = useLibraryStore()
const socket = libraryStore.socket

const props = defineProps({
  types: { type: Array, required: true }
})

// listing state
const tags = ref([])
const selectedTypeId = ref(null)
const isLoading = ref(false)
const currentPage = ref(1)
const totalPages = ref(1)
const totalTags = ref(0)
const perPage = ref(20)

// editor state
const showModal = ref(false)
const editingTag = ref(null)
const tagForm = ref({
  id: null,
  name: '',
  description: '',
  type_id: null,
  parent_id: null,
  aliases: [],
  newAlias: ''
})

// parent remote suggest
const parentSuggestions = ref([])
const isParentLoading = ref(false)
const loadParentSuggestions = async (query = '') => {
  if (!tagForm.value.type_id) return
  try {
    isParentLoading.value = true
    const { data } = await axios.get('/api/v1/tags/suggest', {
      params: { q: query, type_id: tagForm.value.type_id, limit: 20 }
    })
    parentSuggestions.value = data.filter(x => x.id !== tagForm.value.id)
  } catch (e) {
    console.error('Failed to load parent suggestions:', e)
  } finally {
    isParentLoading.value = false
  }
}

// file change state
const showFileChangeModal = ref(false)
const fileChangeTag = ref(null)
const fileChangeAction = ref('delete') // delete | rename | split
const newTagName = ref('')
const newTagNames = ref([])
const newTagNameInput = ref('')
const isFileChanging = ref(false)
const isPreviewLoading = ref(false)
const previewData = ref({ impacted: 0, examples: [] })

// merge state
const showMergeModal = ref(false)
const mergeSourceTag = ref(null)
const mergeTarget = ref(null)
const isMerging = ref(false)
const mergeSuggestions = ref([])

const fileChangeOkDisabled = computed(() => {
  if (!fileChangeTag.value) return true
  if (fileChangeAction.value === 'rename') return !newTagName.value.trim()
  if (fileChangeAction.value === 'split') return newTagNames.value.length === 0
  return false
})

const fileChangeTagName = computed(() => fileChangeTag.value?.name || '')

const fetchTags = async (page = 1) => {
  isLoading.value = true
  try {
    const params = { page, per_page: perPage.value, type_id: selectedTypeId.value ?? undefined }
    const { data } = await axios.get('/api/v1/tags', { params })
    tags.value = data.tags
    currentPage.value = data.page
    totalPages.value = data.pages
    totalTags.value = data.total
  } catch (e) {
    console.error('Failed to fetch tags:', e)
    message.error(t('errorFetchingTags'))
  } finally {
    isLoading.value = false
  }
}

const handlePageChange = (page) => fetchTags(page)
watch(selectedTypeId, () => fetchTags(1))

onMounted(() => {
  fetchTags()
  socket.on('connect', () => console.log('Socket connected'))
  socket.on('disconnect', () => console.log('Socket disconnected'))
  socket.on('connect_error', (e) => console.error('Socket error:', e))
})

const getTypeName = (typeId) => props.types.find(ti => ti.id === typeId)?.name || t('none')
const getParentName = (parentId) => {
  if (!parentId) return t('none')
  const p = tags.value.find(tg => tg.id === parentId)
  return p ? p.name : t('none')
}

const openCreateModal = () => {
  editingTag.value = null
  tagForm.value = {
    id: null,
    name: '',
    description: '',
    type_id: selectedTypeId.value ?? props.types[0]?.id ?? null,
    parent_id: null,
    aliases: [],
    newAlias: ''
  }
  parentSuggestions.value = []
  if (tagForm.value.type_id) loadParentSuggestions('')
  showModal.value = true
}

const openEditModal = (tag) => {
  editingTag.value = { ...tag }
  tagForm.value = {
    id: tag.id,
    name: tag.name,
    description: tag.description || '',
    type_id: tag.type_id,
    parent_id: tag.parent_id,
    aliases: [...tag.aliases],
    newAlias: ''
  }
  parentSuggestions.value = []
  if (tagForm.value.type_id) loadParentSuggestions('')
  showModal.value = true
}

const closeModal = () => { showModal.value = false; editingTag.value = null }

const addAlias = () => {
  const a = (tagForm.value.newAlias || '').trim()
  if (!a) return
  if (tagForm.value.aliases.includes(a)) {
    message.warning(t('aliasAlreadyExists'))
    return
  }
  tagForm.value.aliases.push(a)
  tagForm.value.newAlias = ''
}
const removeAlias = (a) => { tagForm.value.aliases = tagForm.value.aliases.filter(x => x !== a) }

const saveTag = async () => {
  if (!tagForm.value.name || !tagForm.value.type_id) { message.warning(t('tagNameAndTypeRequired')); return }
  const payload = { name: tagForm.value.name, description: tagForm.value.description, type_id: tagForm.value.type_id, parent_id: tagForm.value.parent_id, aliases: tagForm.value.aliases }
  try {
    if (editingTag.value) await axios.put(`/api/v1/tags/${editingTag.value.id}`, payload)
    else await axios.post('/api/v1/tags', payload)
    message.success(t('settingsSavedSuccessfully'))
    closeModal(); fetchTags(currentPage.value)
  } catch (e) {
    console.error('Failed to save tag:', e)
    message.error(t('errorSavingTag') + (e.response?.data?.error || ''))
  }
}

const deleteTag = (tag) => {
  Modal.confirm({
    title: t('confirmDeletionTitle'),
    content: t('confirmDeleteTagWithUsage', { name: tag.name, count: tag.usage_count ?? 0 }),
    okType: 'danger',
    onOk: async () => {
      try {
        await axios.delete(`/api/v1/tags/${tag.id}`)
        message.success(t('settingsSavedSuccessfully'))
        fetchTags(currentPage.value)
      } catch (e) {
        console.error('Failed to delete tag:', e)
        message.error(t('errorDeletingTag') + (e.response?.data?.error || ''))
      }
    }
  })
}

// file-change modal
const openFileChangeModal = (tag) => { fileChangeTag.value = { ...tag }; fileChangeAction.value = 'delete'; newTagName.value=''; newTagNames.value=[]; newTagNameInput.value=''; previewData.value={impacted:0,examples:[]}; showFileChangeModal.value = true }
const closeFileChangeModal = () => { showFileChangeModal.value=false; fileChangeTag.value=null; fileChangeAction.value='delete'; newTagName.value=''; newTagNames.value=[]; newTagNameInput.value=''; isFileChanging.value=false }
const loadPreview = async () => {
  if (!fileChangeTag.value) return
  try {
    isPreviewLoading.value = true
    let endpoint, payload
    if (fileChangeAction.value === 'split') { endpoint = `/api/v1/tags/${fileChangeTag.value.id}/split/preview`; payload = { new_tag_names: newTagNames.value } }
    else { endpoint = `/api/v1/tags/${fileChangeTag.value.id}/file-change/preview`; payload = { action: fileChangeAction.value, new_name: fileChangeAction.value === 'rename' ? newTagName.value.trim() : undefined } }
    const { data } = await axios.post(endpoint, payload)
    previewData.value = data
  } catch (e) {
    console.error('Failed to load preview:', e)
    message.error(t('errorLoadingPreview') + (e.response?.data?.error || ''))
  } finally { isPreviewLoading.value = false }
}
const executeFileChange = async () => {
  if (!fileChangeTag.value) return
  if (fileChangeAction.value === 'rename' && !newTagName.value.trim()) { message.warning(t('pleaseEnterNewTagName')); return }
  if (fileChangeAction.value === 'split' && newTagNames.value.length === 0) { message.warning(t('noNewTagsAdded')); return }
  try {
    isFileChanging.value = true
    let endpoint, payload
    if (fileChangeAction.value === 'split') { endpoint = `/api/v1/tags/${fileChangeTag.value.id}/split`; payload = { new_tag_names: newTagNames.value } }
    else { endpoint = `/api/v1/tags/${fileChangeTag.value.id}/file-change`; payload = { action: fileChangeAction.value, new_name: fileChangeAction.value === 'rename' ? newTagName.value.trim() : undefined } }
    await axios.post(endpoint, payload)
    message.success(t('operationSubmittedCheckTaskManager'))
    closeFileChangeModal()
  } catch (e) {
    console.error('Failed to start operation:', e)
    message.error(t('errorStartingOperation') + (e.response?.data?.error || e.message))
  } finally { isFileChanging.value = false }
}
const addNewTagName = () => { const n = newTagNameInput.value.trim(); if (n && !newTagNames.value.includes(n)) { newTagNames.value.push(n); newTagNameInput.value='' } }
const removeNewTagName = (n) => { newTagNames.value = newTagNames.value.filter(x => x !== n) }

// merge modal
const openMergeModal = (tag) => { mergeSourceTag.value = tag; mergeTarget.value=null; mergeSuggestions.value=[]; showMergeModal.value = true }
const searchMergeTargets = async (q='') => { if (!mergeSourceTag.value) return; const { data } = await axios.get('/api/v1/tags/suggest', { params: { q, type_id: mergeSourceTag.value.type_id, limit: 20 } }); mergeSuggestions.value = data.filter(x => x.id !== mergeSourceTag.value.id) }
const executeMerge = async () => { if (!mergeSourceTag.value || !mergeTarget.value) return; try { isMerging.value = true; await axios.post(`/api/v1/tags/${mergeSourceTag.value.id}/merge`, { target_tag_id: mergeTarget.value }); message.success(t('mergeSuccess')); showMergeModal.value = false; fetchTags(currentPage.value) } catch (e) { console.error('Failed to merge:', e); message.error(t('mergeError') + (e.response?.data?.error || '')) } finally { isMerging.value = false } }
</script>

<template>
  <a-space direction="vertical" size="large" class="w-full">
    <a-card class="shadow-sm">
      <a-space direction="vertical" size="large" class="w-full">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <a-form layout="inline" @submit.prevent>
            <a-form-item :label="$t('filterByType')">
              <a-select v-model:value="selectedTypeId" allow-clear style="min-width: 220px">
                <a-select-option :value="null">{{ $t('allTypes') }}</a-select-option>
                <a-select-option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-form>
          <a-button type="primary" @click="openCreateModal">+ {{ $t('newTag') }}</a-button>
        </div>

        <a-table :data-source="tags" :loading="isLoading" :row-key="r => r.id" :pagination="false" size="middle" :locale="{ emptyText: $t('noTagsFoundForType') }">
          <a-table-column :title="$t('name')" dataIndex="name" key="name" />
          <a-table-column :title="$t('description')" key="description">
            <template #default="{ record }"><a-typography-text type="secondary">{{ record.description || '-' }}</a-typography-text></template>
          </a-table-column>
          <a-table-column :title="$t('type')" key="type"><template #default="{ record }">{{ getTypeName(record.type_id) }}</template></a-table-column>
          <a-table-column :title="$t('parentTag')" key="parent"><template #default="{ record }">{{ getParentName(record.parent_id) }}</template></a-table-column>
          <a-table-column :title="$t('aliases')" key="aliases">
            <template #default="{ record }">
              <a-space wrap>
                <a-tag v-for="alias in record.aliases" :key="alias">{{ alias }}</a-tag>
                <a-typography-text v-if="!record.aliases.length" type="secondary">-</a-typography-text>
              </a-space>
            </template>
          </a-table-column>
          <a-table-column :title="$t('usage')" key="usage_count"><template #default="{ record }"><a-tag color="blue">{{ record.usage_count }}</a-tag></template></a-table-column>
          <a-table-column :title="$t('actions')" key="actions" :width="320">
            <template #default="{ record }">
              <a-space size="small" wrap>
                <a-button size="small" @click="openEditModal(record)">{{ $t('edit') }}</a-button>
                <a-button size="small" type="default" @click="openFileChangeModal(record)">{{ $t('fileChange') }}</a-button>
                <a-button size="small" type="default" @click="openMergeModal(record)">{{ $t('mergeTag') }}</a-button>
                <a-button size="small" danger @click="deleteTag(record)">{{ $t('delete') }}</a-button>
              </a-space>
            </template>
          </a-table-column>
        </a-table>

        <div class="flex justify-end">
          <Pagination :current-page="currentPage" :total-pages="totalPages" @page-changed="handlePageChange" />
        </div>
      </a-space>
    </a-card>
  </a-space>

  <a-modal v-model:open="showModal" :title="editingTag ? `${$t('edit')} ${$t('tag')}` : $t('newTag')" :ok-text="$t('save')" :cancel-text="$t('cancel')" :confirm-loading="false" :width="640" @ok="saveTag" @cancel="closeModal">
    <a-form layout="vertical">
      <a-form-item :label="$t('name')" :required="true"><a-input v-model:value="tagForm.name" /></a-form-item>
      <a-form-item :label="$t('description')"><a-textarea v-model:value="tagForm.description" :rows="3" /></a-form-item>
      <a-form-item :label="$t('type')" :required="true">
        <a-select v-model:value="tagForm.type_id" :dropdown-match-select-width="false">
          <a-select-option v-for="type in types" :key="type.id" :value="type.id">{{ type.name }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item :label="$t('parentTag')">
        <a-select v-model:value="tagForm.parent_id" show-search allow-clear :filter-option="false" :placeholder="t('none')" :not-found-content="isParentLoading ? $t('loading') : null" @search="loadParentSuggestions" @focus="loadParentSuggestions('')" :dropdown-match-select-width="false">
          <a-select-option :value="null">{{ t('none') }}</a-select-option>
          <a-select-option v-for="parent in parentSuggestions" :key="parent.id" :value="parent.id">{{ parent.name }} ({{ getTypeName(parent.type_id) }})</a-select-option>
        </a-select>
      </a-form-item>
      <a-form-item :label="$t('aliases')">
        <a-space align="start" class="w-full">
          <a-input v-model:value="tagForm.newAlias" :placeholder="$t('aliases')" @pressEnter.prevent="addAlias" />
          <a-button type="dashed" @click="addAlias">{{ $t('add') }}</a-button>
        </a-space>
        <div class="mt-2 flex flex-wrap gap-2">
          <a-tag v-for="alias in tagForm.aliases" :key="alias" closable @close.prevent="removeAlias(alias)">{{ alias }}</a-tag>
        </div>
      </a-form-item>
    </a-form>
  </a-modal>

  <a-modal v-model:open="showFileChangeModal" :title="`${$t('fileChange')} - ${fileChangeTagName}`" :cancel-text="$t('cancel')" :ok-button-props="{ disabled: fileChangeOkDisabled }" :confirm-loading="isFileChanging" width="720px" @ok="executeFileChange" @cancel="closeFileChangeModal">
    <a-form layout="vertical">
      <a-form-item :label="$t('selectAction')">
        <a-radio-group v-model:value="fileChangeAction">
          <a-radio value="delete">{{ $t('deleteTagFromFilenames') }} [{{ fileChangeTagName }}]</a-radio>
          <a-radio value="rename">{{ $t('renameTagInFilenames') }} [{{ fileChangeTagName }}]</a-radio>
          <a-radio value="split">{{ $t('splitTagInFilenames') }} [{{ fileChangeTagName }}]</a-radio>
        </a-radio-group>
      </a-form-item>

      <a-form-item v-if="fileChangeAction === 'rename'" :label="$t('newTagName')">
        <a-input v-model:value="newTagName" :placeholder="fileChangeTagName" />
      </a-form-item>

      <div v-if="fileChangeAction === 'split'" class="space-y-4">
        <a-form-item :label="$t('addNewTagName')">
          <a-space class="w-full">
            <a-input v-model:value="newTagNameInput" :placeholder="$t('newTagNamePlaceholder')" @pressEnter.prevent="addNewTagName" />
            <a-button type="dashed" @click="addNewTagName">{{ $t('add') }}</a-button>
          </a-space>
        </a-form-item>

        <div v-if="newTagNames.length > 0" class="space-y-2 max-h-48 overflow-y-auto">
          <a-list :data-source="newTagNames" size="small" bordered>
            <template #renderItem="{ item }">
              <a-list-item class="flex items-center justify-between">
                <a-typography-text>[{{ item }}]</a-typography-text>
                <a-button type="text" danger size="small" @click="removeNewTagName(item)">{{ $t('delete') }}</a-button>
              </a-list-item>
            </template>
          </a-list>
        </div>
      </div>

      <a-space direction="vertical" class="w-full">
        <a-button :loading="isPreviewLoading" @click="loadPreview">{{ $t('preview') }}</a-button>
        <div v-if="previewData">
          <a-typography-paragraph>
            {{ $t('impactedFiles') }}: <a-typography-text strong>{{ previewData.impacted }}</a-typography-text>
          </a-typography-paragraph>
          <a-list v-if="previewData.examples && previewData.examples.length" :data-source="previewData.examples" size="small" bordered>
            <template #renderItem="{ item }">
              <a-list-item>
                <div class="flex flex-col">
                  <span><strong>{{ $t('previewOldLabel') }}:</strong> {{ item.old }}</span>
                  <span><strong>{{ $t('previewNewLabel') }}:</strong> {{ item.new }}</span>
                </div>
              </a-list-item>
            </template>
          </a-list>
        </div>
        <a-alert type="warning" show-icon class="mt-2" :message="$t('warningFileRename')" />
      </a-space>
    </a-form>
  </a-modal>

  <a-modal v-model:open="showMergeModal" :title="$t('mergeTag')" :ok-text="$t('confirmMerge')" :cancel-text="$t('cancel')" :confirm-loading="isMerging" @ok="executeMerge" @cancel="() => (showMergeModal.value = false)">
    <a-form layout="vertical">
      <a-form-item :label="$t('selectTargetTag')">
        <a-select v-model:value="mergeTarget" show-search :filter-option="false" :placeholder="$t('selectTargetTag')" @search="searchMergeTargets" @focus="searchMergeTargets('')">
          <a-select-option v-for="opt in mergeSuggestions" :key="opt.id" :value="opt.id">{{ opt.name }} ({{ $t('usage') }}: {{ opt.usage_count }})</a-select-option>
        </a-select>
      </a-form-item>
    </a-form>
  </a-modal>
</template>
