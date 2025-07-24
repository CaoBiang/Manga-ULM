<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const backups = ref([]);
const isLoading = ref(false);

const fetchBackups = async () => {
  isLoading.value = true;
  try {
    const response = await axios.get('/api/v1/backup/list');
    backups.value = response.data;
  } catch (error) {
    console.error('Failed to fetch backups:', error);
    alert(t('errorFetchingBackups'));
  } finally {
    isLoading.value = false;
  }
};

const createBackup = async () => {
  if (!confirm(t('confirmCreateBackup'))) return;
  try {
    await axios.post('/api/v1/backup/now');
    alert(t('backupCreatedSuccessfully'));
    fetchBackups(); // Refresh the list
  } catch (error) {
    console.error('Failed to create backup:', error);
    alert(t('errorCreatingBackup'));
  }
};

const restoreBackup = async (filename) => {
  if (!confirm(t('confirmRestore'))) {
    return;
  }
  
  try {
    const response = await axios.post('/api/v1/backup/restore', { filename });
    alert(t('restoreSuccessful'));
  } catch (error) {
    console.error('Failed to restore backup:', error);
    alert(t('errorRestoringBackup'));
  }
};

onMounted(fetchBackups);
</script>

<template>
  <div class="p-6 bg-white rounded-lg shadow">
    <h2 class="text-xl font-semibold text-gray-700 mb-4">{{ $t('backupRestore') }}</h2>
    <div class="mb-4">
        <button @click="createBackup" class="btn btn-primary">
            {{ $t('createNewBackup') }}
        </button>
    </div>

    <div>
        <h3 class="text-lg font-semibold text-gray-600 mb-2">{{ $t('availableBackups') }}</h3>
        <div v-if="isLoading"></div>
        <ul v-else-if="backups.length > 0" class="divide-y border rounded-md">
            <li v-for="backup in backups" :key="backup" class="p-3 flex justify-between items-center">
                <span class="font-mono text-sm">{{ backup }}</span>
                <button @click="restoreBackup(backup)" class="btn btn-danger btn-sm">
                    {{ $t('restore') }}
                </button>
            </li>
        </ul>
        <p v-else class="text-gray-500">{{ $t('noBackupsFound') }}</p>
    </div>
  </div>
</template> 