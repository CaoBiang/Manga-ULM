<template>
  <div class="space-y-6">
    <!-- Path Management -->
    <div>
      <h3 class="text-lg font-semibold text-gray-700 mb-2">Library Folders</h3>
      <div class="space-y-2">
        <div v-for="p in libraryPaths" :key="p.id" class="flex items-center space-x-2 p-2 bg-gray-50 rounded-md">
          <span class="flex-grow truncate" :title="p.path">{{ p.path }}</span>
          <button @click="startScan(p.path)" :disabled="scanningPaths.includes(p.path)" class="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-blue-300">
            {{ scanningPaths.includes(p.path) ? 'Scanning...' : 'Scan' }}
          </button>
          <button @click="deletePath(p.id)" class="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600">
            Delete
          </button>
        </div>
        <div v-if="libraryPaths.length === 0" class="text-sm text-gray-500 text-center py-2">
          No library folders added yet.
        </div>
      </div>
      <!-- Add New Path -->
      <div class="mt-4">
        <label for="new-path" class="block text-sm font-medium text-gray-600 mb-1">Add New Folder</label>
        <div class="flex space-x-2">
          <input
            id="new-path"
            type="text"
            v-model.trim="newPath"
            placeholder="/path/to/your/manga"
            class="flex-grow p-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
          />
          <button @click="addPath" class="px-4 py-2 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700">Add</button>
        </div>
      </div>
       <!-- Scan All -->
      <div class="mt-4 border-t pt-4">
         <button
          @click="scanAll"
          :disabled="isScanning"
          class="w-full px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed"
        >
          {{ isScanning ? 'Scanning All...' : 'Scan All Library Folders' }}
        </button>
      </div>
    </div>

    <!-- Worker Settings -->
    <div class="border-t pt-6">
       <h3 class="text-lg font-semibold text-gray-700 mb-2">Advanced Settings</h3>
      <div>
        <label for="max-workers" class="block text-sm font-medium text-gray-600 mb-1">
          Max Parallel Scanning Processes
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
          The number of files to scan in parallel. Recommended value is the number of your CPU cores. Requires restart of the huey worker to take effect. Default is 12.
        </p>
      </div>
    </div>

    <div v-if="statusMessage" :class="statusClass" class="p-2 rounded-md text-sm mt-4">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

const libraryPaths = ref([]);
const newPath = ref('');
const maxWorkers = ref(12);
const statusMessage = ref('');
const isError = ref(false);
const isScanning = ref(false); // For "Scan All"
const scanningPaths = ref([]); // For individual scans

const statusClass = computed(() => {
  return isError.value 
    ? 'bg-red-100 text-red-700' 
    : 'bg-green-100 text-green-700';
});

async function fetchLibraryPaths() {
    try {
        const response = await axios.get('/api/v1/library_paths');
        libraryPaths.value = response.data;
    } catch (error) {
        console.error('Failed to fetch library paths:', error);
        statusMessage.value = 'Failed to load library paths.';
        isError.value = true;
    }
}

async function addPath() {
    if (!newPath.value) {
        alert('Please enter a path.');
        return;
    }
    try {
        await axios.post('/api/v1/library_paths', { path: newPath.value });
        newPath.value = '';
        await fetchLibraryPaths();
    } catch (error) {
        console.error('Failed to add path:', error);
        statusMessage.value = error.response?.data?.error || 'Failed to add path.';
        isError.value = true;
    }
}

async function deletePath(id) {
    if (!confirm('Are you sure you want to remove this folder from the library? (This will not delete the files on disk)')) {
        return;
    }
    try {
        await axios.delete(`/api/v1/library_paths/${id}`);
        await fetchLibraryPaths();
    } catch (error) {
        console.error('Failed to delete path:', error);
        statusMessage.value = error.response?.data?.error || 'Failed to delete path.';
        isError.value = true;
    }
}

async function fetchSettings() {
  try {
    const workersRes = await axios.get('/api/v1/settings/scan.max_workers').catch(e => e.response);
    if (workersRes && workersRes.status === 200 && workersRes.data['scan.max_workers'] !== null) {
      maxWorkers.value = parseInt(workersRes.data['scan.max_workers'], 10);
    }
  } catch (error) {
    console.error('Failed to fetch settings:', error);
    statusMessage.value = 'Failed to load advanced settings.';
    isError.value = true;
  }
}

async function saveSetting(key, value) {
  try {
    await axios.post(`/api/v1/settings/${key}`, { value });
    statusMessage.value = 'Settings saved successfully!';
    isError.value = false;
  } catch (error) {
    console.error(`Failed to save setting ${key}:`, error);
    statusMessage.value = 'Failed to save settings.';
    isError.value = true;
  }
  setTimeout(() => statusMessage.value = '', 3000);
}

async function startScan(path) {
  scanningPaths.value.push(path);
  statusMessage.value = `Scan started for ${path}...`;
  isError.value = false;
  try {
    await axios.post('/api/v1/library/scan', { path: path });
  } catch (error) {
    console.error(`Failed to start scan for ${path}:`, error);
    statusMessage.value = error.response?.data?.error || 'Failed to start scan.';
    isError.value = true;
  } finally {
    // Remove path from scanning list after a delay to allow user to see status
    setTimeout(() => {
        scanningPaths.value = scanningPaths.value.filter(p => p !== path);
    }, 5000);
  }
}

async function scanAll() {
  isScanning.value = true;
  statusMessage.value = 'Starting scan for all library folders...';
  isError.value = false;
  try {
    await axios.post('/api/v1/library/scan_all');
  } catch (error) {
    console.error('Failed to start scan all:', error);
    statusMessage.value = error.response?.data?.error || 'Failed to start scan for all folders.';
    isError.value = true;
  } finally {
     setTimeout(() => { isScanning.value = false; }, 5000);
  }
}

onMounted(() => {
  fetchLibraryPaths();
  fetchSettings();
  // TODO: Add websocket listeners to update scanning status in real-time
});
</script> 