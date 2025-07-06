import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import axios from 'axios'
import io from 'socket.io-client'

export const useLibraryStore = defineStore('library', () => {
  // State for scanning
  const scanProgress = ref(0)
  const scanStatus = ref('idle') // idle, scanning, finished, error
  const currentScanFile = ref('')
  const taskId = ref(null)

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

  socket.on('connect', () => {
    console.log('Connected to WebSocket server')
  })

  socket.on('scan_progress', (data) => {
    scanProgress.value = data.progress
    currentScanFile.value = data.current_file
    scanStatus.value = 'scanning'
  })

  socket.on('scan_complete', (data) => {
    scanProgress.value = 100
    scanStatus.value = 'finished'
    console.log('Scan complete:', data.message)
    // Refresh the library view after scan is complete
    fetchFiles(1) 
  })
  
  socket.on('scan_error', (data) => {
    scanStatus.value = 'error'
    console.error('Scan error:', data.error)
  })

  async function startScan(path) {
    try {
      scanStatus.value = 'scanning'
      scanProgress.value = 0
      currentScanFile.value = 'Initializing scan...'
      const response = await axios.post('/api/v1/library/scan', { path })
      taskId.value = response.data.task_id
    } catch (error) {
      console.error('Failed to start scan:', error)
      scanStatus.value = 'error'
    }
  }

  async function fetchFiles(page = 1) {
    libraryStatus.value = 'loading'
    try {
      const response = await axios.get('/api/v1/files', {
        params: {
          page: page,
          per_page: pagination.value.per_page,
        }
      })
      files.value = response.data.files
      pagination.value = response.data.pagination
      libraryStatus.value = 'success'
    } catch (error) {
      console.error('Failed to fetch files:', error)
      libraryStatus.value = 'error'
    }
  }

  return { 
    // Scan state
    scanProgress, 
    scanStatus, 
    currentScanFile, 
    taskId, 
    startScan,
    // Library state
    files,
    pagination,
    libraryStatus,
    fetchFiles,
  }
}) 