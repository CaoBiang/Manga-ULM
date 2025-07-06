<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import MangaCard from '../components/MangaCard.vue';

const wishlistItems = ref([]);
const isLoading = ref(true);
const { t } = useI18n();

const fetchWishlist = async () => {
  isLoading.value = true;
  try {
    const response = await axios.get('/api/v1/wishlist');
    wishlistItems.value = response.data;
  } catch (error) {
    console.error('Failed to fetch wishlist:', error);
    alert(t('loadingWishlist'));
  } finally {
    isLoading.value = false;
  }
};

const handleRemoveFromWishlist = async (fileId) => {
    if (!confirm(t('removeFromWishlistConfirm'))) {
        return;
    }
    try {
        await axios.delete(`/api/v1/wishlist/${fileId}`);
        // Refresh the list after removing
        fetchWishlist();
    } catch (error) {
        console.error('Failed to remove from wishlist:', error);
        alert(t('removeFromWishlist'));
    }
}

onMounted(fetchWishlist);
</script>

<template>
  <div class="p-6 bg-white rounded-lg shadow">
    <h2 class="text-xl font-semibold text-gray-700 mb-4">{{ $t('myWishlist') }}</h2>
    
    <div v-if="isLoading" class="text-center">
      <p>{{ $t('loadingWishlist') }}</p>
    </div>
    
    <div v-else-if="wishlistItems.length > 0">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <div v-for="manga in wishlistItems" :key="manga.id" class="relative group/wishlist">
            <MangaCard :manga="manga" :hide-wishlist-button="true" />
            <button @click="handleRemoveFromWishlist(manga.id)" class="absolute top-2 right-2 z-20 p-1.5 bg-red-600 rounded-full text-white opacity-0 group-hover/wishlist:opacity-100 transition-opacity" :title="$t('removeFromWishlist')">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 000 2h6a1 1 0 100-2H7z" clip-rule="evenodd" />
                </svg>
            </button>
        </div>
      </div>
    </div>

    <div v-else class="text-center text-gray-500">
      <p>{{ $t('wishlistEmpty') }}</p>
    </div>
  </div>
</template> 