<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';
import TagTypeManager from './TagTypeManager.vue';
import TagListManager from './TagListManager.vue';

const tagTypes = ref([]);
const tags = ref([]);
const isLoading = ref(true);

const fetchTagData = async () => {
  isLoading.value = true;
  try {
    const [typesRes, tagsRes] = await Promise.all([
      axios.get('/api/v1/tag_types'),
      axios.get('/api/v1/tags')
    ]);
    tagTypes.value = typesRes.data;
    tags.value = tagsRes.data;
  } catch (error) {
    console.error('Failed to fetch tag data:', error);
    // Handle error display in UI
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchTagData);

</script>

<template>
  <div>
    <h2 class="text-2xl font-bold text-gray-800 mb-6">Tag Management</h2>
    <div v-if="isLoading" class="text-center">Loading tags...</div>
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-8">
      
      <!-- Column 1: Tag Types -->
      <div class="md:col-span-1">
        <h3 class="text-lg font-semibold border-b pb-2 mb-4">Tag Types</h3>
        <TagTypeManager :types="tagTypes" @dataChanged="fetchTagData" />
      </div>

      <!-- Column 2: Tags -->
      <div class="md:col-span-2">
        <h3 class="text-lg font-semibold border-b pb-2 mb-4">Tags</h3>
        <TagListManager :tags="tags" :types="tagTypes" @dataChanged="fetchTagData" />
      </div>

    </div>
  </div>
</template> 