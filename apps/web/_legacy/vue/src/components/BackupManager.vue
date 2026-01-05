<script setup>
import { ref, onMounted } from 'vue'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'
import { useLibraryStore } from '@/store/library'

const { t } = useI18n()
const backups = ref([])
const isLoading = ref(false)
const libraryStore = useLibraryStore()

const fetchBackups = async () => {
  isLoading.value = true
  try {
    const response = await axios.get('/api/v1/backups')
    backups.value = response.data?.backups || []
  } catch (error) {
    console.error('Failed to fetch backups:', error)
    message.error(t('errorFetchingBackups'))
  } finally {
    isLoading.value = false
  }
}

const createBackup = async () => {
  if (!window.confirm(t('confirmCreateBackup'))) return
  try {
    await axios.post('/api/v1/backups')
    message.success(t('backupCreatedSuccessfully'))
    fetchBackups()
  } catch (error) {
    console.error('Failed to create backup:', error)
    message.error(t('errorCreatingBackup'))
  } finally {
    libraryStore.checkActiveTasks()
  }
}

const restoreBackup = async (filename) => {
  if (!window.confirm(t('confirmRestore'))) {
    return
  }

  try {
    await axios.post('/api/v1/backup-restores', { filename })
    message.success(t('restoreSuccessful'))
  } catch (error) {
    console.error('Failed to restore backup:', error)
    message.error(t('errorRestoringBackup'))
  } finally {
    libraryStore.checkActiveTasks()
  }
}

onMounted(fetchBackups)
</script>

<template>
  <a-card :title="$t('backupRestore')" class="shadow-sm">
    <a-space direction="vertical" size="large" class="w-full">
      <a-button type="primary" @click="createBackup" :loading="isLoading">
        {{ $t('createNewBackup') }}
      </a-button>

      <div>
        <a-typography-title :level="5">{{ $t('availableBackups') }}</a-typography-title>
        <a-list
          bordered
          :data-source="backups"
          :loading="isLoading"
          :locale="{ emptyText: $t('noBackupsFound') }"
        >
          <template #renderItem="{ item }">
            <a-list-item class="flex items-center justify-between">
              <a-typography-text code class="text-sm">{{ item.filename }}</a-typography-text>
              <a-button type="primary" danger size="small" @click="restoreBackup(item.filename)">
                {{ $t('restore') }}
              </a-button>
            </a-list-item>
          </template>
        </a-list>
      </div>
    </a-space>
  </a-card>
</template>
