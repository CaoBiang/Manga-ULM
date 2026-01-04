import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'

export const useLibraryStore = defineStore('library', () => {
  // 扫描状态：idle | pending | scanning | finished | error
  const scanProgress = ref(0)
  const scanStatus = ref('idle')
  const currentScanFile = ref('')
  const currentScanMessageKey = ref(null)

  // 任务信息（dbTaskId 用于轮询，taskId 为 Huey 任务 ID）
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

  // 图书馆展示状态
  const files = ref([])
  const pagination = ref({
    page: 1,
    per_page: 20,
    total_pages: 1,
    total_items: 0
  })
  const libraryStatus = ref('idle') // idle | loading | success | error

  // 轮询控制（Pinia store 生命周期较长，这里用内部变量即可）
  let slowPollTimer = null
  let fastPollTimer = null
  let scanQueueTimer = null
  let scanTicking = false
  let scanQueue = []
  let scanQueueHasFailure = false

  const hasActiveScanTasks = computed(() => activeTasks.value.some(task => task.task_type === 'scan' && task.is_active))

  const currentScanTask = computed(() => {
    const running = activeTasks.value.find(task => task.task_type === 'scan' && task.status === 'running')
    if (running) return running
    return activeTasks.value.find(task => task.task_type === 'scan' && task.is_active) || null
  })

  const _setScanIdle = () => {
    scanStatus.value = 'idle'
    scanProgress.value = 0
    currentScanFile.value = ''
    currentScanMessageKey.value = null
    taskId.value = null
    dbTaskId.value = null
  }

  const _stopScanQueueTimer = () => {
    if (scanQueueTimer) {
      clearInterval(scanQueueTimer)
      scanQueueTimer = null
    }
    scanQueue = []
    scanQueueHasFailure = false
    scanTicking = false
  }

  const _finalizeScanQueue = async () => {
    scanProgress.value = 100
    currentScanFile.value = ''
    currentScanMessageKey.value = scanQueueHasFailure ? null : 'scanCompleteMessage'
    scanStatus.value = scanQueueHasFailure ? 'error' : 'finished'

    await fetchFiles(1)
    await checkActiveTasks()

    setTimeout(() => {
      _setScanIdle()
    }, 3000)
  }

  const _startScanQueue = async (dbTaskIds) => {
    _stopScanQueueTimer()
    scanQueue = (dbTaskIds || []).filter(Boolean)
    scanQueueHasFailure = false

    if (scanQueue.length === 0) {
      _setScanIdle()
      return
    }

    dbTaskId.value = scanQueue[0]
    scanStatus.value = 'scanning'
    scanProgress.value = 0
    currentScanFile.value = ''
    currentScanMessageKey.value = 'initializingScanMessage'

    await checkActiveTasks()
    await _tickScanQueue()

    scanQueueTimer = setInterval(_tickScanQueue, 1000)
  }

  async function _tickScanQueue() {
    if (scanTicking) return
    scanTicking = true

    try {
      if (scanQueue.length === 0) {
        await _finalizeScanQueue()
        _stopScanQueueTimer()
        return
      }

      const currentId = scanQueue[0]
      dbTaskId.value = currentId

      const task = await getTaskDetails(currentId)
      if (!task) return

      taskId.value = task.task_id || null
      scanProgress.value = Number(task.progress ?? 0)
      currentScanFile.value = task.current_file || ''

      if (task.status === 'pending') {
        scanStatus.value = 'pending'
        currentScanMessageKey.value = currentScanFile.value ? null : 'preparingScanMessage'
      } else if (task.status === 'running') {
        scanStatus.value = 'scanning'
        currentScanMessageKey.value = null
      }

      if (task.status === 'cancelled') {
        _stopScanQueueTimer()
        _setScanIdle()
        await checkActiveTasks()
        return
      }

      if (!task.is_active) {
        if (task.status === 'failed') {
          scanQueueHasFailure = true
          pushScanError({ message: task.error_message || '扫描任务失败' })
        }
        scanQueue.shift()
        if (scanQueue.length === 0) {
          await _finalizeScanQueue()
          _stopScanQueueTimer()
        }
      }
    } catch (error) {
      console.error('轮询扫描任务失败:', error)
    } finally {
      scanTicking = false
    }
  }

  // 获取活跃任务，并根据活跃情况调整轮询频率
  async function checkActiveTasks() {
    try {
      const response = await axios.get('/api/v1/tasks/active')
      activeTasks.value = response.data.tasks || []
    } catch (error) {
      console.error('获取活跃任务失败:', error)
      return
    }

    const hasActive = activeTasks.value.some(t => t.is_active)
    if (hasActive && !fastPollTimer) {
      fastPollTimer = setInterval(checkActiveTasks, 2000)
    }
    if (!hasActive && fastPollTimer) {
      clearInterval(fastPollTimer)
      fastPollTimer = null
    }

    // 刷新页面后：如果当前没有扫描队列在运行，则用活跃扫描任务回填 UI
    if (!scanQueueTimer) {
      const scanTask = currentScanTask.value
      if (scanTask) {
        scanStatus.value = scanTask.status === 'running' ? 'scanning' : 'pending'
        scanProgress.value = Number(scanTask.progress ?? 0)
        currentScanFile.value = scanTask.current_file || ''
        currentScanMessageKey.value = currentScanFile.value ? null : 'preparingScanMessage'
        dbTaskId.value = scanTask.id
        taskId.value = scanTask.task_id
      } else if (scanStatus.value !== 'idle') {
        // 没有扫描任务时，避免长期停留在 scanning/pending 状态
        _setScanIdle()
      }
    }
  }

  // 获取任务详情
  async function getTaskDetails(taskId) {
    try {
      const response = await axios.get(`/api/v1/tasks/${taskId}`)
      return response.data
    } catch (error) {
      console.error('获取任务详情失败:', error)
      return null
    }
  }

  // 获取活跃的扫描任务
  async function getActiveScanTasks() {
    try {
      const response = await axios.get('/api/v1/tasks/scan/active')
      return response.data.tasks || []
    } catch (error) {
      console.error('获取活跃扫描任务失败:', error)
      return []
    }
  }

  async function startScan(libraryPathId) {
    try {
      scanErrors.value = []

      scanStatus.value = 'scanning'
      scanProgress.value = 0
      currentScanFile.value = ''
      currentScanMessageKey.value = 'initializingScanMessage'

      const response = await axios.post('/api/v1/library/scan', { library_path_id: libraryPathId })
      taskId.value = response.data.task_id
      dbTaskId.value = response.data.db_task_id

      if (response.data.db_task_id) {
        await _startScanQueue([response.data.db_task_id])
      } else {
        await checkActiveTasks()
      }

      return response.data
    } catch (error) {
      console.error('启动扫描失败:', error)
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
      scanErrors.value = []

      scanStatus.value = 'scanning'
      scanProgress.value = 0
      currentScanFile.value = ''
      currentScanMessageKey.value = 'startingScanAllMessage'

      const response = await axios.post('/api/v1/library/scan_all')
      const ids = (response.data.tasks || []).map(t => t.db_task_id).filter(Boolean)
      if (ids.length) {
        await _startScanQueue(ids)
      } else {
        await checkActiveTasks()
      }
      return response.data
    } catch (error) {
      console.error('启动全库扫描失败:', error)
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
    const response = await axios.post(`/api/v1/tasks/${taskId}/cancel`)
    await checkActiveTasks()
    return response.data
  }

  // 清理错误信息
  function clearErrors() {
    scanErrors.value = []
  }

  // 重置扫描状态
  function resetScanStatus() {
    _stopScanQueueTimer()
    _setScanIdle()
  }

  async function fetchFiles(page = 1) {
    try {
      libraryStatus.value = 'loading'
      const response = await axios.get('/api/v1/files', {
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
      console.error('获取文件列表失败:', error)
      libraryStatus.value = 'error'
    }
  }

  // 初始化轮询（任务与扫描状态需要在刷新页面后可恢复）
  checkActiveTasks()
  if (!slowPollTimer) {
    slowPollTimer = setInterval(checkActiveTasks, 30000)
  }

  return {
    // 扫描状态
    scanProgress,
    scanStatus,
    currentScanFile,
    currentScanMessageKey,
    taskId,
    dbTaskId,
    activeTasks,
    scanErrors,

    // 图书馆状态
    files,
    pagination,
    libraryStatus,

    // 计算属性
    hasActiveScanTasks,
    currentScanTask,

    // 动作
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

