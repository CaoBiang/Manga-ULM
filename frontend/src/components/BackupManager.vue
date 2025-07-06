<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const backups = ref([]);
const isLoading = ref(false);

const fetchBackups = async () => {
  isLoading.value = true;
  try {
    const response = await axios.get('/api/v1/backup/list');
    backups.value = response.data;
  } catch (error) {
    console.error('Failed to fetch backups:', error);
    alert('Could not load backup list.');
  } finally {
    isLoading.value = false;
  }
};

const createBackup = async () => {
  if (!confirm('Create a new database backup now?')) return;
  try {
    const response = await axios.post('/api/v1/backup/now');
    alert(response.data.message);
    fetchBackups(); // Refresh the list
  } catch (error) {
    console.error('Failed to create backup:', error);
    alert('Backup creation failed.');
  }
};

const restoreBackup = async (filename) => {
  if (!prompt(`This is a dangerous operation that will overwrite your current database. To proceed, please type "RESTORE" in the box below.`)?.toUpperCase() === 'RESTORE') {
    alert('Restore operation cancelled.');
    return;
  }
  
  try {
    const response = await axios.post('/api/v1/backup/restore', { filename });
    alert(response.data.message);
  } catch (error) {
    console.error('Failed to restore backup:', error);
    alert('Restore operation failed.');
  }
};

onMounted(fetchBackups);
</script>

<template>
  <div class="p-6 bg-white rounded-lg shadow">
    <h2 class="text-xl font-semibold text-gray-700 mb-4">Backup & Restore</h2>
    <div class="mb-4">
        <button @click="createBackup" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">
            Create New Backup
        </button>
    </div>

    <div>
        <h3 class="text-lg font-semibold text-gray-600 mb-2">Available Backups</h3>
        <div v-if="isLoading" class="text-center">Loading...</div>
        <ul v-else-if="backups.length > 0" class="divide-y border rounded-md">
            <li v-for="backup in backups" :key="backup" class="p-3 flex justify-between items-center">
                <span class="font-mono text-sm">{{ backup }}</span>
                <button @click="restoreBackup(backup)" class="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700">
                    Restore
                </button>
            </li>
        </ul>
        <p v-else class="text-gray-500">No backups found.</p>
    </div>
  </div>
</template> 