<script setup>
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { message } from 'ant-design-vue'
import { storeToRefs } from 'pinia'
import {
  DEFAULT_LIBRARY_CARD_FIELDS,
  DEFAULT_LIBRARY_GRID_COLUMNS,
  LIBRARY_CARD_FIELD_DEFS,
  useUiSettingsStore
} from '@/store/uiSettings'

const { t } = useI18n()
const uiSettingsStore = useUiSettingsStore()
const { libraryGridColumns, libraryCardFields, libraryAuthorTagTypeId } = storeToRefs(uiSettingsStore)

const saving = ref(false)
const tagTypesLoading = ref(false)
const tagTypes = ref([])

const breakpoints = Object.freeze([
  { key: 'base', labelKey: 'libraryGridBreakpointBase' },
  { key: 'sm', labelKey: 'libraryGridBreakpointSm' },
  { key: 'md', labelKey: 'libraryGridBreakpointMd' },
  { key: 'lg', labelKey: 'libraryGridBreakpointLg' },
  { key: 'xl', labelKey: 'libraryGridBreakpointXl' },
  { key: '2xl', labelKey: 'libraryGridBreakpoint2xl' }
])

const columnsDraft = ref({ ...DEFAULT_LIBRARY_GRID_COLUMNS })
const gridFieldsDraft = ref([...DEFAULT_LIBRARY_CARD_FIELDS.grid])
const listFieldsDraft = ref([...DEFAULT_LIBRARY_CARD_FIELDS.list])
const authorTagTypeIdDraft = ref(null)

const fieldOptions = computed(() =>
  LIBRARY_CARD_FIELD_DEFS.map(item => ({
    value: item.key,
    label: t(item.labelKey)
  }))
)

const syncDraftFromStore = () => {
  columnsDraft.value = { ...DEFAULT_LIBRARY_GRID_COLUMNS, ...(libraryGridColumns.value || {}) }
  gridFieldsDraft.value = [...((libraryCardFields.value?.grid) || DEFAULT_LIBRARY_CARD_FIELDS.grid)]
  listFieldsDraft.value = [...((libraryCardFields.value?.list) || DEFAULT_LIBRARY_CARD_FIELDS.list)]
  authorTagTypeIdDraft.value = libraryAuthorTagTypeId.value || null
}

const loadTagTypes = async () => {
  tagTypesLoading.value = true
  try {
    const response = await axios.get('/api/v1/tag_types')
    tagTypes.value = response.data || []
  } catch (error) {
    console.error('加载标签类型失败：', error)
    message.error(t('failedToLoadTagTypes'))
  } finally {
    tagTypesLoading.value = false
  }
}

const save = async () => {
  saving.value = true
  try {
    await uiSettingsStore.saveLibraryDisplaySettings({
      gridColumns: columnsDraft.value,
      cardFields: {
        grid: gridFieldsDraft.value,
        list: listFieldsDraft.value
      },
      authorTagTypeId: authorTagTypeIdDraft.value
    })
    message.success(t('libraryDisplaySettingsSaved'))
    syncDraftFromStore()
  } catch (error) {
    console.error('保存图书馆展示设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}

const reset = async () => {
  saving.value = true
  try {
    await uiSettingsStore.resetLibraryDisplaySettings()
    message.success(t('libraryDisplaySettingsReset'))
    syncDraftFromStore()
  } catch (error) {
    console.error('重置图书馆展示设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await uiSettingsStore.ensureLoaded()
  syncDraftFromStore()
  loadTagTypes()
})
</script>

<template>
  <a-form layout="vertical" @submit.prevent>
    <a-form-item :label="$t('libraryGridColumns')">
      <a-row :gutter="[12, 12]">
        <a-col
          v-for="bp in breakpoints"
          :key="`grid-bp-${bp.key}`"
          :xs="12"
          :sm="8"
          :md="4"
        >
          <a-input-number
            v-model:value="columnsDraft[bp.key]"
            :min="1"
            :max="24"
            class="w-full"
          />
          <div class="mt-1 text-xs text-gray-500">
            {{ $t(bp.labelKey) }}
          </div>
        </a-col>
      </a-row>
      <a-typography-text type="secondary" class="text-xs">
        {{ $t('libraryGridColumnsHelp') }}
      </a-typography-text>
    </a-form-item>

    <a-form-item :label="$t('libraryCardFieldsGrid')">
      <a-checkbox-group v-model:value="gridFieldsDraft" :options="fieldOptions" />
    </a-form-item>

    <a-form-item :label="$t('libraryCardFieldsList')">
      <a-checkbox-group v-model:value="listFieldsDraft" :options="fieldOptions" />
      <a-typography-text type="secondary" class="text-xs">
        {{ $t('libraryCardFieldsHelp') }}
      </a-typography-text>
    </a-form-item>

    <a-form-item :label="$t('libraryAuthorTagType')">
      <a-select
        v-model:value="authorTagTypeIdDraft"
        allow-clear
        :loading="tagTypesLoading"
        :placeholder="$t('libraryAuthorTagTypePlaceholder')"
        style="max-width: 360px"
      >
        <a-select-option v-for="type in tagTypes" :key="type.id" :value="type.id">
          {{ type.name }}
        </a-select-option>
      </a-select>
      <a-typography-text type="secondary" class="text-xs">
        {{ $t('libraryAuthorTagTypeHelp') }}
      </a-typography-text>
    </a-form-item>

    <a-space>
      <a-button type="primary" :loading="saving" @click="save">
        {{ $t('save') }}
      </a-button>
      <a-button :disabled="saving" @click="reset">
        {{ $t('resetToDefault') }}
      </a-button>
    </a-space>
  </a-form>
</template>

