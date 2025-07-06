<template>
  <div class="space-y-6">
    <!-- 扫描状态显示 -->
    <div v-if="libraryStore.scanStatus !== 'idle'" class="bg-blue-50 border border-blue-200 rounded-lg p-4">
      <h3 class="text-lg font-semibold text-blue-800 mb-3">{{ $t('scanStatus') }}</h3>
      
      <!-- 进度条 -->
      <div class="mb-4">
        <div class="flex justify-between items-center mb-2">
          <span class="text-sm font-medium text-blue-700">
            {{ getStatusText() }}
          </span>
          <span class="text-sm text-blue-600">{{ Math.round(libraryStore.scanProgress) }}%</span>
        </div>
        <div class="w-full bg-blue-200 rounded-full h-2">
          <div 
            class="bg-blue-600 h-2 rounded-full transition-all duration-300"
            :style="{ width: libraryStore.scanProgress + '%' }"
          ></div>
        </div>
      </div>

      <!-- 当前处理的文件 -->
      <div v-if="libraryStore.currentScanFile" class="mb-3">
        <p class="text-sm text-gray-600 mb-1">当前处理文件：</p>
        <p class="text-sm text-gray-800 bg-white p-2 rounded border font-mono break-all">
          {{ libraryStore.currentScanFile }}
        </p>
      </div>

      <!-- 活跃任务列表 -->
      <div v-if="libraryStore.activeTasks.length > 0" class="mb-3">
        <p class="text-sm text-gray-600 mb-2">活跃任务：</p>
        <div class="space-y-2">
          <div 
            v-for="task in libraryStore.activeTasks.filter(t => t.task_type === 'scan')" 
            :key="task.id"
            class="bg-white p-3 rounded border text-sm"
          >
            <div class="flex justify-between items-start">
              <div class="flex-1">
                <p class="font-medium text-gray-800">{{ task.name }}</p>
                <p class="text-gray-600 text-xs mt-1">
                  {{ $t('status') }}: {{ getTaskStatusText(task.status) }}
                  <span v-if="task.total_files > 0" class="ml-2">
                    ({{ task.processed_files || 0 }}/{{ task.total_files }})
                  </span>
                </p>
                <p v-if="task.current_file" class="text-gray-500 text-xs mt-1 font-mono">
                  {{ libraryStore.currentScanFile }}
                </p>
              </div>
              <button 
                v-if="task.is_active"
                @click="cancelTask(task.id)"
                class="ml-2 px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
              >
                {{ $t('cancel') }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- 操作按钮 -->
      <div class="flex space-x-2">
        <button 
          @click="libraryStore.clearErrors()"
          class="px-3 py-1 text-sm bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          {{ $t('clearErrors') }}
        </button>
        <button 
          @click="libraryStore.checkActiveTasks()"
          class="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          {{ $t('refreshStatus') }}
        </button>
      </div>
    </div>

    <!-- 错误消息显示 -->
    <div v-if="libraryStore.scanErrors.length > 0" class="bg-red-50 border border-red-200 rounded-lg p-4">
      <h3 class="text-lg font-semibold text-red-800 mb-3">{{ $t('scanErrors') }}</h3>
      <div class="space-y-2 max-h-40 overflow-y-auto">
        <div 
          v-for="(error, index) in libraryStore.scanErrors" 
          :key="index"
          class="bg-white p-2 rounded border text-sm"
        >
          <p class="text-red-800">{{ error.message }}</p>
          <p class="text-red-600 text-xs mt-1">{{ formatTime(error.timestamp) }}</p>
        </div>
      </div>
    </div>

    <!-- Path Management -->
    <div>
      <h3 class="text-lg font-semibold text-gray-700 mb-2">{{ $t('mangaLibraryFolders') }}</h3>
      <div class="space-y-2">
        <div v-for="p in libraryPaths" :key="p.id" class="flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
          <span class="flex-grow truncate" :title="p.path">{{ p.path }}</span>
          <button 
            @click="startScan(p.path)" 
            :disabled="libraryStore.hasActiveScanTasks"
            class="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed"
          >
            {{ libraryStore.hasActiveScanTasks ? $t('scanning') : $t('scan') }}
          </button>
          <button 
            @click="deletePath(p.id)" 
            class="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600"
          >
            {{ $t('delete') }}
          </button>
        </div>
        <div v-if="libraryPaths.length === 0" class="text-sm text-gray-500 text-center py-2">
          {{ $t('noLibraryPath') }}
        </div>
      </div>
      
      <!-- Add New Path -->
      <div class="mt-4">
        <label for="new-path" class="block text-sm font-medium text-gray-600 mb-1">{{ $t('addNewFolder') }}</label>
        <div class="flex space-x-2">
          <input
            id="new-path"
            type="text"
            v-model.trim="newPath"
            :placeholder="$t('pathPlaceholder')"
            class="flex-grow p-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button 
            @click="addPath" 
            class="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700"
          >
            {{ $t('add') }}
          </button>
        </div>
      </div>
      
      <!-- Scan All -->
      <div class="mt-4 border-t pt-4">
        <button
          @click="scanAll"
          :disabled="libraryStore.hasActiveScanTasks"
          class="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
        >
          {{ libraryStore.hasActiveScanTasks ? $t('scanning') : $t('scanAll') }}
        </button>
      </div>
    </div>

    <!-- Worker Settings -->
    <div class="border-t pt-6">
      <h3 class="text-lg font-semibold text-gray-700 mb-2">{{ $t('advancedSettings') }}</h3>
      <div>
        <label for="max-workers" class="block text-sm font-medium text-gray-600 mb-1">
          {{ $t('maxParallelScanProcesses') }}
        </label>
        <input 
          id="max-workers"
          type="number" 
          v-model.number="maxWorkers"
          @change="saveSetting('scan.max_workers', maxWorkers)"
          min="1"
          class="w-full p-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
        />
        <p class="text-xs text-gray-500 mt-1">
          {{ $t('maxParallelScanProcessesHelp') }}
        </p>
      </div>
    </div>

    <!-- 状态消息 -->
    <div v-if="statusMessage" :class="statusClass" class="p-2 rounded-md text-sm mt-4">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import axios from 'axios'
import { useLibraryStore } from '@/store/library'

const libraryStore = useLibraryStore()

const libraryPaths = ref([])
const newPath = ref('')
const maxWorkers = ref(12)
const statusMessage = ref('')
const isError = ref(false)

const statusClass = computed(() => {
  return isError.value 
    ? 'bg-red-100 text-red-700' 
    : 'bg-green-100 text-green-700'
})

// 格式化时间
function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString()
}

// 获取状态文本
function getStatusText() {
  switch (libraryStore.scanStatus) {
    case 'scanning':
      return '正在扫描...'
    case 'finished':
      return '扫描完成'
    case 'error':
      return '扫描出错'
    case 'pending':
      return '等待扫描...'
    default:
      return '空闲'
  }
}

// 获取任务状态文本
function getTaskStatusText(status) {
  switch (status) {
    case 'pending':
      return '等待中'
    case 'running':
      return '运行中'
    case 'completed':
      return '已完成'
    case 'failed':
      return '失败'
    case 'cancelled':
      return '已取消'
    default:
      return status
  }
}

// 取消任务
async function cancelTask(taskId) {
  if (!confirm('确定要取消此扫描任务吗？')) {
    return
  }

  try {
    await libraryStore.cancelTask(taskId)
    statusMessage.value = '任务已取消'
    isError.value = false
  } catch (error) {
    console.error('Failed to cancel task:', error)
    statusMessage.value = '取消任务失败'
    isError.value = true
  }
  
  setTimeout(() => statusMessage.value = '', 3000)
}

async function fetchLibraryPaths() {
  try {
    const response = await axios.get('/api/v1/library_paths')
    libraryPaths.value = response.data
  } catch (error) {
    console.error('Failed to fetch library paths:', error)
    statusMessage.value = '获取库路径失败'
    isError.value = true
  }
}

async function addPath() {
  if (!newPath.value) {
    alert('请输入路径')
    return
  }
  
  try {
    await axios.post('/api/v1/library_paths', { path: newPath.value })
    newPath.value = ''
    await fetchLibraryPaths()
    statusMessage.value = '路径添加成功'
    isError.value = false
  } catch (error) {
    console.error('Failed to add path:', error)
    statusMessage.value = error.response?.data?.error || '添加路径失败'
    isError.value = true
  }
  
  setTimeout(() => statusMessage.value = '', 3000)
}

async function deletePath(id) {
  if (!confirm('确定要从库中移除此文件夹吗？（不会删除磁盘上的文件）')) {
    return
  }
  
  try {
    await axios.delete(`/api/v1/library_paths/${id}`)
    await fetchLibraryPaths()
    statusMessage.value = '路径删除成功'
    isError.value = false
  } catch (error) {
    console.error('Failed to delete path:', error)
    statusMessage.value = error.response?.data?.error || '删除路径失败'
    isError.value = true
  }
  
  setTimeout(() => statusMessage.value = '', 3000)
}

async function fetchSettings() {
  try {
    const workersRes = await axios.get('/api/v1/settings/scan.max_workers').catch(e => e.response)
    if (workersRes && workersRes.status === 200 && workersRes.data['scan.max_workers'] !== null) {
      maxWorkers.value = parseInt(workersRes.data['scan.max_workers'], 10)
    }
  } catch (error) {
    console.error('Failed to fetch settings:', error)
    statusMessage.value = '获取高级设置失败'
    isError.value = true
  }
}

async function saveSetting(key, value) {
  try {
    await axios.post(`/api/v1/settings/${key}`, { value })
    statusMessage.value = '设置保存成功！'
    isError.value = false
  } catch (error) {
    console.error(`Failed to save setting ${key}:`, error)
    statusMessage.value = '保存设置失败'
    isError.value = true
  }
  
  setTimeout(() => statusMessage.value = '', 3000)
}

async function startScan(path) {
  try {
    await libraryStore.startScan(path)
    statusMessage.value = `开始扫描 ${path}...`
    isError.value = false
  } catch (error) {
    console.error(`Failed to start scan for ${path}:`, error)
    statusMessage.value = error.response?.data?.error || '启动扫描失败'
    isError.value = true
  }
  
  setTimeout(() => statusMessage.value = '', 3000)
}

async function scanAll() {
  try {
    await libraryStore.startScanAll()
    statusMessage.value = '开始扫描所有库文件夹...'
    isError.value = false
  } catch (error) {
    console.error('Failed to start scan all:', error)
    statusMessage.value = error.response?.data?.error || '启动全部扫描失败'
    isError.value = true
  }
  
  setTimeout(() => statusMessage.value = '', 3000)
}

onMounted(() => {
  fetchLibraryPaths()
  fetchSettings()
  // 检查是否有活跃任务
  libraryStore.checkActiveTasks()
})
</script> 