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
    alert('无法加载备份列表。');
  } finally {
    isLoading.value = false;
  }
};

const createBackup = async () => {
  if (!confirm('现在创建新的数据库备份吗？')) return;
  try {
    const response = await axios.post('/api/v1/backup/now');
    alert(response.data.message);
    fetchBackups(); // Refresh the list
  } catch (error) {
    console.error('Failed to create backup:', error);
    alert('备份创建失败。');
  }
};

const restoreBackup = async (filename) => {
  if (!prompt(`此操作将覆盖当前数据库，危险操作。若要继续，请在下方输入"RESTORE"。`)?.toUpperCase() === 'RESTORE') {
    alert('已取消还原操作。');
    return;
  }
  
  try {
    const response = await axios.post('/api/v1/backup/restore', { filename });
    alert(response.data.message);
  } catch (error) {
    console.error('Failed to restore backup:', error);
    alert('还原操作失败。');
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
        <div v-if="isLoading" class="text-center">{{ $t('loading') }}</div>
        <ul v-else-if="backups.length > 0" class="divide-y border rounded-md">
            <li v-for="backup in backups" :key="backup" class="p-3 flex justify-between items-center">
                <span class="font-mono text-sm">{{ backup }}</span>
                <button @click="restoreBackup(backup)" class="btn btn-danger btn-sm">
                    {{ $t('restore') }}
                </button>
            </li>
        </ul>
        <p v-else class="text-gray-500">{{ $t('noDuplicatesFound') }}</p>
    </div>
  </div>
</template> 