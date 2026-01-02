<template>
  <div class="p-4 md:p-8">
    <a-space direction="vertical" size="large" class="w-full">
      <a-typography-title :level="2" class="!mb-0">
        {{ $t('advancedSettings') }}
      </a-typography-title>

      <a-card :bordered="false">
        <a-space direction="vertical" size="middle" class="w-full">
          <a-alert :message="$t('advancedSettingsHelp')" type="info" show-icon />

          <div class="flex flex-wrap gap-3 items-center justify-between">
            <a-input-search
              v-model:value="keyword"
              :placeholder="$t('searchSettingsPlaceholder')"
              allow-clear
              style="max-width: 420px"
              @search="refresh"
            />
            <a-space>
              <a-button :loading="loading" @click="refresh">
                {{ $t('refresh') }}
              </a-button>
              <a-button type="primary" @click="openCreateModal">
                {{ $t('add') }}
              </a-button>
            </a-space>
          </div>

          <a-table
            :data-source="filteredRows"
            :columns="columns"
            :loading="loading"
            :row-key="row => row.key"
            size="middle"
            :pagination="{ pageSize: 50 }"
          >
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'value'">
                <a-typography-text code class="break-all">
                  {{ record.value }}
                </a-typography-text>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-button size="small" @click="openEditModal(record)">
                    {{ $t('edit') }}
                  </a-button>
                  <a-button size="small" danger @click="resetOverride(record.key)">
                    {{ $t('resetToDefault') }}
                  </a-button>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-space>
      </a-card>
    </a-space>

    <a-modal
      v-model:open="modalOpen"
      :title="modalMode === 'create' ? $t('addSetting') : $t('editSetting')"
      :confirm-loading="modalSaving"
      @ok="saveModal"
      @cancel="closeModal"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('settingKey')" required>
          <a-input v-model:value="modalKey" :disabled="modalMode === 'edit'" />
        </a-form-item>
        <a-form-item :label="$t('settingValue')" required>
          <a-textarea v-model:value="modalValue" :auto-size="{ minRows: 2, maxRows: 10 }" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { computed, onMounted, ref } from 'vue'
import axios from 'axios'
import { message, Modal } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const loading = ref(false)
const keyword = ref('')
const rows = ref([])

const modalOpen = ref(false)
const modalMode = ref('create')
const modalSaving = ref(false)
const modalKey = ref('')
const modalValue = ref('')

const columns = computed(() => [
  { title: t('settingKey'), dataIndex: 'key', key: 'key', width: 340 },
  { title: t('settingValue'), dataIndex: 'value', key: 'value' },
  { title: t('actions'), key: 'actions', width: 200 }
])

const filteredRows = computed(() => {
  const q = (keyword.value || '').trim().toLowerCase()
  if (!q) {
    return rows.value
  }
  return rows.value.filter(item => item.key.toLowerCase().includes(q))
})

const refresh = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/v1/settings')
    const settings = response.data || {}
    rows.value = Object.keys(settings)
      .sort((a, b) => a.localeCompare(b))
      .map(key => ({ key, value: String(settings[key] ?? '') }))
  } catch (error) {
    console.error('加载高级设置失败：', error)
    message.error(t('failedToFetchSettings'))
  } finally {
    loading.value = false
  }
}

const openCreateModal = () => {
  modalMode.value = 'create'
  modalKey.value = ''
  modalValue.value = ''
  modalOpen.value = true
}

const openEditModal = (record) => {
  modalMode.value = 'edit'
  modalKey.value = record.key
  modalValue.value = record.value
  modalOpen.value = true
}

const closeModal = () => {
  modalOpen.value = false
}

const saveModal = async () => {
  if (!modalKey.value.trim()) {
    message.warning(t('pleaseEnterSettingKey'))
    return
  }
  modalSaving.value = true
  try {
    await axios.post(`/api/v1/settings/${modalKey.value.trim()}`, { value: modalValue.value })
    message.success(t('settingsSavedSuccessfully'))
    modalOpen.value = false
    await refresh()
  } catch (error) {
    console.error('保存高级设置失败：', error)
    message.error(error.response?.data?.error || t('failedToSaveSettings'))
  } finally {
    modalSaving.value = false
  }
}

const resetOverride = (key) => {
  Modal.confirm({
    title: t('confirmResetSetting'),
    okType: 'danger',
    onOk: async () => {
      try {
        await axios.delete(`/api/v1/settings/${key}`)
        message.success(t('settingsSavedSuccessfully'))
        await refresh()
      } catch (error) {
        console.error('重置设置失败：', error)
        message.error(t('failedToSaveSettings'))
      }
    }
  })
}

onMounted(refresh)
</script>
