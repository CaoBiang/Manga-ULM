<script setup>
import { ref, onMounted, watch } from 'vue';
import axios from 'axios';
import MangaCard from '@/components/MangaCard.vue';
import VueMultiselect from 'vue-multiselect';

const library = ref([]);
const pagination = ref({});
const isLoading = ref(true);
const currentPage = ref(1);
const goToPageInput = ref(1);

const allTags = ref([]);
const selectedTags = ref([]);

const perPageOptions = ref([20, 50, 100, 200]);
const currentPageSize = ref(50); // Default value

const fetchLibrary = async () => {
  isLoading.value = true;
  try {
    const params = {
      page: currentPage.value,
      per_page: currentPageSize.value,
      sort_by: 'add_date',
      sort_order: 'desc',
      tags: selectedTags.value.map(tag => tag.id).join(','),
    };
    const response = await axios.get('/api/v1/files', { params });
    library.value = response.data.files;
    pagination.value = response.data.pagination;
  } catch (error) {
    console.error('Failed to fetch library:', error);
  } finally {
    isLoading.value = false;
  }
};

const fetchAllTags = async () => {
    try {
        const response = await axios.get('/api/v1/tags');
        allTags.value = response.data;
    } catch (error) {
        console.error('Failed to fetch tags:', error);
        alert('Could not load tags for filtering.');
    }
};

const handlePageChange = (page) => {
  if (page > 0 && page <= pagination.value.total_pages) {
    currentPage.value = page;
  }
};

const goToPage = () => {
    const page = Number(goToPageInput.value);
    if (page > 0 && page <= pagination.value.total_pages) {
        handlePageChange(page);
    } else {
        alert(`Please enter a page number between 1 and ${pagination.value.total_pages}.`);
    }
};

onMounted(() => {
    fetchLibrary();
    fetchAllTags();
});

watch(currentPage, fetchLibrary);
watch(currentPageSize, () => {
    // When page size changes, go back to page 1
    currentPage.value = 1;
    fetchLibrary();
});
watch(selectedTags, () => {
    currentPage.value = 1;
    fetchLibrary();
}, { deep: true });

</script>

<template>
  <div class="p-4 sm:p-6">
    <h1 class="text-3xl font-bold text-gray-800 mb-6">Library</h1>

    <!-- Filters Section -->
    <div class="mb-6 p-4 bg-gray-50 rounded-lg">
        <label class="block text-sm font-medium text-gray-700 mb-2">Filter by Tags:</label>
        <VueMultiselect
            v-model="selectedTags"
            :options="allTags"
            :multiple="true"
            :close-on-select="false"
            placeholder="Search or select tags"
            label="name"
            track-by="id"
        />
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <p>Loading your library...</p>
    </div>

    <div v-else-if="library.length > 0">
      <!-- Grid for manga cards -->
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4">
        <MangaCard v-for="manga in library" :key="manga.id" :manga="manga" />
      </div>

      <!-- Pagination Controls -->
      <div class="mt-8 flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
        <!-- Per Page Selector -->
        <div class="flex items-center space-x-2">
            <label for="per-page" class="text-sm font-medium">Items per page:</label>
            <select id="per-page" v-model="currentPageSize" class="p-1.5 border rounded-md text-sm">
                <option v-for="size in perPageOptions" :key="size" :value="size">{{ size }}</option>
            </select>
        </div>

        <!-- Pagination Buttons -->
        <div class="flex items-center space-x-1">
          <button
            @click="handlePageChange(1)"
            :disabled="currentPage === 1"
            class="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
          >&laquo; First</button>
          <button
            @click="handlePageChange(currentPage - 1)"
            :disabled="currentPage === 1"
            class="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
          >&lsaquo; Prev</button>

          <span class="px-3 py-1 text-sm">
            Page {{ pagination.page }} of {{ pagination.total_pages }}
          </span>

          <button
            @click="handlePageChange(currentPage + 1)"
            :disabled="currentPage === pagination.total_pages"
            class="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
          >Next &rsaquo;</button>
           <button
            @click="handlePageChange(pagination.total_pages)"
            :disabled="currentPage === pagination.total_pages"
            class="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
          >Last &raquo;</button>
        </div>

        <!-- Go to Page Input -->
        <div class="flex items-center space-x-2">
            <input type="number" v-model.number="goToPageInput" class="p-1.5 border rounded-md w-20 text-sm" />
            <button @click="goToPage" class="px-3 py-1 bg-gray-200 text-sm rounded-md hover:bg-gray-300">Go</button>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-10">
      <h2 class="text-xl font-semibold">No manga found.</h2>
      <p class="text-gray-600">Try adjusting your filters or scanning your library in the settings.</p>
    </div>
  </div>
</template>

<style src="vue-multiselect/dist/vue-multiselect.css"></style>