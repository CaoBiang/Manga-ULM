<script setup>
import { ref, onMounted } from 'vue'
import { useLibraryStore } from '@/store/library'
import { storeToRefs } from 'pinia'
import MangaCard from './MangaCard.vue'
import { useRouter } from 'vue-router'
import axios from 'axios'

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
    alert('请填写库路径。')
  }
}

const pickRandomManga = async () => {
  try {
    const response = await axios.get('/api/v1/files/random');
    if (response.data) {
      router.push({ name: 'reader', params: { id: response.data.id } });
    } else {
      alert('没有可供抽取的漫画。')
    }
  } catch (error) {
    console.error('Failed to pick random manga:', error);
    alert('无法抽取随机漫画。')
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
    alert('请先在设置中保存文件名模板。');
    return;
  }
  if (selectedFilesForRename.value.size === 0) {
    alert('请至少选择一个要重命名的文件。');
    return;
  }
  if (!libraryPath.value) {
    // A root path is needed to construct the new paths.
    alert('请指定库根路径以确保正确重命名。');
    return;
  }

  try {
    const file_ids = Array.from(selectedFilesForRename.value);
    await axios.post('/api/v1/rename/batch', {
      file_ids,
      template,
      root_path: libraryPath.value
    });
    alert('批量重命名任务已启动！你可以通过WebSocket消息（目前请查看开发者控制台）监控进度。');
    toggleRenameMode();
    libraryStore.fetchFiles(); // Refresh library
  } catch (error) {
    console.error('Failed to start batch rename:', error);
    alert('启动批量重命名任务出错。');
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
      <h2 class="text-xl font-semibold text-gray-700 mb-4">库管理</h2>
      <div class="mb-4">
        <label for="library-path" class="block text-sm font-medium text-gray-600 mb-1">库路径：</label>
        <div class="flex">
          <input 
            id="library-path"
            type="text" 
            v-model="libraryPath" 
            placeholder="例如：C:\\Users\\YourUser\\Documents\\Manga"
            class="flex-grow p-2 border rounded-l-md focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button 
            @click="handleScan" 
            :disabled="scanStatus === 'scanning'"
            class="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-r-md hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
          >
            {{ scanStatus === 'scanning' ? '正在扫描...' : '开始扫描' }}
          </button>
        </div>
      </div>
      <div v-if="scanStatus !== 'idle'" class="mt-4">
        <h3 class="font-semibold text-gray-700">Scan Progress</h3>
        <div class="mt-2">
          <div class="bg-gray-200 rounded-full h-4">
            <div 
              class="bg-green-500 h-4 rounded-full transition-all duration-300 ease-in-out" 
              :style="{ width: scanProgress + '%' }"
            ></div>
          </div>
          <p class="text-sm text-gray-600 mt-1 text-center">{{ scanProgress.toFixed(2) }}%</p>
        </div>
        <p v-if="currentScanFile" class="text-sm text-gray-500 mt-2">
          <strong>Status:</strong> {{ scanStatus }} | <strong>Processing:</strong> <span class="truncate">{{ currentScanFile }}</span>
        </p>
        <p v-if="scanStatus === 'finished'" class="text-green-600 font-semibold">Scan completed successfully!</p>
        <p v-if="scanStatus === 'error'" class="text-red-600 font-semibold">An error occurred during the scan.</p>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="p-6 bg-white rounded-lg shadow mb-6">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">快捷操作</h2>
      <div class="flex space-x-2">
        <button @click="pickRandomManga" class="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700">
          随机抽取一本漫画
        </button>
        <button @click="toggleRenameMode" class="px-4 py-2 bg-orange-500 text-white rounded-md hover:bg-orange-600">
          {{ isRenameMode ? '取消重命名' : '批量重命名' }}
        </button>
        <button v-if="isRenameMode" @click="startBatchRename" class="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">
          应用模板到 {{ selectedFilesForRename.size }} 个文件
        </button>
      </div>
    </div>

    <!-- Gallery Section -->
    <div class="p-6 bg-white rounded-lg shadow">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">我的漫画库</h2>
      
      <div v-if="libraryStatus === 'loading'" class="text-center">
        <p>正在加载漫画库...</p>
      </div>

      <div v-else-if="libraryStatus === 'error'" class="text-center text-red-500">
        <p>加载漫画库失败，请稍后重试。</p>
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
          <button @click="changePage(pagination.page - 1)" :disabled="pagination.page === 1" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">
            &laquo; 上一页
          </button>
          <span class="text-sm text-gray-700">
            第 {{ pagination.page }} 页 / 共 {{ pagination.total_pages }} 页
          </span>
          <button @click="changePage(pagination.page + 1)" :disabled="pagination.page === pagination.total_pages" class="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50">
            下一页 &raquo;
          </button>
        </div>
      </div>

      <div v-else class="text-center text-gray-500">
        <p>Your library is empty.</p>
        <p>Use the form above to scan a directory containing your manga.</p>
      </div>
    </div>
  </div>
</template> 