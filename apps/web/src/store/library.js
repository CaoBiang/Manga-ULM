import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import io from 'socket.io-client'

export const useLibraryStore = defineStore('library', () => {
  // State for scanning
  const scanProgress = ref(0)
  const scanStatus = ref('idle') // idle, scanning, finished, error
  const currentScanFile = ref('')
  const currentScanMessageKey = ref(null)
  const taskId = ref(null)
  const dbTaskId = ref(null)
  const activeTasks = ref([])
  const scanErrors = ref([])

  const pushScanError = ({ message = null, messageKey = null }) => {
    scanErrors.value.push({
      message,
      messageKey,
      timestamp: new Date().toISOString()
    })
  }

  // State for library display
  const files = ref([])
  const pagination = ref({
    page: 1,
    per_page: 20,
    total_pages: 1,
    total_items: 0,
  })
  const libraryStatus = ref('idle') // idle, loading, success, error

  const socket = io({ transports: ['websocket'] })

  // Computed properties
  const hasActiveScanTasks = computed(() => {
    return activeTasks.value.some(task => task.task_type === 'scan' && task.is_active)
  })

  const currentScanTask = computed(() => {
    return activeTasks.value.find(task => task.task_type === 'scan' && task.is_active)
  })

  socket.on('connect', () => {
    console.log('Connected to WebSocket server')
    // 连接后检查活跃任务
    checkActiveTasks()
  })

  socket.on('scan_progress', (data) => {
    scanProgress.value = data.progress
    currentScanFile.value = data.current_file || ''
    currentScanMessageKey.value = null
    scanStatus.value = 'scanning'
    
    // 更新对应的任务状态
    if (data.task_id) {
      const task = activeTasks.value.find(t => t.id === data.task_id)
      if (task) {
        task.progress = data.progress
        task.current_file = data.current_file
        task.status = 'running'
      }
    }
  })

  socket.on('scan_complete', (data) => {
    scanProgress.value = 100
    scanStatus.value = 'finished'
    currentScanFile.value = ''
    currentScanMessageKey.value = 'scanCompleteMessage'
    console.log('Scan complete:', data.message)
    
    // 更新任务状态
    if (data.task_id) {
      const task = activeTasks.value.find(t => t.id === data.task_id)
      if (task) {
        task.progress = 100
        task.status = 'completed'
        task.finished_at = new Date().toISOString()
      }
    }
    
    // 刷新库文件列表
    fetchFiles(1)
    
    // 3秒后重置扫描状态
    setTimeout(() => {
      scanStatus.value = 'idle'
      checkActiveTasks()
    }, 3000)
  })
  
  socket.on('scan_error', (data) => {
    scanStatus.value = 'error'
    pushScanError({ message: data.error })
    console.error('Scan error:', data.error)
    
    // 更新任务状态
    if (data.task_id) {
      const task = activeTasks.value.find(t => t.id === data.task_id)
      if (task) {
        task.status = 'failed'
        task.error_message = data.error
        task.finished_at = new Date().toISOString()
      }
    }
  })

  // 检查活跃任务
  async function checkActiveTasks() {
    try {
      const response = await axios.get('/api/v1/tasks/active')
      activeTasks.value = response.data.tasks
      
      // 如果有活跃的扫描任务，更新扫描状态
      const activeScanTask = activeTasks.value.find(task => 
        task.task_type === 'scan' && task.is_active
      )
      
      if (activeScanTask) {
        scanStatus.value = activeScanTask.status === 'running' ? 'scanning' : 'pending'
        scanProgress.value = activeScanTask.progress || 0
        const hasFile = !!activeScanTask.current_file
        currentScanFile.value = hasFile ? activeScanTask.current_file : ''
        currentScanMessageKey.value = hasFile ? null : 'preparingScanMessage'
        dbTaskId.value = activeScanTask.id
        taskId.value = activeScanTask.task_id
      } else {
        scanStatus.value = 'idle'
        scanProgress.value = 0
        currentScanFile.value = ''
        currentScanMessageKey.value = null
        dbTaskId.value = null
        taskId.value = null
      }
    } catch (error) {
      console.error('Failed to check active tasks:', error)
    }
  }

  // 获取任务详情
  async function getTaskDetails(taskId) {
    try {
      const response = await axios.get(`/api/v1/tasks/${taskId}`)
      return response.data
    } catch (error) {
      console.error('Failed to get task details:', error)
      return null
    }
  }

  // 获取活跃的扫描任务
  async function getActiveScanTasks() {
    try {
      const response = await axios.get('/api/v1/tasks/scan/active')
      return response.data.tasks
    } catch (error) {
      console.error('Failed to get active scan tasks:', error)
      return []
    }
  }

  async function startScan(libraryPathId) {
    try {
      // 清空之前的错误
      scanErrors.value = []
      
      scanStatus.value = 'scanning'
      scanProgress.value = 0
      currentScanFile.value = ''
      currentScanMessageKey.value = 'initializingScanMessage'
      
      const response = await axios.post('/api/v1/library/scan', { library_path_id: libraryPathId })
      taskId.value = response.data.task_id
      dbTaskId.value = response.data.db_task_id
      
      // 添加新任务到活跃任务列表
      if (response.data.db_task_id) {
        const taskDetails = await getTaskDetails(response.data.db_task_id)
        if (taskDetails) {
          activeTasks.value.push(taskDetails)
        }
      }
      
      return response.data
    } catch (error) {
      console.error('Failed to start scan:', error)
      scanStatus.value = 'error'
      pushScanError({
        message: error.response?.data?.error || null,
        messageKey: error.response?.data?.error ? null : 'failedToStartScan'
      })
      throw error
    }
  }

  async function startScanAll() {
    try {
      // 清空之前的错误
      scanErrors.value = []
      
      scanStatus.value = 'scanning'
      scanProgress.value = 0
      currentScanFile.value = ''
      currentScanMessageKey.value = 'startingScanAllMessage'
      
      const response = await axios.post('/api/v1/library/scan_all')
      
      // 添加所有新任务到活跃任务列表
      if (response.data.tasks) {
        for (const task of response.data.tasks) {
          if (task.db_task_id) {
            const taskDetails = await getTaskDetails(task.db_task_id)
            if (taskDetails) {
              activeTasks.value.push(taskDetails)
            }
          }
        }
      }
      
      return response.data
    } catch (error) {
      console.error('Failed to start scan all:', error)
      scanStatus.value = 'error'
      pushScanError({
        message: error.response?.data?.error || null,
        messageKey: error.response?.data?.error ? null : 'failedToStartScanAll'
      })
      throw error
    }
  }

  // 取消任务
  async function cancelTask(taskId) {
    try {
      const response = await axios.post(`/api/v1/tasks/${taskId}/cancel`)
      
      // 更新本地任务状态
      const task = activeTasks.value.find(t => t.id === taskId)
      if (task) {
        task.status = 'cancelled'
        task.finished_at = new Date().toISOString()
      }
      
      return response.data
    } catch (error) {
      console.error('Failed to cancel task:', error)
      throw error
    }
  }

  // 清理错误信息
  function clearErrors() {
    scanErrors.value = []
  }

  // 重置扫描状态
  function resetScanStatus() {
    scanStatus.value = 'idle'
    scanProgress.value = 0
    currentScanFile.value = ''
    currentScanMessageKey.value = null
    taskId.value = null
    dbTaskId.value = null
  }

  async function fetchFiles(page = 1) {
    try {
      libraryStatus.value = 'loading'
      const response = await axios.get(`/api/v1/files`, {
        params: { page, per_page: pagination.value.per_page }
      })
      
      files.value = response.data.files || []
      const pageInfo = response.data.pagination || {}
      pagination.value = {
        page: pageInfo.page || 1,
        per_page: pageInfo.per_page || pagination.value.per_page || 20,
        total_pages: pageInfo.total_pages || 1,
        total_items: pageInfo.total_items || 0
      }
      
      libraryStatus.value = 'success'
    } catch (error) {
      console.error('Failed to fetch files:', error)
      libraryStatus.value = 'error'
    }
  }

  // 定期检查活跃任务（每30秒）
  setInterval(checkActiveTasks, 30000)

  return {
    // State
    scanProgress,
    scanStatus,
    currentScanFile,
    currentScanMessageKey,
    taskId,
    dbTaskId,
    activeTasks,
    scanErrors,
    files,
    pagination,
    libraryStatus,
    
    // Socket instance
    socket,
    
    // Computed
    hasActiveScanTasks,
    currentScanTask,
    
    // Actions
    startScan,
    startScanAll,
    cancelTask,
    checkActiveTasks,
    getTaskDetails,
    getActiveScanTasks,
    clearErrors,
    resetScanStatus,
    fetchFiles
  }
}) 
