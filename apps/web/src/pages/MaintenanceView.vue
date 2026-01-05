<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { Modal, message } from 'ant-design-vue'
import BackupManager from '../components/BackupManager.vue'
import GlassPage from '@/components/glass/ui/GlassPage.vue'
import GlassSurface from '@/components/glass/ui/GlassSurface.vue'
import { useLibraryStore } from '@/store/library'

const duplicates = ref([])
const isLoadingDuplicates = ref(false)

const missingFiles = ref([])
const isLoadingMissing = ref(false)
const selectedMissingFiles = ref(new Set())

const { t } = useI18n()
const libraryStore = useLibraryStore()

const findDuplicates = async () => {
  isLoadingDuplicates.value = true
  duplicates.value = []
  try {
    const response = await axios.get('/api/v1/reports/duplicate-files')
    duplicates.value = response.data
  } catch (error) {
    console.error('Failed to find duplicates:', error)
    message.error(t('errorLoadingData', { error: t('duplicateFinder') }))
  } finally {
    isLoadingDuplicates.value = false
    libraryStore.checkActiveTasks()
  }
}

const findMissingFiles = async () => {
  isLoadingMissing.value = true
  missingFiles.value = []
  try {
    const response = await axios.get('/api/v1/files', {
      params: { is_missing: true, per_page: 9999 }
    })
    missingFiles.value = response.data.files
  } catch (error) {
    console.error('Failed to find missing files:', error)
    message.error(t('errorLoadingData', { error: t('missingFileCleanup') }))
  } finally {
    isLoadingMissing.value = false
  }
}

const cleanupSelectedMissingFiles = () => {
  if (selectedMissingFiles.value.size === 0) {
    message.warning(t('pleaseSelectFileToRename'))
    return
  }

  Modal.confirm({
    title: t('deleteSelectedRecords'),
    content: `${t('deleteSelectedRecords')} (${selectedMissingFiles.value.size})`,
    okType: 'danger',
    async onOk() {
      try {
        const ids = Array.from(selectedMissingFiles.value)
        const response = await axios.post('/api/v1/missing-file-cleanups', { file_ids: ids })
        message.success(response.data.message)
        selectedMissingFiles.value.clear()
        findMissingFiles()
      } catch (error) {
        console.error('Failed to cleanup missing files:', error)
        message.error(t('error'))
      } finally {
        libraryStore.checkActiveTasks()
      }
    }
  })
}
</script>

<template>
  <GlassPage>
    <a-space direction="vertical" size="large" class="w-full">
      <BackupManager />

      <GlassSurface :title="$t('duplicateFinder')">
      <a-button type="primary" :loading="isLoadingDuplicates" @click="findDuplicates">
        {{ isLoadingDuplicates ? $t('scanning') : $t('findDuplicates') }}
      </a-button>
      <a-list
        v-if="duplicates.length"
        class="mt-4"
        :data-source="duplicates"
        bordered
      >
        <template #renderItem="{ item, index }">
          <a-list-item :key="index">
            <a-card type="inner" :title="`${$t('duplicateFinder')} #${index + 1}`">
              <a-list :data-source="item" :renderItem="file => null" size="small">
                <template #renderItem="{ item: file }">
                  <a-list-item>
                    <a-typography-text code class="truncate block">
                      {{ file.file_path }}
                    </a-typography-text>
                  </a-list-item>
                </template>
              </a-list>
            </a-card>
          </a-list-item>
        </template>
      </a-list>
      <a-empty v-else-if="!isLoadingDuplicates" class="mt-4" :description="$t('noDuplicatesFound')" />
      </GlassSurface>

      <GlassSurface :title="$t('missingFileCleanup')">
      <a-space wrap class="mb-4">
        <a-button type="primary" :loading="isLoadingMissing" @click="findMissingFiles">
          {{ isLoadingMissing ? $t('scanning') : $t('findMissingFiles') }}
        </a-button>
        <a-button
          v-if="missingFiles.length"
          danger
          @click="cleanupSelectedMissingFiles"
        >
          {{ $t('deleteSelectedRecords') }}
        </a-button>
      </a-space>

      <a-list
        v-if="missingFiles.length"
        bordered
        :data-source="missingFiles"
        :locale="{ emptyText: null }"
      >
        <template #renderItem="{ item }">
          <a-list-item>
            <a-checkbox
              :checked="selectedMissingFiles.has(item.id)"
              @change="event => {
                if (event.target.checked) {
                  selectedMissingFiles.add(item.id)
                } else {
                  selectedMissingFiles.delete(item.id)
                }
              }"
            >
              <span class="text-sm">{{ item.file_path }}</span>
            </a-checkbox>
          </a-list-item>
        </template>
      </a-list>

      <a-empty v-else-if="!isLoadingMissing" :description="$t('noMissingFilesFound')" />
      </GlassSurface>
    </a-space>
  </GlassPage>
</template>
