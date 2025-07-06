<template>
  <div class="fixed inset-0 bg-gray-900 text-white flex flex-col items-center justify-center">
    <div class="absolute top-0 left-0 p-4 z-10 flex space-x-4 items-center">
      <button @click="router.back()" class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600">
        &larr; Back to Library
      </button>
      <span v-if="isCurrentPageSpread" class="px-2 py-1 text-xs font-bold bg-purple-600 rounded">
        SPREAD
      </span>
      <!-- Bookmark Button -->
      <button @click="handleBookmarkButtonClick" :class="['p-2 rounded-full hover:bg-gray-700', { 'text-yellow-400': isCurrentPageBookmarked }]">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :fill="isCurrentPageBookmarked ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
      </button>
      <!-- Bookmarks List Toggle -->
      <button @click="showBookmarksPanel = !showBookmarksPanel" class="p-2 rounded-full hover:bg-gray-700">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
      </button>
    </div>
    
    <div v-if="isLoading" class="text-center">
      <p>Loading reader...</p>
    </div>
    
    <div v-else-if="error" class="text-center text-red-400">
      <p>{{ error }}</p>
    </div>

    <!-- Bookmarks Panel -->
    <div v-if="showBookmarksPanel" class="absolute top-20 right-4 bg-gray-800 bg-opacity-90 p-4 rounded-lg z-20 max-h-[80vh] overflow-y-auto w-64">
      <h3 class="text-lg font-bold mb-4">Bookmarks</h3>
      <ul v-if="bookmarks.length > 0" class="space-y-2">
        <li v-for="bookmark in bookmarks" :key="bookmark.id" 
            @click="jumpToBookmark(bookmark.page_number)"
            class="cursor-pointer hover:bg-gray-700 p-2 rounded flex justify-between items-center">
            <div>
              <span class="font-semibold">Page {{ bookmark.page_number + 1 }}</span>
              <span v-if="bookmark.note" class="block text-sm text-gray-300">{{ bookmark.note }}</span>
            </div>
          <button @click.stop="deleteBookmark(bookmark.id)" class="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-gray-600 shrink-0">Remove</button>
        </li>
      </ul>
      <p v-else class="text-gray-400">No bookmarks yet.</p>
    </div>

    <!-- Add Bookmark Modal -->
    <div v-if="showAddBookmarkModal" class="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-30">
        <div class="bg-gray-800 p-6 rounded-lg shadow-xl w-96">
            <h3 class="text-xl font-bold mb-4">Add Bookmark</h3>
            <p class="mb-4 text-gray-300">Add a name for your bookmark on page {{ currentPage + 1 }}.</p>
            <input 
                ref="bookmarkNameInputRef"
                type="text" 
                v-model="newBookmarkName"
                placeholder="Enter bookmark name (optional)"
                @keyup.enter="saveNewBookmark"
                class="w-full bg-gray-700 text-white rounded p-2 mb-4 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div class="flex justify-end space-x-4">
                <button @click="showAddBookmarkModal = false" class="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500">Cancel</button>
                <button @click="saveNewBookmark" class="px-4 py-2 bg-blue-600 rounded hover:bg-blue-500">Save</button>
            </div>
        </div>
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

    <!-- Page Counter & Jumper -->
    <div class="absolute bottom-0 p-4 text-lg font-semibold bg-black bg-opacity-50 rounded-t-lg flex items-center space-x-2">
       <div v-if="!showPageInput" @click="togglePageInput" class="cursor-pointer">
        <span>{{ currentPage + 1 }} / {{ totalPages }}</span>
      </div>
       <div v-else class="flex items-center">
        <input
          ref="pageInputRef"
          type="number"
          v-model.number="jumpToPageInput"
          @keyup.enter="goToPage"
          @blur="showPageInput = false"
          class="w-20 bg-gray-700 text-white text-center rounded outline-none"
          :min="1"
          :max="totalPages"
        />
        <span class="mx-2">/ {{ totalPages }}</span>
        <button @click="goToPage" class="px-2 py-0.5 bg-blue-600 rounded text-sm hover:bg-blue-500">Go</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
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
const showPageInput = ref(false);
const jumpToPageInput = ref(null);
const pageInputRef = ref(null);
const bookmarks = ref([]);
const showBookmarksPanel = ref(false);
const showAddBookmarkModal = ref(false);
const newBookmarkName = ref('');
const bookmarkNameInputRef = ref(null);

const imageUrl = computed(() => {
  if (totalPages.value === 0) return '';
  return `/api/v1/files/${fileId}/page/${currentPage.value}`;
});

const isCurrentPageSpread = computed(() => {
  return spreadPages.value.includes(currentPage.value);
});

const isCurrentPageBookmarked = computed(() => {
  return bookmarks.value.some(b => b.page_number === currentPage.value);
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

const fetchBookmarks = async () => {
  try {
    const response = await axios.get(`/api/v1/files/${fileId}/bookmarks`);
    bookmarks.value = response.data;
  } catch (error) {
    console.error('Failed to fetch bookmarks:', error);
  }
};

const toggleBookmark = async () => {
  try {
    // The backend toggles the bookmark on POST
    await axios.post(`/api/v1/files/${fileId}/bookmarks`, { page_number: currentPage.value });
    // Refetch to get the latest state (including new ID or removal)
    await fetchBookmarks();
  } catch (error) {
    console.error('Failed to toggle bookmark:', error);
  }
};

const handleBookmarkButtonClick = async () => {
    if (isCurrentPageBookmarked.value) {
        const bookmark = bookmarks.value.find(b => b.page_number === currentPage.value);
        if (bookmark) {
            await deleteBookmark(bookmark.id);
        }
    } else {
        newBookmarkName.value = '';
        showAddBookmarkModal.value = true;
        await nextTick();
        bookmarkNameInputRef.value?.focus();
    }
};

const saveNewBookmark = async () => {
    try {
        await axios.post(`/api/v1/files/${fileId}/bookmarks`, {
            page_number: currentPage.value,
            note: newBookmarkName.value,
        });
        await fetchBookmarks();
        showAddBookmarkModal.value = false;
    } catch (error) {
        console.error('Failed to add bookmark:', error);
        // Optionally, handle error (e.g., show a notification)
    }
};

const deleteBookmark = async (bookmarkId) => {
    try {
        await axios.delete(`/api/v1/bookmarks/${bookmarkId}`);
        await fetchBookmarks();
    } catch (error) {
        console.error('Failed to delete bookmark:', error);
    }
};

const jumpToBookmark = (pageNumber) => {
    currentPage.value = pageNumber;
    showBookmarksPanel.value = false; // Hide panel after jumping
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

const goToPage = () => {
  let page = parseInt(jumpToPageInput.value, 10);
  if (!isNaN(page) && page >= 1 && page <= totalPages.value) {
    currentPage.value = page - 1;
  }
  showPageInput.value = false;
};

const togglePageInput = async () => {
  showPageInput.value = true;
  jumpToPageInput.value = currentPage.value + 1;
  await nextTick(); // Wait for the DOM to update
  pageInputRef.value?.focus();
  pageInputRef.value?.select();
};

const handleKeydown = (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowRight') {
    nextPage();
  } else if (e.key === 'ArrowLeft') {
    prevPage();
  }
};

onMounted(() => {
  fetchMangaDetails();
  fetchBookmarks();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  updateProgress(); // Force save on exit
  window.removeEventListener('keydown', handleKeydown);
});

</script> 