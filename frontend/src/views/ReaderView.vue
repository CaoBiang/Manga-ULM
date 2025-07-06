<template>
  <div class="fixed inset-0 bg-gray-900 text-white flex flex-col items-center justify-center">
    <div class="absolute top-0 left-0 p-4 z-10 flex space-x-4 items-center">
      <button @click="router.back()" class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600">
        &larr; Back to Library
      </button>
      <span v-if="isCurrentPageSpread" class="px-2 py-1 text-xs font-bold bg-purple-600 rounded">
        SPREAD
      </span>
    </div>
    
    <div v-if="isLoading" class="text-center">
      <p>Loading reader...</p>
    </div>
    
    <div v-else-if="error" class="text-center text-red-400">
      <p>{{ error }}</p>
    </div>

    <div v-else class="relative w-full h-full flex items-center justify-center">
      <!-- Main Image Display -->
      <div class="relative max-w-full max-h-full">
        <img :src="imageUrl" :alt="`Page ${currentPage + 1}`" class="h-auto max-h-screen w-auto object-contain" />
      </div>

      <!-- Navigation Arrows -->
      <div class="absolute left-0 top-0 h-full w-1/3 cursor-pointer" @click="prevPage"></div>
      <div class="absolute right-0 top-0 h-full w-1/3 cursor-pointer" @click="nextPage"></div>
    </div>

    <!-- Page Counter -->
    <div class="absolute bottom-0 p-4 text-lg font-semibold bg-black bg-opacity-50 rounded-t-lg">
      <span>{{ currentPage + 1 }} / {{ totalPages }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';

const route = useRoute();
const router = useRouter();

const fileId = route.params.id;
const currentPage = ref(0);
const totalPages = ref(0);
const spreadPages = ref([]); // To store the pages that are spreads
const isLoading = ref(true);
const error = ref(null);

const imageUrl = computed(() => {
  if (totalPages.value === 0) return '';
  return `/api/v1/files/${fileId}/page/${currentPage.value}`;
});

const isCurrentPageSpread = computed(() => {
  return spreadPages.value.includes(currentPage.value);
});

// --- Pre-fetching Logic ---
const preloadedImages = ref({});
const preloadAhead = 2; // How many images to preload ahead

const preloadImages = () => {
  for (let i = 1; i <= preloadAhead; i++) {
    const pageToLoad = currentPage.value + i;
    if (pageToLoad < totalPages.value && !preloadedImages.value[pageToLoad]) {
      const img = new Image();
      img.src = `/api/v1/files/${fileId}/page/${pageToLoad}`;
      preloadedImages.value[pageToLoad] = img;
    }
  }
};

watch(currentPage, () => {
  preloadImages();
  debouncedUpdateProgress();
});
// --- End Pre-fetching Logic ---

// --- Progress Saving Logic ---
const debounce = (func, delay) => {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
};

const updateProgress = async () => {
  try {
    await axios.post(`/api/v1/files/${fileId}/progress`, { page: currentPage.value });
    console.log(`Progress saved for page ${currentPage.value}`);
  } catch (error) {
    console.error('Failed to save progress:', error);
  }
};

const debouncedUpdateProgress = debounce(updateProgress, 1500); // Save after 1.5s of inactivity
// --- End Progress Saving Logic ---

const fetchMangaDetails = async () => {
  try {
    const response = await axios.get(`/api/v1/files/${fileId}`);
    const fileData = response.data;
    
    if (fileData) {
      totalPages.value = fileData.total_pages;
      currentPage.value = fileData.last_read_page || 0; // Start from last read page
      try {
        spreadPages.value = JSON.parse(fileData.spread_pages || '[]');
      } catch(e) {
        console.error("Failed to parse spread_pages", e);
        spreadPages.value = [];
      }
      preloadImages(); // Initial preload
    } else {
      throw new Error('Manga not found');
    }
  } catch (e) {
    error.value = 'Failed to load manga details.';
    console.error(e);
  } finally {
    isLoading.value = false;
  }
};

const nextPage = () => {
  if (currentPage.value < totalPages.value - 1) {
    currentPage.value++;
  }
};

const prevPage = () => {
  if (currentPage.value > 0) {
    currentPage.value--;
  }
};

const handleKeydown = (e) => {
  if (e.key === 'ArrowRight') {
    nextPage();
  } else if (e.key === 'ArrowLeft') {
    prevPage();
  }
};

onMounted(() => {
  fetchMangaDetails();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  updateProgress(); // Force save on exit
  window.removeEventListener('keydown', handleKeydown);
});

</script> 