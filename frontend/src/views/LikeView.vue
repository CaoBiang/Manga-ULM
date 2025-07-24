<script setup>
import { ref, onMounted } from 'vue';
import { useI18n } from 'vue-i18n';
import axios from 'axios';
import MangaCard from '../components/MangaCard.vue';

const likedItems = ref([]);
const isLoading = ref(true);
const { t } = useI18n();

const fetchLikes = async () => {
  isLoading.value = true;
  try {
    const response = await axios.get('/api/v1/likes');
    // Ensure every item from the likes list is marked as liked for the card component
    likedItems.value = response.data.map(item => ({ ...item, is_liked: true }));
  } catch (error) {
    console.error('Failed to fetch liked items:', error);
    // Note: Using a more specific i18n key might be better in the future
    alert(t('loadingWishlist')); // This key was updated to "Loading Likes..."
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchLikes);
</script>

<template>
  <div class="p-6 bg-white rounded-lg shadow">
    <h2 class="text-xl font-semibold text-gray-700 mb-4">{{ $t('myWishlist') }}</h2>
    
    
    <div v-if="likedItems.length > 0">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <MangaCard 
          v-for="manga in likedItems" 
          :key="manga.id" 
          :manga="manga"
        />
      </div>
    </div>

    <div v-else class="text-center text-gray-500">
      <p>{{ $t('wishlistEmpty') }}</p>
    </div>
  </div>
</template> 