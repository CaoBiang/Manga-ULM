<script setup>
import { computed, ref, watch } from 'vue';
import axios from 'axios';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps({
  manga: {
    type: Object,
    required: true
  },
  hideWishlistButton: {
    type: Boolean,
    default: false
  }
});

const isLiked = ref(props.manga.is_liked || false);

watch(() => props.manga.is_liked, (newVal) => {
  isLiked.value = newVal;
});

const fileName = computed(() => {
  // A simple way to get a display name from the path
  return props.manga.file_path.split(/[\\/]/).pop();
});

const toggleLike = async (event) => {
  event.stopPropagation();
  event.preventDefault();
  
  const originalLikedState = isLiked.value;
  isLiked.value = !isLiked.value; // Optimistic update

  try {
    if (isLiked.value) {
      await axios.post(`/api/v1/likes/${props.manga.id}`);
    } else {
      await axios.delete(`/api/v1/likes/${props.manga.id}`);
    }
  } catch (error) {
    isLiked.value = originalLikedState; // Revert on error
    console.error("Failed to update like status:", error);
    alert("Error: " + (error.response?.data?.message || "Could not update like status."));
  }
};
</script>

<template>
  <div class="group relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
    <button 
      v-if="!hideWishlistButton" 
      @click="toggleLike" 
      class="absolute top-2 right-2 z-10 p-1.5 bg-white bg-opacity-40 rounded-full text-gray-700 hover:text-red-500 transition-colors"
      :title="isLiked ? t('removeFromWishlist') : t('likeIt')"
    >
      <svg v-if="isLiked" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clip-rule="evenodd" />
      </svg>
      <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
      </svg>
    </button>
    <div class="w-full h-64 bg-monet-grey">
      <img :src="manga.cover_url" :alt="fileName" class="w-full h-full object-cover" @error.once="e => e.target.src = 'https://via.placeholder.com/300x400.png?text=No+Cover'"/>
    </div>
    <div class="p-3">
      <h3 class="text-sm font-semibold text-gray-800 truncate" :title="fileName">
        {{ fileName }}
      </h3>
      <p class="text-xs text-gray-500 mt-1">{{ manga.total_pages }} pages</p>

      <!-- Tags Display -->
      <div v-if="manga.tags && manga.tags.length" class="mt-2 flex flex-wrap gap-1">
        <span
          v-for="tag in manga.tags"
          :key="tag.id"
          class="px-2 py-0.5 text-xs bg-monet-grey text-gray-700 rounded-full"
        >
          {{ tag.name }}
        </span>
      </div>
    </div>
    <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center gap-x-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <RouterLink :to="{ name: 'reader', params: { id: manga.id } }" class="btn btn-primary">
        Read
      </RouterLink>
      <RouterLink :to="{ name: 'edit', params: { id: manga.id } }" class="btn btn-secondary">
        Edit
      </RouterLink>
    </div>
  </div>
</template> 