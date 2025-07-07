<template>
  <div class="fixed inset-0 bg-gray-900 text-white flex flex-col items-center justify-center">
    <div class="absolute top-0 left-0 p-4 z-10 flex space-x-4 items-center">
      <button @click="router.back()" class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600">
        &larr; {{ $t('backToLibrary') }}
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

    <div v-else class="relative w-full h-full flex items-center justify-center" @click="isSliderExpanded = false; expandedToolbarContent = ''">
      <!-- Main Image Display -->
      <div class="relative max-w-full max-h-full">
        <img :src="imageUrl" :alt="`Page ${currentPage + 1}`" class="h-auto max-h-screen w-auto object-contain" />
      </div>

      <!-- Navigation Arrows -->
      <div class="absolute left-0 top-0 h-full w-1/3 cursor-pointer" @click="prevPage"></div>
      <div class="absolute right-0 top-0 h-full w-1/3 cursor-pointer" @click="nextPage"></div>
    </div>

    <!-- Toolbar -->
    <div
      @click.stop
      class="absolute bottom-0 left-1/2 -translate-x-1/2 bg-black bg-opacity-70 rounded-t-lg transition-all duration-300 ease-in-out flex flex-col"
      :class="{
        'w-auto p-2': !isSliderExpanded,
        'w-3/4 p-4': isSliderExpanded,
      }"
    >
      <!-- Top part of the toolbar (always visible when expanded) -->
      <div 
        class="flex items-center justify-between w-full min-h-[40px]"
        :class="{'cursor-pointer': !isSliderExpanded}"
        @click="!isSliderExpanded ? (isSliderExpanded = true) : null"
      >
        <div v-if="!isSliderExpanded" class="text-lg font-semibold px-2 w-full text-center">
          <span>{{ currentPage + 1 }} / {{ totalPages }}</span>
        </div>
        
        <template v-else>
          <input
            type="range"
            v-model="currentPage"
            :min="0"
            :max="totalPages - 1"
            class="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider-thumb-white"
            @input="jumpToPage($event.target.value)"
          />
          <span class="ml-4 w-24 text-right text-lg font-semibold">{{ currentPage + 1 }} / {{ totalPages }}</span>
          
          <div class="flex items-center space-x-2 ml-6">
            <!-- Bookmark Button -->
            <button @click.stop="handleBookmarkButtonClick" :class="['p-2 rounded-full bg-gray-800 bg-opacity-75 hover:bg-gray-700', { 'text-yellow-400': isCurrentPageBookmarked }]">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :fill="isCurrentPageBookmarked ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
            </button>
            <!-- Bookmarks List Toggle -->
            <button @click.stop="toggleBookmarksPanel" class="p-2 rounded-full bg-gray-800 bg-opacity-75 hover:bg-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
            </button>
            <!-- File Info Button -->
            <button @click.stop="toggleFileInfoPanel" class="p-2 rounded-full bg-gray-800 bg-opacity-75 hover:bg-gray-700">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          </div>
        </template>
      </div>

      <!-- Wrapper for animated expansion -->
      <div 
        class="transition-[grid-template-rows] duration-300 ease-in-out grid"
        :style="{ 'grid-template-rows': (isSliderExpanded && expandedToolbarContent) ? '1fr' : '0fr' }"
      >
        <div class="overflow-hidden">
          <!-- Expanded Content Area -->
          <div v-if="isSliderExpanded && expandedToolbarContent" class="mt-4 pt-4 border-t border-gray-600 overflow-y-auto max-h-[40vh]">
            <!-- Add Bookmark Content -->
            <div v-if="expandedToolbarContent === 'addBookmark'">
                <p class="mb-2 text-gray-300 text-center text-sm">{{ $t('addBookmarkPrompt', { page: currentPage + 1 }) }}</p>
                <input 
                    ref="bookmarkNameInputRef"
                    type="text" 
                    v-model="newBookmarkName"
                    :placeholder="$t('bookmarkNamePlaceholder')"
                    @keyup.enter="saveNewBookmark"
                    class="w-full bg-gray-700 text-white rounded p-2 mb-2 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div class="flex justify-end space-x-2">
                    <button @click="expandedToolbarContent = ''" class="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500 text-sm">{{ $t('cancel') }}</button>
                    <button @click="saveNewBookmark" class="px-3 py-1 bg-blue-600 rounded hover:bg-blue-500 text-sm">{{ $t('save') }}</button>
                </div>
            </div>

            <!-- Bookmarks List Content -->
            <div v-if="expandedToolbarContent === 'bookmarks'">
              <h3 class="text-base font-bold mb-2 text-center">{{ $t('bookmarks') }}</h3>
              <ul v-if="bookmarks.length > 0" class="space-y-1">
                <li v-for="bookmark in bookmarks" :key="bookmark.id" 
                    @click="jumpToBookmark(bookmark.page_number)"
                    class="cursor-pointer hover:bg-gray-700 p-1.5 rounded flex justify-between items-center text-sm">
                    <div>
                      <span class="font-semibold">{{ $t('page') }} {{ bookmark.page_number + 1 }}</span>
                      <span v-if="bookmark.note" class="block text-xs text-gray-300">{{ bookmark.note }}</span>
                    </div>
                  <button @click.stop="deleteBookmark(bookmark.id)" class="text-red-500 hover:text-red-400 text-xs px-2 py-1 rounded hover:bg-gray-600 shrink-0">{{ $t('remove') }}</button>
                </li>
              </ul>
              <p v-else class="text-gray-400 text-center text-sm">{{ $t('noBookmarks') }}</p>
            </div>

            <!-- File Info Content -->
            <div v-if="expandedToolbarContent === 'fileInfo'">
                <h3 class="text-base font-bold mb-2 text-center">{{ $t('fileInfo') }}</h3>
                <div v-if="fileInfo.loading" class="text-gray-400 text-center">{{ $t('loading') }}...</div>
                <div v-else-if="fileInfo.error" class="text-red-400 text-center">{{ fileInfo.error }}</div>
                <div v-else class="space-y-1 text-xs">
                  <div>
                    <p class="font-semibold text-gray-300">Manga File:</p>
                    <p class="text-gray-100 break-all">{{ fileInfo.data.manga_filename }}</p>
                    <p class="text-gray-400">{{ formatBytes(fileInfo.data.manga_filesize) }}</p>
                  </div>
                  <div class="border-t border-gray-700 my-1"></div>
                  <div>
                    <p class="font-semibold text-gray-300">Current Page:</p>
                    <p class="text-gray-100 break-all">{{ fileInfo.data.page_filename }}</p>
                    <p class="text-gray-400">{{ formatBytes(fileInfo.data.page_filesize) }}</p>
                  </div>
                </div>
            </div>
          </div>
        </div>
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
const isSliderExpanded = ref(false);
const bookmarks = ref([]);
const newBookmarkName = ref('');
const bookmarkNameInputRef = ref(null);
const expandedToolbarContent = ref(''); // Can be '', 'bookmarks', 'addBookmark', 'fileInfo'
const fileInfo = ref({
  loading: false,
  error: null,
  data: null,
});

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

watch(currentPage, (newPage, oldPage) => {
  preloadImages();
  debouncedUpdateProgress();
  
  // Close any open toolbar content when page changes
  if (expandedToolbarContent.value) {
    expandedToolbarContent.value = '';
  }

  // Refetch file info if it was open for the previous page
  if (fileInfo.value.data && newPage !== oldPage) {
    fileInfo.value.data = null; // Invalidate old data
  }
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

const handleBookmarkButtonClick = () => {
  if (isCurrentPageBookmarked.value) {
    const bookmark = bookmarks.value.find(b => b.page_number === currentPage.value);
    if(bookmark) {
      deleteBookmark(bookmark.id);
    }
  } else {
    newBookmarkName.value = '';
    expandedToolbarContent.value = 'addBookmark';
    nextTick(() => {
      bookmarkNameInputRef.value?.focus();
    });
  }
};

const saveNewBookmark = async () => {
  if (!isSliderExpanded.value) return; // Prevent action if toolbar not fully open
  try {
    const response = await axios.post(`/api/v1/files/${fileId}/bookmarks`, {
      page_number: currentPage.value,
      note: newBookmarkName.value,
    });
    bookmarks.value.push(response.data);
    bookmarks.value.sort((a, b) => a.page_number - b.page_number); // Keep bookmarks sorted
    expandedToolbarContent.value = ''; // Close panel
    newBookmarkName.value = '';
  } catch (error) {
    console.error('Failed to save bookmark:', error);
  }
};

const deleteBookmark = async (bookmarkId) => {
  try {
    await axios.delete(`/api/v1/bookmarks/${bookmarkId}`);
    bookmarks.value = bookmarks.value.filter(b => b.id !== bookmarkId);
  } catch (error) {
    console.error('Failed to delete bookmark:', error);
  }
};

const jumpToBookmark = (pageNumber) => {
  currentPage.value = pageNumber;
  expandedToolbarContent.value = ''; // Close panel
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

const jumpToPage = (pageNumber) => {
  const newPage = Number(pageNumber);
  if (newPage >= 0 && newPage < totalPages.value) {
    currentPage.value = newPage;
  }
};

const handleKeydown = (e) => {
  // Disable keyboard shortcuts when adding a bookmark to allow typing
  if (expandedToolbarContent.value === 'addBookmark') {
    return;
  }
  if (e.key === 'ArrowLeft') {
    prevPage();
  } else if (e.key === 'ArrowRight') {
    nextPage();
  }
};

const toggleBookmarksPanel = () => {
  if (expandedToolbarContent.value === 'bookmarks') {
    expandedToolbarContent.value = '';
  } else {
    // isSliderExpanded must be true to show content
    isSliderExpanded.value = true;
    expandedToolbarContent.value = 'bookmarks';
  }
};

const toggleFileInfoPanel = () => {
  if (expandedToolbarContent.value === 'fileInfo') {
    expandedToolbarContent.value = '';
  } else {
    // isSliderExpanded must be true to show content
    isSliderExpanded.value = true;
    expandedToolbarContent.value = 'fileInfo';
    // Fetch info if not already loaded for the current page
    if (!fileInfo.value.data) {
       fetchFileInfo();
    }
  }
};

const fetchFileInfo = async () => {
  fileInfo.value.loading = true;
  try {
    const response = await axios.get(`/api/v1/files/${fileId}/page/${currentPage.value}/details`);
    fileInfo.value = { loading: false, error: null, data: response.data };
  } catch (err) {
    console.error('Failed to fetch file info:', err);
    fileInfo.value = { loading: false, error: 'Could not load file details.', data: null };
  }
};

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

onMounted(() => {
  fetchMangaDetails();
  fetchBookmarks();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  debouncedUpdateProgress.flush(); // Ensure last progress is saved when leaving
});

// Helper to flush the debounced function
debouncedUpdateProgress.flush = () => {
  const B = updateProgress;
};
</script>

<style>
.slider-thumb-white::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  background: #ffffff;
  cursor: pointer;
  border-radius: 50%;
  margin-top: -8px; /* Center thumb on the track */
}

.slider-thumb-white::-moz-range-thumb {
  width: 20px;
  height: 20px;
  background: #ffffff;
  cursor: pointer;
  border-radius: 50%;
}
</style> 