<script setup>
import { ref, onMounted } from 'vue'
import { useLibraryStore } from '@/store/library'
import { storeToRefs } from 'pinia'
import MangaCard from './MangaCard.vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useI18n } from 'vue-i18n'
import { message } from 'ant-design-vue'

const { t } = useI18n()
const router = useRouter()
const libraryStore = useLibraryStore()
const { 
  scanProgress, 
  scanStatus, 
  currentScanFile,
  files,
  pagination,
  libraryStatus
} = storeToRefs(libraryStore)

const libraryPath = ref('')
const isRenameMode = ref(false)
const selectedFilesForRename = ref(new Set())

const handleScan = () => {
  if (libraryPath.value) {
    libraryStore.startScan(libraryPath.value)
  } else {
    message.warning(t('pleaseFillLibraryPath'))
  }
}

const pickRandomManga = async () => {
  try {
    const response = await axios.get('/api/v1/files/random');
    if (response.data) {
      router.push({ name: 'reader', params: { id: response.data.id } })
    } else {
      message.info(t('noMangaToPick'))
    }
  } catch (error) {
    console.error('Failed to pick random manga:', error)
    message.error(t('failedToPickRandomManga'))
  }
}

const toggleRenameMode = () => {
  isRenameMode.value = !isRenameMode.value;
  selectedFilesForRename.value.clear();
}

const handleFileSelection = (fileId, isSelected) => {
  if (isSelected) {
    selectedFilesForRename.value.add(fileId);
  } else {
    selectedFilesForRename.value.delete(fileId);
  }
}

const startBatchRename = async () => {
  const template = localStorage.getItem('mangaFilenameTemplate')
  if (!template) {
    message.warning(t('pleaseSaveFilenameTemplate'))
    return
  }
  if (selectedFilesForRename.value.size === 0) {
    message.warning(t('pleaseSelectFileToRename'))
    return
  }
  if (!libraryPath.value) {
    message.warning(t('pleaseSpecifyLibraryRoot'))
    return
  }

  try {
    const file_ids = Array.from(selectedFilesForRename.value)
    await axios.post('/api/v1/rename/batch', {
      file_ids,
      template,
      root_path: libraryPath.value
    })
    message.success(t('batchRenameTaskStarted'))
    toggleRenameMode()
    libraryStore.fetchFiles()
  } catch (error) {
    console.error('Failed to start batch rename:', error)
    message.error(t('failedToStartBatchRename'))
  }
}

const changePage = (page) => {
  if (page > 0 && page <= pagination.value.total_pages) {
    libraryStore.fetchFiles(page)
  }
}

onMounted(() => {
  if (files.value.length === 0) {
    libraryStore.fetchFiles()
  }
})
</script>

<template>
  <a-space direction="vertical" size="large" class="w-full">
    <a-card :title="$t('libraryManagement')" class="shadow-sm">
      <a-form layout="vertical">
        <a-form-item :label="$t('libraryPath')">
          <div class="flex gap-3">
            <a-input
              v-model:value="libraryPath"
              :placeholder="t('libraryPathPlaceholder')"
              class="flex-1"
            />
            <a-button
              type="primary"
              :loading="scanStatus === 'scanning'"
              @click="handleScan"
            >
              {{ scanStatus === 'scanning' ? t('scanning') : t('startScan') }}
            </a-button>
          </div>
        </a-form-item>
      </a-form>

      <div v-if="scanStatus !== 'idle'" class="mt-4 space-y-2">
        <a-progress :percent="Number(scanProgress.toFixed(2))" status="active" />
        <a-typography-text type="secondary" v-if="currentScanFile">
          <strong>{{ $t('processing') }}:</strong> {{ currentScanFile }}
        </a-typography-text>
        <a-typography-text type="secondary">
          <strong>{{ $t('status') }}:</strong> {{ scanStatus }}
        </a-typography-text>
        <a-alert
          v-if="scanStatus === 'finished'"
          type="success"
          show-icon
          :message="$t('scanCompletedSuccessfully')"
        />
        <a-alert
          v-else-if="scanStatus === 'error'"
          type="error"
          show-icon
          :message="$t('scanErrorOccurred')"
        />
      </div>
    </a-card>

    <a-card :title="$t('quickActions')" class="shadow-sm">
      <a-space wrap>
        <a-button type="primary" @click="pickRandomManga">
          {{ $t('pickRandomManga') }}
        </a-button>
        <a-button @click="toggleRenameMode">
          {{ isRenameMode ? t('cancelRename') : t('batchRename') }}
        </a-button>
        <a-button
          v-if="isRenameMode"
          type="dashed"
          @click="startBatchRename"
        >
          {{ t('applyTemplateToFiles', { count: selectedFilesForRename.size }) }}
        </a-button>
      </a-space>
    </a-card>

    <a-card :title="$t('myMangaLibrary')" class="shadow-sm">
      <a-alert
        v-if="libraryStatus === 'error'"
        type="error"
        show-icon
        :message="$t('failedToLoadLibrary')"
        class="mb-4"
      />

      <template v-else>
        <div v-if="files.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          <div v-for="manga in files" :key="manga.id" class="relative">
            <MangaCard :manga="manga" />
            <a-checkbox
              v-if="isRenameMode"
              class="absolute top-3 left-3 z-20 bg-white/80 px-2 py-1 rounded"
              :checked="selectedFilesForRename.has(manga.id)"
              @change="handleFileSelection(manga.id, $event.target.checked)"
            />
          </div>
        </div>

        <a-pagination
          v-if="files.length"
          class="mt-6 text-center"
          :current="pagination.page"
          :total="pagination.total_pages"
          :page-size="1"
          show-less-items
          @change="changePage"
        />

        <a-empty v-else :description="$t('libraryEmpty')">
          <template #description>
            <div class="text-center">
              <p>{{ $t('libraryEmpty') }}</p>
              <p>{{ $t('useScanToPopulate') }}</p>
            </div>
          </template>
        </a-empty>
      </template>
    </a-card>
  </a-space>
</template> 
