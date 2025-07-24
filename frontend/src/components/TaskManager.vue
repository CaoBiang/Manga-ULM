<template>
  <div class="space-y-4">
    <!-- 任务管理器标题 -->
    <div class="flex justify-between items-center">
      <h3 class="text-lg font-semibold text-gray-800">{{ $t('taskManager') }}</h3>
      <button 
        @click="refreshTasks"
        class="btn btn-primary btn-sm"
        :disabled="isLoading"
      >
        {{ $t('refresh') }}
      </button>
    </div>

    <!-- 加载状态 -->

    <!-- 无活跃任务 -->
    <div v-if="activeTasks.length === 0" class="text-center py-8">
      <div class="text-gray-400">
        <svg class="mx-auto h-12 w-12 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
        </svg>
        <p class="text-lg font-medium">{{ $t('noActiveTasks') }}</p>
        <p class="text-sm">{{ $t('noActiveTasksDescription') }}</p>
      </div>
    </div>

    <!-- 活跃任务列表 -->
    <div v-else class="space-y-3">
      <div 
        v-for="task in activeTasks" 
        :key="task.id"
        class="bg-white border border-gray-200 rounded-lg p-4 shadow-sm"
      >
        <!-- 任务头部 -->
        <div class="flex justify-between items-start mb-3">
          <div class="flex-1">
            <h4 class="font-medium text-gray-900">{{ task.name }}</h4>
            <div class="flex items-center space-x-2 mt-1">
              <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium"
                    :class="getStatusClass(task.status)">
                {{ getStatusText(task.status) }}
              </span>
              <span class="text-xs text-gray-500">{{ getTaskTypeText(task.task_type) }}</span>
              <span v-if="task.created_at" class="text-xs text-gray-500">
                {{ formatTime(task.created_at) }}
              </span>
            </div>
          </div>
          
          <!-- 取消按钮 -->
          <button 
            v-if="task.is_active"
            @click="cancelTask(task.id)"
            class="btn btn-danger btn-sm"
            :disabled="isCancelling === task.id"
          >
            {{ isCancelling === task.id ? $t('cancelling') : $t('cancel') }}
          </button>
        </div>

        <!-- 进度条 -->
        <div v-if="task.progress !== null" class="mb-3">
          <div class="flex justify-between items-center mb-1">
            <span class="text-sm text-gray-600">{{ $t('progress') }}</span>
            <span class="text-sm text-gray-600">{{ Math.round(task.progress) }}%</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div 
              class="h-2 rounded-full transition-all duration-300"
              :class="getProgressClass(task.status)"
              :style="{ width: task.progress + '%' }"
            ></div>
          </div>
        </div>

        <!-- 文件处理信息 -->
        <div v-if="task.total_files > 0" class="mb-3">
          <div class="flex justify-between items-center text-sm text-gray-600">
            <span>{{ $t('filesProcessed') }}</span>
            <span>{{ task.processed_files || 0 }} / {{ task.total_files }}</span>
          </div>
        </div>

        <!-- 当前处理文件 -->
        <div v-if="task.current_file" class="mb-3">
          <p class="text-sm text-gray-600 mb-1">{{ $t('currentFile') }}</p>
          <p class="text-sm text-gray-800 bg-gray-50 p-2 rounded border font-mono break-all">
            {{ task.current_file }}
          </p>
        </div>

        <!-- 目标路径 -->
        <div v-if="task.target_path" class="mb-3">
          <p class="text-sm text-gray-600 mb-1">{{ $t('targetPath') }}</p>
          <p class="text-sm text-gray-800 bg-gray-50 p-2 rounded border break-all">
            {{ task.target_path }}
          </p>
        </div>

        <!-- 错误信息 -->
        <div v-if="task.error_message" class="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <p class="text-sm text-red-800">
            <strong>{{ $t('error') }}:</strong> {{ task.error_message }}
          </p>
        </div>

        <!-- 任务时长 -->
        <div v-if="task.duration > 0" class="mt-3 text-xs text-gray-500">
          {{ $t('duration') }}: {{ formatDuration(task.duration) }}
        </div>
      </div>
    </div>

    <!-- 错误消息 -->
    <div v-if="errorMessage" class="bg-red-50 border border-red-200 rounded-md p-3">
      <p class="text-sm text-red-800">{{ errorMessage }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useLibraryStore } from '@/store/library'
import { useI18n } from 'vue-i18n'
import axios from 'axios'

const { t } = useI18n()
const libraryStore = useLibraryStore()

const activeTasks = ref([])
const isLoading = ref(false)
const isCancelling = ref(null)
const errorMessage = ref('')
let refreshInterval = null

// 获取活跃任务
async function fetchActiveTasks() {
  try {
    isLoading.value = true
    errorMessage.value = ''
    const response = await axios.get('/api/v1/tasks/active')
    activeTasks.value = response.data.tasks
  } catch (error) {
    console.error('Failed to fetch active tasks:', error)
    errorMessage.value = t('failedToFetchTasks')
  } finally {
    isLoading.value = false
  }
}

// 刷新任务
async function refreshTasks() {
  await fetchActiveTasks()
}

// 取消任务
async function cancelTask(taskId) {
  if (!confirm(t('confirmCancelTask'))) {
    return
  }

  try {
    isCancelling.value = taskId
    await libraryStore.cancelTask(taskId)
    await fetchActiveTasks() // 刷新任务列表
  } catch (error) {
    console.error('Failed to cancel task:', error)
    errorMessage.value = t('failedToCancelTask')
  } finally {
    isCancelling.value = null
  }
}

// 获取状态样式类
function getStatusClass(status) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-100 text-yellow-800'
    case 'running':
      return 'bg-blue-100 text-blue-800'
    case 'completed':
      return 'bg-green-100 text-green-800'
    case 'failed':
      return 'bg-red-100 text-red-800'
    case 'cancelled':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

// 获取进度条样式类
function getProgressClass(status) {
  switch (status) {
    case 'pending':
      return 'bg-yellow-500'
    case 'running':
      return 'bg-blue-500'
    case 'completed':
      return 'bg-green-500'
    case 'failed':
      return 'bg-red-500'
    case 'cancelled':
      return 'bg-gray-500'
    default:
      return 'bg-blue-500'
  }
}

// 获取状态文本
function getStatusText(status) {
  switch (status) {
    case 'pending':
      return t('pending')
    case 'running':
      return t('running')
    case 'completed':
      return t('completed')
    case 'failed':
      return t('failed')
    case 'cancelled':
      return t('cancelled')
    default:
      return status
  }
}

// 获取任务类型文本
function getTaskTypeText(taskType) {
  switch (taskType) {
    case 'scan':
      return t('scanTask')
    case 'rename':
      return t('renameTask')
    case 'backup':
      return t('backupTask')
    case 'split':
      return t('splitTask')
    case 'delete':
      return t('deleteTask')
    default:
      return taskType
  }
}

// 格式化时间
function formatTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleString()
}

// 格式化时长
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`
  } else if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}h ${minutes}m`
  }
}

// 监听WebSocket事件
libraryStore.socket.on('task_progress', (data) => {
  // 更新对应任务的状态
  const task = activeTasks.value.find(t => t.id === data.task_id)
  if (task) {
    task.progress = data.progress
    task.current_file = data.current_file
    task.status = data.status || task.status
  }
})

libraryStore.socket.on('task_complete', (data) => {
  // 任务完成，刷新任务列表
  fetchActiveTasks()
})

libraryStore.socket.on('task_error', (data) => {
  // 任务出错，刷新任务列表
  fetchActiveTasks()
})

onMounted(() => {
  fetchActiveTasks()
  // 每30秒自动刷新一次
  refreshInterval = setInterval(fetchActiveTasks, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script> 