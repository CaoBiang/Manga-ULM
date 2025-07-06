<script setup>
import { computed } from 'vue';
import axios from 'axios';

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

const fileName = computed(() => {
  // A simple way to get a display name from the path
  return props.manga.file_path.split(/[\\/]/).pop();
});

const addToWishlist = async (event) => {
  event.stopPropagation(); // Prevent other clicks
  event.preventDefault();
  try {
    await axios.post(`/api/v1/wishlist/${props.manga.id}`);
    // Ideally, this would be a less intrusive notification
    alert(`'${fileName.value}' has been added to your wishlist.`);
  } catch (error) {
    console.error("Failed to add to wishlist:", error);
    alert("Error: " + (error.response?.data?.message || "Could not add to wishlist."));
  }
};
</script>

<template>
  <div class="group relative bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition-shadow duration-300">
    <button v-if="!hideWishlistButton" @click="addToWishlist" class="absolute top-2 right-2 z-10 p-1.5 bg-black bg-opacity-40 rounded-full text-white hover:bg-opacity-60 hover:text-yellow-300 transition-colors" title="Add to Wishlist">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path d="M5 4a2 2 0 012-2h6a2 2 0 012 2v14l-5-2.5L5 18V4z" />
      </svg>
    </button>
    <div class="w-full h-64 bg-gray-200">
      <img :src="manga.cover_url" :alt="fileName" class="w-full h-full object-cover" @error.once="e => e.target.src = 'https://via.placeholder.com/300x400.png?text=No+Cover'"/>
    </div>
    <div class="p-3">
      <h3 class="text-sm font-semibold text-gray-800 truncate" :title="fileName">
        {{ fileName }}
      </h3>
      <p class="text-xs text-gray-500 mt-1">{{ manga.total_pages }} pages</p>
    </div>
    <div class="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
      <RouterLink :to="{ name: 'reader', params: { id: manga.id } }" class="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700">
        Read
      </RouterLink>
    </div>
  </div>
</template> 