<template>
  <div class="space-y-8 p-4 md:p-8">
    <h1 class="text-3xl font-bold text-gray-800">{{ $t('settings') }}</h1>
    
    <div class="space-y-8">
      
      <div class="space-y-8">
        <!-- Section: Language -->
        <div class="p-6 bg-white rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4 border-b pb-2">{{ $t('language') }}</h2>
          <select v-model="selectedLanguage" @change="changeLanguage" class="p-2 border rounded">
            <option value="en">{{ $t('english') }}</option>
            <option value="zh">{{ $t('chinese') }}</option>
          </select>
        </div>

        <!-- Section: Library -->
        <div class="p-6 bg-white rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4 border-b pb-2">{{ $t('library') }}</h2>
          <ScannerSettings />
        </div>

        <!-- Section: Task Manager -->
        <div class="p-6 bg-white rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4 border-b pb-2">{{ $t('taskManager') }}</h2>
          <TaskManager />
        </div>

        <!-- Section: Filename Templates -->
        <!-- <div class="p-6 bg-white rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4 border-b pb-2">Filename Templates</h2>
          <FilenameTemplateManager />
        </div> -->
      </div>

      <div class="space-y-8">
        <!-- Section: Tag Management -->
        <div class="p-6 bg-white rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4 border-b pb-2">{{ $t('tagTypeManagement') }}</h2>
          <div class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold mb-3">{{ $t('tagTypes') }}</h3>
              <TagTypeManager :types="tagTypes" @dataChanged="fetchTagData" />
            </div>
            <hr/>
            <div>
               <TagManager :types="tagTypes" />
            </div>
          </div>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

import ScannerSettings from '@/components/ScannerSettings.vue';
// import FilenameTemplateManager from '@/components/FilenameTemplateManager.vue';
import TagTypeManager from '@/components/TagTypeManager.vue';
import TagManager from '@/components/TagManager.vue';
import TaskManager from '@/components/TaskManager.vue';

const tagTypes = ref([]);
const isLoading = ref(true);
const { locale } = useI18n();
const selectedLanguage = ref(locale.value);

const changeLanguage = () => {
  locale.value = selectedLanguage.value;
  localStorage.setItem('lang', selectedLanguage.value);
};

const fetchTagData = async () => {
  isLoading.value = true;
  try {
    const response = await axios.get('/api/v1/tag_types');
    tagTypes.value = response.data;
  } catch (error) {
    console.error('Failed to fetch tag types:', error);
    alert('Could not load tag types. Please try again.');
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchTagData);
</script> 