<template>
  <div class="space-y-8">
    <BackupManager />

    <!-- Duplicate Finder -->
    <div class="p-6 bg-white rounded-lg shadow">
      <h2 class="text-xl font-semibold text-gray-700 mb-4">{{ $t('duplicateFinder') }}</h2>
      <button @click="findDuplicates" :disabled="isLoadingDuplicates" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">
        {{ isLoadingDuplicates ? $t('scanning') : $t('findDuplicates') }}
      </button>
      <div v-if="duplicates.length > 0" class="mt-4 space-y-4">
        <div v-for="(group, index) in duplicates" :key="index" class="p-4 border rounded-md bg-gray-50">
          <h3 class="font-bold text-gray-800 mb-2">第 {{ index + 1 }} 组 (哈希: <span class="font-mono text-sm">{{ group[0].file_hash.substring(0, 12) }}...</span>)</h3>
          <ul>
            <li v-for="file in group" :key="file.id" class="text-sm text-gray-600 truncate">{{ file.file_path }}</li>
          </ul>
        </div>
      </div>
      <p v-else-if="!isLoadingDuplicates && duplicates.length === 0" class="mt-4 text-gray-500">{{ $t('noDuplicatesFound') }}</p>
    </div>

    <!-- Missing Files Cleanup -->
    <div class="p-6 bg-white rounded-lg shadow">
        <h2 class="text-xl font-semibold text-gray-700 mb-4">{{ $t('missingFileCleanup') }}</h2>
        <div class="flex space-x-2">
            <button @click="findMissingFiles" :disabled="isLoadingMissing" class="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300">
                {{ isLoadingMissing ? $t('scanning') : $t('findMissingFiles') }}
            </button>
            <button v-if="missingFiles.length > 0" @click="cleanupSelectedMissingFiles" class="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-red-300">
                {{ $t('deleteSelectedRecords') }}
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
        <p v-else-if="!isLoadingMissing && missingFiles.length === 0" class="mt-4 text-gray-500">{{ $t('noMissingFilesFound') }}</p>
    </div>

  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import BackupManager from '../components/BackupManager.vue';

// State for Duplicates
const duplicates = ref([]);
const isLoadingDuplicates = ref(false);

// State for Missing Files
const missingFiles = ref([]);
const isLoadingMissing = ref(false);
const selectedMissingFiles = ref(new Set());

const { t } = useI18n();

const findDuplicates = async () => {
  isLoadingDuplicates.value = true;
  duplicates.value = [];
  try {
    const response = await axios.get('/api/v1/maintenance/duplicates');
    duplicates.value = response.data;
  } catch (error) {
    console.error("查找重复文件出错：", error);
    alert('查找重复文件出错。');
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
        console.error("查找丢失文件出错：", error);
        alert('查找丢失文件出错。');
    } finally {
        isLoadingMissing.value = false;
    }
}

const cleanupSelectedMissingFiles = async () => {
    if (selectedMissingFiles.value.size === 0) {
        alert("请选择要删除的文件。");
        return;
    }
    if (!confirm(`确定要删除${selectedMissingFiles.value.size}条丢失文件记录吗？此操作不可撤销。`)) {
        return;
    }

    try {
        const ids = Array.from(selectedMissingFiles.value);
        const response = await axios.post('/api/v1/maintenance/cleanup-missing', { ids });
        alert(response.data.message);
        selectedMissingFiles.value.clear();
        findMissingFiles(); // Refresh the list
    } catch(error) {
        console.error("清理丢失文件出错：", error);
        alert('清理丢失文件出错。');
    }
}

</script> 