<script setup>
import { ref, onMounted, watch, onActivated, onDeactivated, nextTick } from 'vue';
import axios from 'axios';
import MangaCard from '@/components/MangaCard.vue';
import TagSelector from '@/components/TagSelector.vue';

const library = ref([]);
const pagination = ref({});
const isLoading = ref(true);
const currentPage = ref(1);
const goToPageInput = ref(1);

const keyword = ref('');
const selectedTags = ref([]);

const perPageOptions = ref([20, 50, 100, 200]);
const currentPageSize = ref(200); // Default value

const scrollPosition = ref(0);
let isLoaded = false;

const fetchLibrary = async () => {
  isLoading.value = true;
  try {
    const params = {
      page: currentPage.value,
      per_page: currentPageSize.value,
      sort_by: 'add_date',
      sort_order: 'desc',
      tags: selectedTags.value.map(tag => tag.id).join(','),
      keyword: keyword.value,
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
        alert(`请输入1到${pagination.value.total_pages}之间的页码。`);
    }
};

onDeactivated(() => {
  scrollPosition.value = window.scrollY;
});

onActivated(() => {
  if (!isLoaded) {
    fetchLibrary();
    isLoaded = true;
  }
  nextTick(() => {
    window.scrollTo(0, scrollPosition.value);
  });
});

watch(currentPage, fetchLibrary);
watch(currentPageSize, () => {
    // When page size changes, go back to page 1
    currentPage.value = 1;
    fetchLibrary();
});
watch(keyword, () => {
    currentPage.value = 1;
    fetchLibrary();
});
watch(selectedTags, () => {
    currentPage.value = 1;
    fetchLibrary();
}, { deep: true });

const toggleTag = (tag) => {
    const index = selectedTags.value.findIndex(t => t.id === tag.id);
    if (index > -1) {
        selectedTags.value.splice(index, 1);
    } else {
        selectedTags.value.push(tag);
    }
};
</script>

<template>
  <div class="p-4 sm:p-6">
    <h1 class="text-3xl font-bold text-gray-800 mb-6">{{ $t('library') }}</h1>

    <!-- Filters Section -->
    <div class="mb-6 p-4 bg-gray-50 rounded-lg">
      <div class="flex items-center space-x-4">
        <TagSelector v-model="selectedTags" />
        <!-- Keyword Search -->
        <div class="flex-grow">
          <input
            v-model="keyword"
            type="text"
            :placeholder="$t('keywordPlaceholder')"
            class="w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>
      <!-- Display selected tags -->
      <div v-if="selectedTags.length > 0" class="mt-4">
        <span v-for="tag in selectedTags" :key="tag.id" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mr-2 mb-2">
          {{ tag.name }}
          <button @click="toggleTag(tag)" class="flex-shrink-0 ml-1.5 h-4 w-4 rounded-full inline-flex items-center justify-center text-blue-400 hover:bg-blue-200 hover:text-blue-500 focus:outline-none focus:bg-blue-500 focus:text-white">
            <span class="sr-only">{{ $t('removeTag') }}</span>
            <svg class="h-2 w-2" stroke="currentColor" fill="none" viewBox="0 0 8 8">
              <path stroke-linecap="round" stroke-width="1.5" d="M1 1l6 6m0-6L1 7" />
            </svg>
          </button>
        </span>
      </div>
    </div>

    <div v-if="isLoading" class="text-center py-10">
      <p>{{ $t('loadingLibrary') }}</p>
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
            <label for="per-page" class="text-sm font-medium">{{ $t('itemsPerPage') }}</label>
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
          >{{ $t('first') }}</button>
          <button
            @click="handlePageChange(currentPage - 1)"
            :disabled="currentPage === 1"
            class="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
          >{{ $t('prev') }}</button>

          <span class="px-3 py-1 text-sm">
            {{ $t('pageIndicator', { currentPage: pagination.page, totalPages: pagination.total_pages }) }}
          </span>

          <button
            @click="handlePageChange(currentPage + 1)"
            :disabled="currentPage === pagination.total_pages"
            class="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
          >{{ $t('next') }}</button>
           <button
            @click="handlePageChange(pagination.total_pages)"
            :disabled="currentPage === pagination.total_pages"
            class="px-3 py-1 border rounded-md text-sm disabled:opacity-50"
          >{{ $t('last') }}</button>
        </div>

        <!-- Go to Page Input -->
        <div class="flex items-center space-x-2">
            <input type="number" v-model.number="goToPageInput" class="p-1.5 border rounded-md w-20 text-sm" />
            <button @click="goToPage" class="px-3 py-1 bg-gray-200 text-sm rounded-md hover:bg-gray-300">{{ $t('go') }}</button>
        </div>
      </div>
    </div>

    <div v-else class="text-center py-10">
      <h2 class="text-xl font-semibold">{{ $t('noMangaFound') }}</h2>
      <p class="text-gray-600">{{ $t('noMangaFoundTip') }}</p>
    </div>
  </div>
</template>

<style>
/* You may need to remove this if vue-multiselect is no longer used elsewhere */
/* @import 'vue-multiselect/dist/vue-multiselect.css'; */
</style>