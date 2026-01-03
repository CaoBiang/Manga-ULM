<template>
  <a-space direction="vertical" size="middle" class="w-full">
    <a-list
      :data-source="types"
      bordered
      item-layout="horizontal"
    >
      <template #renderItem="{ item }">
        <a-list-item>
          <template v-if="editingTypeId === item.id">
            <a-space wrap class="w-full">
              <a-input
                v-model:value="editingTypeName"
                :placeholder="$t('typeName')"
                style="min-width: 180px"
              />
              <a-input-number
                v-model:value="editingTypeSortOrder"
                :placeholder="$t('sortValue')"
                style="width: 120px"
              />
              <a-space size="small">
                <a-button type="primary" size="small" @click="saveEdit">
                  {{ $t('save') }}
                </a-button>
                <a-button size="small" @click="cancelEditing">
                  {{ $t('cancel') }}
                </a-button>
              </a-space>
            </a-space>
          </template>
          <template v-else>
            <div class="flex w-full flex-wrap items-center justify-between gap-3">
              <div>
                <a-typography-text strong>{{ item.name }}</a-typography-text>
                <a-tag class="ml-2">
                  {{ $t('sortOrder') }}: {{ item.sort_order }}
                </a-tag>
              </div>
              <a-space size="small">
                <a-button size="small" @click="startEditing(item)">
                  {{ $t('edit') }}
                </a-button>
                <a-button danger size="small" @click="deleteType(item.id)">
                  {{ $t('delete') }}
                </a-button>
              </a-space>
            </div>
          </template>
        </a-list-item>
      </template>
      <template #footer>
        <a-button type="dashed" block @click="openCreateDialog">
          + {{ $t('newType') }}
        </a-button>
      </template>
    </a-list>

    <a-modal
      v-model:open="isCreating"
      :title="$t('newType')"
      :ok-text="$t('save')"
      :cancel-text="$t('cancel')"
      @ok="createType"
      @cancel="resetCreateForm"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('typeName')" :required="true">
          <a-input v-model:value="newTypeName" />
        </a-form-item>
        <a-form-item :label="$t('sortValue')">
          <a-input-number v-model:value="newTypeSortOrder" style="width: 160px" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-divider />

    <a-button type="primary" ghost @click="startScan">
      {{ $t('scanNewTags') }}
    </a-button>

    <a-modal
      v-model:open="showScanner"
      :title="$t('foundUndefinedTags')"
      :ok-text="$t('addSelectedTags')"
      :cancel-text="$t('close')"
      :ok-button-props="{ disabled: selectedScannedTags.length === 0 || !selectedTagType }"
      @ok="addSelectedTags"
    >
      <a-spin :spinning="isLoadingScannedTags">
        <template v-if="!isLoadingScannedTags && scannedTags.length === 0">
          <a-empty :description="$t('noNewTagsFound')" />
        </template>
        <template v-else>
          <a-checkbox-group
            v-model:value="selectedScannedTags"
            class="grid grid-cols-1 sm:grid-cols-2 gap-2"
          >
            <a-checkbox v-for="tag in scannedTags" :key="tag" :value="tag">
              {{ tag }}
            </a-checkbox>
          </a-checkbox-group>

          <a-form layout="vertical" class="mt-4">
            <a-form-item :label="$t('tagTypes')">
              <a-select v-model:value="selectedTagType" :placeholder="$t('type')">
                <a-select-option v-for="type in types" :key="type.id" :value="type.id">
                  {{ type.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-form>

          <a-typography-text type="secondary">
            {{ $t('tagsSelected', { count: selectedScannedTags.length }) }}
          </a-typography-text>
        </template>
      </a-spin>
    </a-modal>
  </a-space>
</template>

<script setup>
import { ref, watch } from 'vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import { message, Modal } from 'ant-design-vue'

const { t } = useI18n()

const props = defineProps({
  types: {
    type: Array,
    required: true
  }
})

const emit = defineEmits(['dataChanged'])

const newTypeName = ref('')
const newTypeSortOrder = ref(0)
const isCreating = ref(false)
const editingTypeId = ref(null)
const editingTypeName = ref('')
const editingTypeSortOrder = ref(0)

const scannedTags = ref([])
const isLoadingScannedTags = ref(false)
const showScanner = ref(false)
const selectedScannedTags = ref([])
const selectedTagType = ref(null)

watch(showScanner, value => {
  if (!value) {
    selectedScannedTags.value = []
  }
})

function resetCreateForm() {
  isCreating.value = false
  newTypeName.value = ''
  newTypeSortOrder.value = 0
}

function openCreateDialog() {
  newTypeName.value = ''
  newTypeSortOrder.value = 0
  isCreating.value = true
}

async function createType() {
  if (!newTypeName.value.trim()) {
    message.warning(t('tagNameAndTypeRequired'))
    return
  }

  try {
    await axios.post('/api/v1/tag_types', {
      name: newTypeName.value,
      sort_order: newTypeSortOrder.value
    })
    message.success(t('settingsSavedSuccessfully'))
    resetCreateForm()
    emit('dataChanged')
  } catch (error) {
    console.error('Failed to create tag type:', error)
    message.error(t('errorCreatingTagType') + (error.response?.data?.error || ''))
  }
}

async function startScan() {
  showScanner.value = true
  isLoadingScannedTags.value = true
  selectedScannedTags.value = []
  selectedTagType.value = props.types[0]?.id ?? null

  try {
    const response = await axios.get('/api/v1/tags/scan-undefined-tags')
    scannedTags.value = response.data
  } catch (error) {
    console.error('Failed to scan for undefined tags:', error)
    message.error(t('errorScanningTags') + (error.response?.data?.error || ''))
  } finally {
    isLoadingScannedTags.value = false
  }
}

async function addSelectedTags() {
  if (selectedScannedTags.value.length === 0 || !selectedTagType.value) {
    message.warning(t('selectTagsAndType'))
    return
  }

  try {
    for (const tagName of selectedScannedTags.value) {
      await axios.post('/api/v1/tags', {
        name: tagName,
        type_id: selectedTagType.value
      })
    }
    message.success(t('tagsAddedSuccessfully'))
    showScanner.value = false
    scannedTags.value = []
    emit('dataChanged')
  } catch (error) {
    console.error('Failed to add tags:', error)
    message.error(t('errorAddingTags') + (error.response?.data?.error || ''))
  }
}

function deleteType(id) {
  Modal.confirm({
    title: t('confirmDeleteTagType'),
    okType: 'danger',
    onOk: async () => {
      try {
        await axios.delete(`/api/v1/tag_types/${id}`)
        message.success(t('settingsSavedSuccessfully'))
        emit('dataChanged')
      } catch (error) {
        console.error('Failed to delete tag type:', error)
        message.error(t('errorDeletingTagType') + (error.response?.data?.error || ''))
      }
    }
  })
}

function startEditing(type) {
  editingTypeId.value = type.id
  editingTypeName.value = type.name
  editingTypeSortOrder.value = type.sort_order
}

function cancelEditing() {
  editingTypeId.value = null
}

async function saveEdit() {
  if (!editingTypeName.value.trim()) {
    message.warning(t('tagNameAndTypeRequired'))
    return
  }

  try {
    await axios.put(`/api/v1/tag_types/${editingTypeId.value}`, {
      name: editingTypeName.value,
      sort_order: editingTypeSortOrder.value
    })
    message.success(t('settingsSavedSuccessfully'))
    cancelEditing()
    emit('dataChanged')
  } catch (error) {
    console.error('Failed to update tag type:', error)
    message.error(t('errorUpdatingTagType') + (error.response?.data?.error || ''))
  }
}
</script>
