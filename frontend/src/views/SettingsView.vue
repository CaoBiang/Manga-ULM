<template>
  <div class="space-y-8 p-4 md:p-8">
    <h1 class="text-3xl font-bold text-gray-800">Settings</h1>
    
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      
      <div class="lg:col-span-1 space-y-8">
        <!-- Section: Library -->
        <div class="p-6 bg-white rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4 border-b pb-2">Library</h2>
          <ScannerSettings />
        </div>

        <!-- Section: Filename Templates -->
        <!-- <div class="p-6 bg-white rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4 border-b pb-2">Filename Templates</h2>
          <FilenameTemplateManager />
        </div> -->
      </div>

      <div class="lg:col-span-2 space-y-8">
        <!-- Section: Tag Management -->
        <div class="p-6 bg-white rounded-lg shadow-md">
          <h2 class="text-xl font-semibold mb-4 border-b pb-2">Tag & Type Management</h2>
          <div v-if="isLoading" class="text-center">Loading tag data...</div>
          <div v-else class="space-y-6">
            <div>
              <h3 class="text-lg font-semibold mb-3">Tag Types</h3>
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

import ScannerSettings from '@/components/ScannerSettings.vue';
// import FilenameTemplateManager from '@/components/FilenameTemplateManager.vue';
import TagTypeManager from '@/components/TagTypeManager.vue';
import TagManager from '@/components/TagManager.vue';

const tagTypes = ref([]);
const isLoading = ref(true);

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