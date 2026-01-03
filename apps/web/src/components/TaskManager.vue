<template>
  <a-card :body-style="{ padding: '20px' }" class="shadow-sm">
    <div class="flex items-center justify-between mb-4">
      <a-typography-title :level="4" class="!mb-0">{{ $t('taskManager') }}</a-typography-title>
      <a-button type="primary" size="small" :loading="isLoading" @click="refreshTasks">
        {{ $t('refresh') }}
      </a-button>
    </div>

    <a-empty
      v-if="activeTasks.length === 0"
      :description="$t('noActiveTasksDescription')"
    >
      <template #description>
        <div class="text-center">
          <p class="font-medium text-gray-700">{{ $t('noActiveTasks') }}</p>
          <p class="text-sm text-gray-500">{{ $t('noActiveTasksDescription') }}</p>
        </div>
      </template>
    </a-empty>

    <a-space v-else direction="vertical" size="middle" class="w-full">
      <a-card
        v-for="task in activeTasks"
        :key="task.id"
        size="small"
        :title="task.name"
        :bordered="true"
      >
        <template #extra>
          <a-space size="small" align="center">
            <a-tag :color="getStatusMeta(task.status).tagColor">
              {{ getStatusText(task.status) }}
            </a-tag>
            <a-typography-text type="secondary">{{ getTaskTypeText(task.task_type) }}</a-typography-text>
            <a-typography-text type="secondary" v-if="task.created_at">
              {{ formatTime(task.created_at) }}
            </a-typography-text>
            <a-button
              v-if="task.is_active"
              danger
              size="small"
              :loading="isCancelling === task.id"
              @click="cancelTask(task.id)"
            >
              {{ isCancelling === task.id ? $t('cancelling') : $t('cancel') }}
            </a-button>
          </a-space>
        </template>

        <a-space direction="vertical" size="small" class="w-full">
          <div v-if="task.progress !== null">
            <div class="flex justify-between text-sm text-gray-500 mb-1">
              <span>{{ $t('progress') }}</span>
              <span>{{ Math.round(task.progress) }}%</span>
            </div>
            <a-progress
              :percent="Math.round(task.progress)"
              :status="getStatusMeta(task.status).progressStatus"
              :stroke-color="getStatusMeta(task.status).strokeColor"
              :show-info="false"
            />
          </div>

          <a-descriptions
            v-if="task.total_files > 0"
            size="small"
            :column="1"
            class="bg-gray-50 rounded-md p-2"
          >
            <a-descriptions-item :label="$t('filesProcessed')">
              {{ task.processed_files || 0 }} / {{ task.total_files }}
            </a-descriptions-item>
          </a-descriptions>

          <a-typography-paragraph v-if="task.current_file" code class="!mb-0">
            {{ task.current_file }}
          </a-typography-paragraph>

          <a-typography-paragraph v-if="task.target_path" class="!mb-0 text-gray-600">
            <strong>{{ $t('targetPath') }}:</strong> {{ task.target_path }}
          </a-typography-paragraph>

          <a-alert
            v-if="task.error_message"
            type="error"
            show-icon
            :message="$t('error')"
            :description="task.error_message"
          />

          <a-typography-text v-if="task.duration > 0" type="secondary">
            {{ $t('duration') }}: {{ formatDuration(task.duration) }}
          </a-typography-text>
        </a-space>
      </a-card>
    </a-space>

    <a-alert
      v-if="errorMessage"
      class="mt-4"
      type="error"
      show-icon
      :message="errorMessage"
    />
  </a-card>
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
    console.error('获取活跃任务失败：', error)
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
    await fetchActiveTasks()
  } catch (error) {
    console.error('取消任务失败：', error)
    errorMessage.value = t('failedToCancelTask')
  } finally {
    isCancelling.value = null
  }
}

function getStatusMeta(status) {
  switch (status) {
    case 'pending':
      return { tagColor: 'gold', progressStatus: 'active', strokeColor: '#faad14' }
    case 'running':
      return { tagColor: 'blue', progressStatus: 'active', strokeColor: '#1677ff' }
    case 'completed':
      return { tagColor: 'green', progressStatus: 'success', strokeColor: '#52c41a' }
    case 'failed':
      return { tagColor: 'red', progressStatus: 'exception', strokeColor: '#ff4d4f' }
    case 'cancelled':
      return { tagColor: 'default', progressStatus: 'normal', strokeColor: '#bfbfbf' }
    default:
      return { tagColor: 'blue', progressStatus: 'normal', strokeColor: '#1677ff' }
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

// 格式化耗时
function formatDuration(seconds) {
  if (seconds < 60) {
    return `${Math.round(seconds)}${t('secondsShort')}`
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60)
    const secs = Math.round(seconds % 60)
    return `${minutes}${t('minutesShort')} ${secs}${t('secondsShort')}`
  } else {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    return `${hours}${t('hoursShort')} ${minutes}${t('minutesShort')}`
  }
}

// 监听 WebSocket 事件
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
  // 任务完成时刷新列表
  fetchActiveTasks()
})

libraryStore.socket.on('task_error', (data) => {
  // 任务出错时刷新列表
  fetchActiveTasks()
})

onMounted(() => {
  fetchActiveTasks()
  // 每 30 秒自动刷新一次
  refreshInterval = setInterval(fetchActiveTasks, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>
