import { create } from 'zustand'
import { http } from '@/api/http'
import { useAppSettingsStore } from '@/store/appSettings'

export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export type TaskRecord = {
  id: number
  name: string
  task_type: string
  task_id: string | null
  status: TaskStatus
  progress: number | null
  current_file: string | null
  target_path: string | null
  target_library_path_id: number | null
  total_files: number
  processed_files: number
  error_message: string | null
  created_at: string | null
  started_at: string | null
  finished_at: string | null
  duration: number | null
  is_active: boolean
}

type ScanStatus = 'idle' | 'pending' | 'scanning' | 'finished' | 'error'

type ScanErrorItem = {
  message: string | null
  messageKey: string | null
  timestamp: string
}

type Cursor = { ts: number; id: number }

export type LibraryStoreState = {
  scanProgress: number
  scanStatus: ScanStatus
  currentScanFile: string
  currentScanMessageKey: string | null

  taskId: string | null
  dbTaskId: number | null
  activeTasks: TaskRecord[]
  recentTasks: TaskRecord[]
  historyTasks: TaskRecord[]
  unseenHistoryCount: number
  unseenFailedCount: number
  scanErrors: ScanErrorItem[]

  hasActiveScanTasks: boolean
  currentScanTask: TaskRecord | null

  checkActiveTasks: () => Promise<void>
  markHistoryTasksSeen: () => void
  getTaskDetails: (taskId: number) => Promise<TaskRecord | null>
  getActiveScanTasks: () => Promise<TaskRecord[]>
  startScan: (libraryPathId: number) => Promise<unknown>
  startScanAll: () => Promise<unknown>
  cancelTask: (taskId: number) => Promise<void>
  clearErrors: () => void
  resetScanStatus: () => void
}

const TASK_HISTORY_SEEN_CURSOR_KEY = 'manga-ulm.tasks.history.seen_cursor.v1'

const loadHistorySeenCursor = (): { cursor: Cursor; initialized: boolean } => {
  if (typeof localStorage === 'undefined') {
    return { cursor: { ts: 0, id: 0 }, initialized: false }
  }
  try {
    const raw = localStorage.getItem(TASK_HISTORY_SEEN_CURSOR_KEY)
    if (!raw) {
      return { cursor: { ts: 0, id: 0 }, initialized: false }
    }
    const parsed = JSON.parse(raw)
    const ts = Number(parsed?.ts)
    const id = Number(parsed?.id)
    if (!Number.isFinite(ts) || !Number.isFinite(id)) {
      return { cursor: { ts: 0, id: 0 }, initialized: false }
    }
    return { cursor: { ts, id }, initialized: true }
  } catch (_error) {
    return { cursor: { ts: 0, id: 0 }, initialized: false }
  }
}

const saveHistorySeenCursor = (cursor: Cursor) => {
  if (typeof localStorage === 'undefined') {
    return
  }
  try {
    localStorage.setItem(TASK_HISTORY_SEEN_CURSOR_KEY, JSON.stringify(cursor))
  } catch (_error) {
    // 忽略写入失败
  }
}

const taskToCursor = (task: TaskRecord): Cursor => {
  const rawTime = task?.finished_at || task?.created_at || ''
  const ts = rawTime ? Date.parse(String(rawTime)) : 0
  const id = Number(task?.id) || 0
  return { ts: Number.isFinite(ts) ? ts : 0, id }
}

const isAfterCursor = (cursor: Cursor, baseline: Cursor) => {
  if (cursor.ts > baseline.ts) return true
  if (cursor.ts < baseline.ts) return false
  return cursor.id > baseline.id
}

const maxCursor = (a: Cursor, b: Cursor): Cursor => {
  if (a.ts > b.ts) return a
  if (a.ts < b.ts) return b
  return a.id >= b.id ? a : b
}

export const useLibraryStore = create<LibraryStoreState>((set, get) => {
  const pushScanError = ({ message = null, messageKey = null }: { message?: string | null; messageKey?: string | null }) => {
    set((state) => ({
      scanErrors: [
        ...state.scanErrors,
        {
          message,
          messageKey,
          timestamp: new Date().toISOString()
        }
      ]
    }))
  }

  let slowPollTimer: ReturnType<typeof setInterval> | null = null
  let fastPollTimer: ReturnType<typeof setInterval> | null = null
  let scanQueueTimer: ReturnType<typeof setInterval> | null = null
  let scanTicking = false
  let scanQueue: number[] = []
  let scanQueueHasFailure = false

  const loadedHistorySeenCursor = loadHistorySeenCursor()
  let historySeenCursor: Cursor = loadedHistorySeenCursor.cursor
  let historySeenCursorInitialized = loadedHistorySeenCursor.initialized

  const setScanIdle = () => {
    set({
      scanStatus: 'idle',
      scanProgress: 0,
      currentScanFile: '',
      currentScanMessageKey: null,
      taskId: null,
      dbTaskId: null
    })
  }

  const stopScanQueueTimer = () => {
    if (scanQueueTimer) {
      clearInterval(scanQueueTimer)
      scanQueueTimer = null
    }
    scanQueue = []
    scanQueueHasFailure = false
    scanTicking = false
  }

  const finalizeScanQueue = async () => {
    set({
      scanProgress: 100,
      currentScanFile: '',
      currentScanMessageKey: scanQueueHasFailure ? null : 'scanCompleteMessage',
      scanStatus: scanQueueHasFailure ? 'error' : 'finished'
    })

    await get().checkActiveTasks()

    setTimeout(() => {
      setScanIdle()
    }, 3000)
  }

  const tickScanQueue = async () => {
    if (scanTicking) return
    scanTicking = true

    try {
      if (scanQueue.length === 0) {
        await finalizeScanQueue()
        stopScanQueueTimer()
        return
      }

      const currentId = scanQueue[0]
      set({ dbTaskId: currentId })

      const task = await get().getTaskDetails(currentId)
      if (!task) {
        return
      }

      set({
        taskId: task.task_id || null,
        scanProgress: Number(task.progress ?? 0),
        currentScanFile: task.current_file || ''
      })

      if (task.status === 'pending') {
        set({
          scanStatus: 'pending',
          currentScanMessageKey: task.current_file ? null : 'preparingScanMessage'
        })
      } else if (task.status === 'running') {
        set({ scanStatus: 'scanning', currentScanMessageKey: null })
      }

      if (task.status === 'cancelled') {
        stopScanQueueTimer()
        setScanIdle()
        await get().checkActiveTasks()
        return
      }

      if (!task.is_active) {
        if (task.status === 'failed') {
          scanQueueHasFailure = true
          pushScanError({ message: task.error_message || '扫描任务失败' })
        }
        scanQueue.shift()
        if (scanQueue.length === 0) {
          await finalizeScanQueue()
          stopScanQueueTimer()
        }
      }
    } catch (error) {
      console.error('轮询扫描任务失败:', error)
    } finally {
      scanTicking = false
    }
  }

  const startScanQueue = async (dbTaskIds: number[]) => {
    stopScanQueueTimer()
    scanQueue = (dbTaskIds || []).filter(Boolean)
    scanQueueHasFailure = false

    if (scanQueue.length === 0) {
      setScanIdle()
      return
    }

    set({
      dbTaskId: scanQueue[0],
      scanStatus: 'scanning',
      scanProgress: 0,
      currentScanFile: '',
      currentScanMessageKey: 'initializingScanMessage'
    })

    await get().checkActiveTasks()
    await tickScanQueue()

    scanQueueTimer = setInterval(tickScanQueue, 1000)
  }

  const checkActiveTasks = async () => {
    try {
      const limitRaw = useAppSettingsStore.getState().tasksHistoryLimit ?? 80
      const limit = Math.max(10, Math.min(500, Number(limitRaw) || 80))
      const response = await http.get('/api/v1/tasks', { params: { limit } })
      const recentTasks = (response?.data?.tasks || []) as TaskRecord[]
      const activeTasks = recentTasks.filter((task) => task?.is_active)
      const historyTasks = recentTasks.filter((task) => !task?.is_active)

      const historyForCursor = historyTasks.filter((task) => task && !task.is_active && (task.finished_at || task.created_at))

      if (!historySeenCursorInitialized) {
        if (historyForCursor.length > 0) {
          historySeenCursor = historyForCursor.map(taskToCursor).reduce((acc, cur) => maxCursor(acc, cur), { ts: 0, id: 0 })
          saveHistorySeenCursor(historySeenCursor)
        }
        historySeenCursorInitialized = true
        set({ unseenHistoryCount: 0, unseenFailedCount: 0 })
      } else {
        const unseen = historyForCursor.filter((task) => isAfterCursor(taskToCursor(task), historySeenCursor))
        set({
          unseenHistoryCount: unseen.length,
          unseenFailedCount: unseen.filter((task) => task?.status === 'failed').length
        })
      }

      const currentScanTask =
        activeTasks.find((task) => task.task_type === 'scan' && task.status === 'running') ||
        activeTasks.find((task) => task.task_type === 'scan' && task.is_active) ||
        null

      const hasActiveScanTasks = activeTasks.some((task) => task.task_type === 'scan' && task.is_active)

      set({
        recentTasks,
        activeTasks,
        historyTasks,
        currentScanTask,
        hasActiveScanTasks
      })
    } catch (error) {
      console.error('获取活跃任务失败:', error)
      return
    }

    const hasActive = get().activeTasks.some((task) => task.is_active)
    if (hasActive && !fastPollTimer) {
      fastPollTimer = setInterval(() => {
        get().checkActiveTasks().catch(() => {})
      }, 2000)
    }
    if (!hasActive && fastPollTimer) {
      clearInterval(fastPollTimer)
      fastPollTimer = null
    }

    if (!scanQueueTimer) {
      const scanTask = get().currentScanTask
      if (scanTask) {
        set({
          scanStatus: scanTask.status === 'running' ? 'scanning' : 'pending',
          scanProgress: Number(scanTask.progress ?? 0),
          currentScanFile: scanTask.current_file || '',
          currentScanMessageKey: scanTask.current_file ? null : 'preparingScanMessage',
          dbTaskId: scanTask.id,
          taskId: scanTask.task_id
        })
      } else if (get().scanStatus !== 'idle') {
        setScanIdle()
      }
    }
  }

  const markHistoryTasksSeen = () => {
    const history = get().recentTasks.filter((task) => !task?.is_active)
    if (history.length === 0) {
      set({ unseenHistoryCount: 0, unseenFailedCount: 0 })
      return
    }

    const latest = history.map(taskToCursor).reduce((acc, cur) => maxCursor(acc, cur), historySeenCursor)
    historySeenCursor = latest
    historySeenCursorInitialized = true
    saveHistorySeenCursor(latest)
    set({ unseenHistoryCount: 0, unseenFailedCount: 0 })
  }

  const getTaskDetails = async (taskId: number) => {
    try {
      const response = await http.get(`/api/v1/tasks/${taskId}`)
      return (response?.data ?? null) as TaskRecord | null
    } catch (error) {
      console.error('获取任务详情失败:', error)
      return null
    }
  }

  const getActiveScanTasks = async () => {
    try {
      const response = await http.get('/api/v1/tasks', {
        params: { task_type: 'scan', active_only: true, limit: 500 }
      })
      return (response?.data?.tasks || []) as TaskRecord[]
    } catch (error) {
      console.error('获取活跃扫描任务失败:', error)
      return []
    }
  }

  const startScan = async (libraryPathId: number) => {
    try {
      set({
        scanErrors: [],
        scanStatus: 'scanning',
        scanProgress: 0,
        currentScanFile: '',
        currentScanMessageKey: 'initializingScanMessage'
      })

      const response = await http.post('/api/v1/scan-jobs', { library_path_id: libraryPathId })
      const createdTasks = (response?.data?.tasks || []) as TaskRecord[]
      const firstTask = createdTasks[0]
      const taskId = (firstTask as any)?.task_id || null
      const dbTaskId = (firstTask as any)?.id || null

      set({ taskId, dbTaskId })

      if (dbTaskId) {
        await startScanQueue([dbTaskId])
      } else {
        await get().checkActiveTasks()
      }

      return response.data
    } catch (error) {
      console.error('启动扫描失败:', error)
      set({ scanStatus: 'error' })
      pushScanError({
        message: (error as any)?.response?.data?.error || null,
        messageKey: (error as any)?.response?.data?.error ? null : 'failedToStartScan'
      })
      throw error
    }
  }

  const startScanAll = async () => {
    try {
      set({
        scanErrors: [],
        scanStatus: 'scanning',
        scanProgress: 0,
        currentScanFile: '',
        currentScanMessageKey: 'startingScanAllMessage'
      })

      const response = await http.post('/api/v1/scan-jobs', { all: true })
      const ids = ((response?.data?.tasks || []) as any[]).map((task) => task?.id).filter(Boolean) as number[]
      if (ids.length) {
        await startScanQueue(ids)
      } else {
        await get().checkActiveTasks()
      }
      return response.data
    } catch (error) {
      console.error('启动全库扫描失败:', error)
      set({ scanStatus: 'error' })
      pushScanError({
        message: (error as any)?.response?.data?.error || null,
        messageKey: (error as any)?.response?.data?.error ? null : 'failedToStartScanAll'
      })
      throw error
    }
  }

  const cancelTask = async (taskId: number) => {
    await http.patch(`/api/v1/tasks/${taskId}`, { status: 'cancelled' })
    await get().checkActiveTasks()
  }

  const clearErrors = () => {
    set({ scanErrors: [] })
  }

  const resetScanStatus = () => {
    stopScanQueueTimer()
    setScanIdle()
  }

  if (typeof window !== 'undefined') {
    checkActiveTasks().catch(() => {})
    if (!slowPollTimer) {
      slowPollTimer = setInterval(() => {
        get().checkActiveTasks().catch(() => {})
      }, 30000)
    }
  }

  return {
    scanProgress: 0,
    scanStatus: 'idle',
    currentScanFile: '',
    currentScanMessageKey: null,
    taskId: null,
    dbTaskId: null,
    activeTasks: [],
    recentTasks: [],
    historyTasks: [],
    unseenHistoryCount: 0,
    unseenFailedCount: 0,
    scanErrors: [],
    hasActiveScanTasks: false,
    currentScanTask: null,

    checkActiveTasks,
    markHistoryTasksSeen,
    getTaskDetails,
    getActiveScanTasks,
    startScan,
    startScanAll,
    cancelTask,
    clearErrors,
    resetScanStatus
  }
})

