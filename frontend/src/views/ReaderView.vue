<template>
  <div class="fixed inset-0 bg-gray-900 text-white flex flex-col items-center justify-center" @click="collapseToolbar">
    <div class="absolute top-0 left-0 p-4 z-10 flex space-x-4 items-center">
      <button @click.stop="router.back()" class="px-3 py-1 bg-gray-700 rounded hover:bg-gray-600">
        &larr; {{ $t('backToLibrary') }}
      </button>
      <span v-if="isCurrentPageSpread" class="px-2 py-1 text-xs font-bold bg-purple-600 rounded">
        {{ $t('spread') }}
      </span>
    </div>
    
    
    <div v-if="error" class="text-center text-red-400">
      <p>{{ error }}</p>
    </div>

    <!-- Main Image Display -->
    <div v-else class="relative w-full h-full flex items-center justify-center overflow-hidden" @click="collapseToolbar">
      <img 
        ref="imageRef"
        :src="imageUrl" 
        :alt="`${$t('page')} ${currentPage + 1}`" 
        class="transition-transform duration-300 ease-in-out"
        :class="imageClasses"
        :style="imageStyles"
        @load="onImageLoad"
      />

      <!-- Navigation Arrows -->
      <div class="absolute left-0 top-0 h-full w-1/3 cursor-pointer" @click.stop="prevPage"></div>
      <div class="absolute right-0 top-0 h-full w-1/3 cursor-pointer" @click.stop="nextPage"></div>
    </div>

    <!-- Toolbar Area -->
    <div class="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/4 max-w-4xl p-2 flex justify-center items-end" @click.stop>
      <transition name="toolbar" mode="out-in">
        <!-- Collapsed Toolbar -->
        <div 
          v-if="!isToolbarExpanded" 
          key="collapsed"
          @click="expandToolbar"
          class="bg-black bg-opacity-70 rounded-lg w-40 h-10 flex items-center justify-center cursor-pointer"
        >
          <span class="text-lg font-semibold px-2">{{ currentPage + 1 }} / {{ totalPages }}</span>
        </div>

        <!-- Expanded Toolbar -->
        <div
          v-else
          key="expanded"
          class="bg-black bg-opacity-70 rounded-lg flex flex-col p-2 w-full"
        >
          <!-- Top part of the toolbar -->
          <div class="flex items-center justify-between w-full h-10 space-x-4">
            <div class="flex-grow flex items-center px-2">
              <Slider
                v-model="currentPage"
                :min="0"
                :max="totalPages > 0 ? totalPages - 1 : 0"
                class="w-full slider-custom"
                @change="jumpToPage"
                :showTooltip="'drag'"
                :format="value => Math.round(value) + 1"
              />
            </div>
            <span class="w-24 text-right text-lg font-semibold">{{ currentPage + 1 }} / {{ totalPages }}</span>
            
            <div class="flex items-center space-x-2">
              <!-- Paging/Split-page Button -->
              <button @click.stop="togglePagingMode" :class="['p-2 rounded-full transition-colors bg-gray-800 bg-opacity-75 hover:bg-gray-700', {'!bg-blue-600 text-white': isPagingEnabled}]">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                </svg>
              </button>
              <!-- Bookmark Button -->
              <button @click.stop="handleBookmarkButtonClick" :class="['p-2 rounded-full transition-colors', isCurrentPageBookmarked ? 'text-yellow-400 bg-gray-700' : 'bg-gray-800 bg-opacity-75 hover:bg-gray-700', {'!bg-blue-600 text-white': activePanel === 'addBookmark'}]">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" :fill="isCurrentPageBookmarked ? 'currentColor' : 'none'" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                </svg>
              </button>
              <!-- Bookmarks List Toggle -->
              <button @click.stop="togglePanel('bookmarks')" :class="['p-2 rounded-full transition-colors bg-gray-800 bg-opacity-75 hover:bg-gray-700', {'!bg-blue-600 text-white': activePanel === 'bookmarks'}]">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" /></svg>
              </button>
              <!-- File Info Button -->
              <button @click.stop="togglePanel('fileInfo')" :class="['p-2 rounded-full transition-colors bg-gray-800 bg-opacity-75 hover:bg-gray-700', {'!bg-blue-600 text-white': activePanel === 'fileInfo'}]">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
          </div>
          
          <!-- Wrapper for animated expansion -->
          <div
            class="transition-[max-height] duration-300 ease-in-out overflow-hidden"
            :style="{ 'max-height': activePanel ? '40vh' : '0px' }"
          >
            <transition name="fade" mode="out-in">
              <!-- Expanded Content Area -->
              <div v-if="activePanel" class="mt-2 pt-3 px-1 border-t border-gray-600 overflow-y-auto max-h-[40vh]">
                <!-- Add Bookmark Content -->
                <div v-if="activePanel === 'addBookmark'">
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
                        <button @click="activePanel = ''" class="px-3 py-1 bg-gray-600 rounded hover:bg-gray-500 text-sm">{{ $t('cancel') }}</button>
                        <button @click="saveNewBookmark" class="px-3 py-1 bg-blue-600 rounded hover:bg-blue-500 text-sm">{{ $t('save') }}</button>
                    </div>
                </div>

                <!-- Bookmarks List Content -->
                <div v-if="activePanel === 'bookmarks'">
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
                <div v-if="activePanel === 'fileInfo'">
                    <h3 class="text-base font-bold mb-2 text-center">{{ $t('fileInfo') }}</h3>
                    <div v-if="fileInfo.error" class="text-red-400 text-center">{{ fileInfo.error }}</div>
                    <div v-else class="space-y-1 text-xs">
                      <div>
                        <p class="font-semibold text-gray-300">{{ $t('mangaFile') }}:</p>
                        <p class="text-gray-100 break-all">{{ fileInfo.data.manga_filename }}</p>
                        <p class="text-gray-400">{{ formatBytes(fileInfo.data.manga_filesize) }}</p>
                      </div>
                      <div class="border-t border-gray-700 my-1"></div>
                      <div>
                        <p class="font-semibold text-gray-300">{{ $t('currentPageFile') }}:</p>
                        <p class="text-gray-100 break-all">{{ fileInfo.data.page_filename }}</p>
                        <p class="text-gray-400">{{ formatBytes(fileInfo.data.page_filesize) }}</p>
                      </div>
                    </div>
                </div>
              </div>
            </transition>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import axios from 'axios';
import Slider from '@vueform/slider';
import '@vueform/slider/themes/default.css';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

const fileId = route.params.id;
const currentPage = ref(0);
const totalPages = ref(0);
const spreadPages = ref([]); // To store the pages that are spreads
const isLoading = ref(true);
const error = ref(null);
const isToolbarExpanded = ref(false);
const bookmarks = ref([]);
const newBookmarkName = ref('');
const bookmarkNameInputRef = ref(null);
const activePanel = ref(''); // Can be '', 'bookmarks', 'addBookmark', 'fileInfo'
const fileInfo = ref({
  loading: false,
  error: null,
  data: null,
});
const imageRef = ref(null);

const sizeUnits = computed(() => [
  t('sizeUnitB'),
  t('sizeUnitKB'),
  t('sizeUnitMB'),
  t('sizeUnitGB'),
  t('sizeUnitTB')
])

// --- Paging/Splitting Logic ---
const isPagingEnabled = ref(false);
const isCurrentImageWide = ref(false);
const showRightHalf = ref(false);

const shouldShowSplitView = computed(() => {
  return isPagingEnabled.value && isCurrentImageWide.value;
});

const imageClasses = computed(() => {
  if (shouldShowSplitView.value) {
    return 'h-full w-auto max-w-none';
  }
  return 'object-contain max-w-full max-h-full';
});

const imageStyles = computed(() => {
  if (!shouldShowSplitView.value || !imageRef.value) {
    return { transform: 'translateX(0)' };
  }

  const imageWidth = imageRef.value.offsetWidth;
  let translateX = 0;

  // For a centered image, to show the left page (center of left half),
  // we need to shift the image to the right by a quarter of its total width.
  if (showRightHalf.value) {
    translateX = -imageWidth * 0.25;
  } else {
    translateX = imageWidth * 0.25;
  }
  
  return { transform: `translateX(${translateX}px)` };
});

const onImageLoad = (event) => {
  const img = event.target;
  isCurrentImageWide.value = img.naturalWidth > img.naturalHeight;
  // When a new image loads, we might need to re-calculate the transform
  nextTick(() => {
    // This just ensures reactivity is triggered if needed, style is already computed
  });
};

const togglePagingMode = () => {
  isPagingEnabled.value = !isPagingEnabled.value;
  showRightHalf.value = false; // Reset on mode toggle
};
// --- End Paging/Splitting Logic ---


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
  
  showRightHalf.value = false;

  if (activePanel.value) {
    activePanel.value = '';
  }

  if (fileInfo.value.data && newPage !== oldPage) {
    fileInfo.value.data = null;
  }
});

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

const debouncedUpdateProgress = debounce(updateProgress, 1500);
// --- End Progress Saving Logic ---

const fetchMangaDetails = async () => {
  try {
    const response = await axios.get(`/api/v1/files/${fileId}`);
    const fileData = response.data;
    
    if (fileData) {
      totalPages.value = fileData.total_pages;
      currentPage.value = fileData.last_read_page || 0;
      try {
        spreadPages.value = JSON.parse(fileData.spread_pages || '[]');
      } catch(e) {
        console.error("Failed to parse spread_pages", e);
        spreadPages.value = [];
      }
      preloadImages();
    } else {
      throw new Error(t('mangaNotFound'));
    }
  } catch (e) {
    console.error('Failed to fetch manga details:', e);
    error.value = t('failedToLoadMangaDetails');
  } finally {
    isLoading.value = false;
  }
};

const fetchBookmarks = async () => {
  try {
    const response = await axios.get(`/api/v1/files/${fileId}/bookmarks`);
    bookmarks.value = response.data;
  } catch (err) {
    console.error('Failed to fetch bookmarks:', err);
    bookmarks.value = [];
  }
};

const handleBookmarkButtonClick = () => {
  if (isCurrentPageBookmarked.value) {
    togglePanel('bookmarks');
    return;
  }
  
  newBookmarkName.value = '';
  activePanel.value = 'addBookmark';
  nextTick(() => {
    bookmarkNameInputRef.value?.focus();
  });
};

const saveNewBookmark = async () => {
  if (!isToolbarExpanded.value) return;
  try {
    await axios.post(`/api/v1/files/${fileId}/bookmarks`, {
      page: currentPage.value,
      note: newBookmarkName.value || null,
    });
    newBookmarkName.value = '';
    activePanel.value = '';
    fetchBookmarks();
  } catch (error) {
    console.error('Error saving bookmark:', error);
    alert(t('failedToSaveBookmark'));
  }
};

const deleteBookmark = async (bookmarkId) => {
  try {
    await axios.delete(`/api/v1/bookmarks/${bookmarkId}`);
    fetchBookmarks();
  } catch (err) {
    console.error('Failed to delete bookmark:', err);
    alert(t('failedToDeleteBookmark'));
  }
};

const jumpToBookmark = (page) => {
  currentPage.value = page;
  activePanel.value = '';
};

const nextPage = () => {
  if (shouldShowSplitView.value && !showRightHalf.value) {
    showRightHalf.value = true;
  } else if (currentPage.value < totalPages.value - 1) {
    currentPage.value++;
  }
};

const prevPage = () => {
  if (shouldShowSplitView.value && showRightHalf.value) {
    showRightHalf.value = false;
  } else if (currentPage.value > 0) {
    currentPage.value--;
  }
};

const jumpToPage = (page) => {
  currentPage.value = parseInt(page, 10);
};

const handleKeydown = (e) => {
  if (e.target.tagName === 'INPUT') return;

  if (e.key === 'ArrowLeft') {
    prevPage();
  } else if (e.key === 'ArrowRight') {
    nextPage();
  } else if (e.key === 'b' || e.key === 'B') {
    handleBookmarkButtonClick();
  } else if (e.key === 'f' || e.key === 'F') {
    togglePanel('fileInfo');
  } else if (e.key === 'l' || e.key === 'L') {
    togglePanel('bookmarks');
  } else if (e.key === 'p' || e.key === 'P') {
    togglePagingMode();
  } else if (e.key === 'Escape') {
    if (activePanel.value) {
      activePanel.value = '';
    } else if (isToolbarExpanded.value) {
      collapseToolbar();
    } else {
      router.back();
    }
  }
};

const togglePanel = (panel) => {
  const currentPanel = activePanel.value;

  if (currentPanel === panel) {
    activePanel.value = '';
    return;
  }

  const fetchData = () => {
    if (panel === 'bookmarks') {
      fetchBookmarks();
    } else if (panel === 'fileInfo') {
      fetchFileInfo();
    }
  };

  if (currentPanel) {
    activePanel.value = '';
    setTimeout(() => {
      activePanel.value = panel;
      fetchData();
    }, 50);
  } else {
    activePanel.value = panel;
    fetchData();
  }
};

const fetchFileInfo = async () => {
  if (!isToolbarExpanded.value) return;
  fileInfo.value.loading = true;
  fileInfo.value.error = null;
  try {
    const response = await axios.get(`/api/v1/files/${fileId}/page/${currentPage.value}/details`);
    fileInfo.value.data = response.data;
  } catch (err) {
    console.error("Failed to fetch file info:", err);
    fileInfo.value.error = t('failedToLoadFileInfo');
  } finally {
    fileInfo.value.loading = false;
  }
};

const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return `0 ${sizeUnits.value[0]}`
  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const value = parseFloat((bytes / Math.pow(k, i)).toFixed(dm))
  const unit = sizeUnits.value[i] || sizeUnits.value[sizeUnits.value.length - 1]
  return `${value} ${unit}`
}

const expandToolbar = () => {
  isToolbarExpanded.value = true;
};

const collapseToolbar = () => {
  activePanel.value = '';
  isToolbarExpanded.value = false;
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
.slider-custom {
  --slider-bg: #4B5563; /* bg-gray-600 */
  --slider-connect-bg: #3B82F6; /* bg-blue-500 */
  --slider-handle-bg: #FFFFFF;
  --slider-height: 8px;
  --slider-handle-width: 20px;
  --slider-handle-height: 20px;
  --slider-handle-shadow: none;
  --slider-handle-shadow-active: none;
  --slider-handle-ring-color: transparent;
}
</style>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease-in-out;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.toolbar-enter-active,
.toolbar-leave-active {
  transition: all 0.2s ease-out;
}
.toolbar-enter-from,
.toolbar-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
