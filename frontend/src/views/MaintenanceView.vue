<template>
  <div class="space-y-8">
    <BackupManager />

    <!-- Duplicate Finder -->
    <div class="p-6 bg-white rounded-lg shadow">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">Duplicate File Finder</h2>
      <button @click="findDuplicates" :disabled="isLoadingDuplicates" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">
        {{ isLoadingDuplicates ? 'Scanning...' : 'Find Duplicate Files' }}
      </button>
      <div v-if="duplicates.length > 0" class="mt-4 space-y-4">
        <div v-for="(group, index) in duplicates" :key="index" class="p-4 border rounded-md bg-gray-50">
          <h3 class="font-bold text-gray-800 mb-2">Group {{ index + 1 }} (Hash: <span class="font-mono text-sm">{{ group[0].file_hash.substring(0, 12) }}...</span>)</h3>
          <ul>
            <li v-for="file in group" :key="file.id" class="text-sm text-gray-600 truncate">{{ file.file_path }}</li>
          </ul>
        </div>
      </div>
      <p v-else-if="!isLoadingDuplicates && duplicates.length === 0" class="mt-4 text-gray-500">No duplicate files found.</p>
    </div>

    <!-- Missing Files Cleanup -->
    <div class="p-6 bg-white rounded-lg shadow">
        <h2 class="text-xl font-semibold text-gray-700 mb-4">Missing Files Cleanup</h2>
        <div class="flex space-x-2">
            <button @click="findMissingFiles" :disabled="isLoadingMissing" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">
                {{ isLoadingMissing ? 'Scanning...' : 'Find Missing Files' }}
            </button>
            <button v-if="missingFiles.length > 0" @click="cleanupSelectedMissingFiles" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300">
                Delete Selected Records
            </button>
        </div>
        <div v-if="missingFiles.length > 0" class="mt-4 border rounded-md">
            <ul class="divide-y">
                <li v-for="file in missingFiles" :key="file.id" class="p-2 flex items-center space-x-3">
                    <input type="checkbox" :value="file.id" @change="e => { if(e.target.checked) selectedMissingFiles.add(file.id); else selectedMissingFiles.delete(file.id); }" class="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500" />
                    <span class="text-sm text-gray-600 truncate">{{ file.file_path }}</span>
                </li>
            </ul>
        </div>
        <p v-else-if="!isLoadingMissing && missingFiles.length === 0" class="mt-4 text-gray-500">No missing file records found.</p>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue';
import axios from 'axios';
import BackupManager from '../components/BackupManager.vue';

// State for Duplicates
const duplicates = ref([]);
const isLoadingDuplicates = ref(false);

// State for Missing Files
const missingFiles = ref([]);
const isLoadingMissing = ref(false);
const selectedMissingFiles = ref(new Set());

const findDuplicates = async () => {
  isLoadingDuplicates.value = true;
  duplicates.value = [];
  try {
    const response = await axios.get('/api/v1/maintenance/duplicates');
    duplicates.value = response.data;
  } catch (error) {
    console.error("Failed to find duplicates:", error);
    alert('Error finding duplicate files.');
  } finally {
    isLoadingDuplicates.value = false;
  }
};

const findMissingFiles = async () => {
    isLoadingMissing.value = true;
    missingFiles.value = [];
    try {
        // We reuse the /api/v1/files endpoint with a filter
        const response = await axios.get('/api/v1/files', { params: { is_missing: true, per_page: 9999 } });
        missingFiles.value = response.data.files;
    } catch (error) {
        console.error("Failed to find missing files:", error);
        alert('Error finding missing files.');
    } finally {
        isLoadingMissing.value = false;
    }
}

const cleanupSelectedMissingFiles = async () => {
    if (selectedMissingFiles.value.size === 0) {
        alert("Please select files to delete.");
        return;
    }
    if (!confirm(`Are you sure you want to delete ${selectedMissingFiles.value.size} missing file records? This cannot be undone.`)) {
        return;
    }

    try {
        const ids = Array.from(selectedMissingFiles.value);
        const response = await axios.post('/api/v1/maintenance/cleanup-missing', { ids });
        alert(response.data.message);
        selectedMissingFiles.value.clear();
        findMissingFiles(); // Refresh the list
    } catch(error) {
        console.error("Failed to clean up missing files:", error);
        alert('Error cleaning up missing files.');
    }
}

</script> 