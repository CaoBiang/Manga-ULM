<template>
  <div class="p-6 bg-white rounded-lg shadow">
    <h2 class="text-xl font-semibold text-gray-700 mb-4">Scanner Settings</h2>
    <div class="space-y-4">
      <div>
        <label for="max-workers" class="block text-sm font-medium text-gray-600 mb-1">
          Max Parallel Scanning Processes
        </label>
        <input 
          id="max-workers"
          type="number" 
          v-model.number="maxWorkers"
          @change="saveMaxWorkers"
          min="1"
          class="w-full p-2 border rounded-md focus:ring-indigo-500 focus:border-indigo-500"
        />
        <p class="text-xs text-gray-500 mt-1">
          The number of files to scan in parallel. Recommended value is the number of your CPU cores. Requires restart of the huey worker to take effect. Default is 12.
        </p>
      </div>
      <div v-if="statusMessage" :class="statusClass" class="p-2 rounded-md text-sm">
        {{ statusMessage }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import axios from 'axios';

const maxWorkers = ref(12);
const statusMessage = ref('');
const isError = ref(false);

const statusClass = computed(() => {
  return isError.value 
    ? 'bg-red-100 text-red-700' 
    : 'bg-green-100 text-green-700';
});

async function fetchMaxWorkers() {
  try {
    const response = await axios.get('/api/v1/settings/scan.max_workers');
    if (response.data && response.data['scan.max_workers'] !== null) {
      maxWorkers.value = parseInt(response.data['scan.max_workers'], 10);
    }
  } catch (error) {
    if (error.response && error.response.status !== 404) {
      console.error('Failed to fetch max workers setting:', error);
      statusMessage.value = 'Failed to load scanner settings.';
      isError.value = true;
    }
    // 404 is fine, it just means the setting is not set yet.
  }
}

async function saveMaxWorkers() {
  try {
    await axios.post('/api/v1/settings/scan.max_workers', { value: maxWorkers.value });
    statusMessage.value = 'Settings saved successfully!';
    isError.value = false;
  } catch (error) {
    console.error('Failed to save max workers setting:', error);
    statusMessage.value = 'Failed to save settings.';
    isError.value = true;
  }
  setTimeout(() => statusMessage.value = '', 3000);
}

onMounted(() => {
  fetchMaxWorkers();
});
</script> 