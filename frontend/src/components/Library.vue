<script setup>
import { ref, onMounted } from 'vue'
import { useLibraryStore } from '@/store/library'
import { storeToRefs } from 'pinia'
import MangaCard from './MangaCard.vue'
import { useRouter } from 'vue-router'
import axios from 'axios'
import { useI18n } from 'vue-i18n'

const { t } = useI18n();
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
    alert(t('pleaseFillLibraryPath'))
  }
}

const pickRandomManga = async () => {
  try {
    const response = await axios.get('/api/v1/files/random');
    if (response.data) {
      router.push({ name: 'reader', params: { id: response.data.id } });
    } else {
      alert(t('noMangaToPick'))
    }
  } catch (error) {
    console.error('Failed to pick random manga:', error);
    alert(t('failedToPickRandomManga'))
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
  const template = localStorage.getItem('mangaFilenameTemplate');
  if (!template) {
    alert(t('pleaseSaveFilenameTemplate'));
    return;
  }
  if (selectedFilesForRename.value.size === 0) {
    alert(t('pleaseSelectFileToRename'));
    return;
  }
  if (!libraryPath.value) {
    // A root path is needed to construct the new paths.
    alert(t('pleaseSpecifyLibraryRoot'));
    return;
  }

  try {
    const file_ids = Array.from(selectedFilesForRename.value);
    await axios.post('/api/v1/rename/batch', {
      file_ids,
      template,
      root_path: libraryPath.value
    });
    alert(t('batchRenameTaskStarted'));
    toggleRenameMode();
    libraryStore.fetchFiles(); // Refresh library
  } catch (error) {
    console.error('Failed to start batch rename:', error);
    alert(t('failedToStartBatchRename'));
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
  <div>
    <!-- Scanner Section -->
    <div class="p-6 bg-white rounded-lg shadow mb-6">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">{{ $t('libraryManagement') }}</h2>
      <div class="mb-4">
        <label for="library-path" class="block text-sm font-medium text-gray-600 mb-1">{{ $t('libraryPath') }}</label>
        <div class="flex">
          <input 
            id="library-path"
            type="text" 
            v-model="libraryPath" 
            :placeholder="t('libraryPathPlaceholder')"
            class="flex-grow p-2 border rounded-l-md focus:ring-monet-blue focus:border-monet-blue"
          />
          <button 
            @click="handleScan" 
            :disabled="scanStatus === 'scanning'"
            class="btn btn-primary rounded-l-none"
          >
            {{ scanStatus === 'scanning' ? t('scanning') : t('startScan') }}
          </button>
        </div>
      </div>
      <div v-if="scanStatus !== 'idle'" class="mt-4">
        <h3 class="font-semibold text-gray-700">{{ $t('scanProgress') }}</h3>
        <div class="mt-2">
          <div class="bg-monet-grey rounded-full h-4">
            <div 
              class="bg-monet-blue h-4 rounded-full transition-all duration-300 ease-in-out" 
              :style="{ width: scanProgress + '%' }"
            ></div>
          </div>
          <p class="text-sm text-gray-600 mt-1 text-center">{{ scanProgress.toFixed(2) }}%</p>
        </div>
        <p v-if="currentScanFile" class="text-sm text-gray-500 mt-2">
          <strong>{{ $t('status') }}:</strong> {{ scanStatus }} | <strong>{{ $t('processing') }}:</strong> <span class="truncate">{{ currentScanFile }}</span>
        </p>
        <p v-if="scanStatus === 'finished'" class="text-green-600 font-semibold">{{ $t('scanCompletedSuccessfully') }}</p>
        <p v-if="scanStatus === 'error'" class="text-red-600 font-semibold">{{ $t('scanErrorOccurred') }}</p>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="p-6 bg-white rounded-lg shadow mb-6">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">{{ $t('quickActions') }}</h2>
      <div class="flex space-x-2">
        <button @click="pickRandomManga" class="btn btn-primary">
          {{ $t('pickRandomManga') }}
        </button>
        <button @click="toggleRenameMode" class="btn btn-secondary">
          {{ isRenameMode ? t('cancelRename') : t('batchRename') }}
        </button>
        <button v-if="isRenameMode" @click="startBatchRename" class="btn btn-secondary">
          {{ t('applyTemplateToFiles', { count: selectedFilesForRename.size }) }}
        </button>
      </div>
    </div>

    <!-- Gallery Section -->
    <div class="p-6 bg-white rounded-lg shadow">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">{{ $t('myMangaLibrary') }}</h2>
      

      <div v-if="libraryStatus === 'error'" class="text-center text-red-500">
        <p>{{ $t('failedToLoadLibrary') }}</p>
      </div>
      
      <div v-else-if="files.length > 0">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          <div v-for="manga in files" :key="manga.id" class="relative">
            <MangaCard :manga="manga" />
            <input 
              v-if="isRenameMode" 
              type="checkbox"
              @change="e => handleFileSelection(manga.id, e.target.checked)"
              class="absolute top-2 left-2 h-5 w-5 z-20"
            />
          </div>
        </div>

        <!-- Pagination Controls -->
        <div class="mt-6 flex justify-center items-center space-x-2">
          <button @click="changePage(pagination.page - 1)" :disabled="pagination.page === 1" class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-monet-blue hover:text-white disabled:opacity-50">
            &laquo; {{ $t('prev') }}
          </button>
          <span class="text-sm text-gray-700">
            {{ $t('pageIndicator', { currentPage: pagination.page, totalPages: pagination.total_pages }) }}
          </span>
          <button @click="changePage(pagination.page + 1)" :disabled="pagination.page === pagination.total_pages" class="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-monet-blue hover:text-white disabled:opacity-50">
            {{ $t('next') }} &raquo;
          </button>
        </div>
      </div>

      <div v-else class="text-center text-gray-500">
        <p>{{ $t('libraryEmpty') }}</p>
        <p>{{ $t('useScanToPopulate') }}</p>
      </div>
    </div>
  </div>
</template> 