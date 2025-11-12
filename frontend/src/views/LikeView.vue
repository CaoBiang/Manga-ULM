<script setup>
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import axios from 'axios'
import { message } from 'ant-design-vue'
import MangaCard from '../components/MangaCard.vue'

const likedItems = ref([])
const isLoading = ref(true)
const { t } = useI18n()

const fetchLikes = async () => {
  isLoading.value = true
  try {
    const response = await axios.get('/api/v1/likes')
    likedItems.value = response.data.map(item => ({ ...item, is_liked: true }))
  } catch (error) {
    console.error('Failed to fetch liked items:', error)
    message.error(t('loadingWishlist'))
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchLikes)
</script>

<template>
  <a-card :title="$t('myWishlist')" class="shadow-sm">
    <a-spin v-if="isLoading" class="w-full flex justify-center py-10" />
    <template v-else>
      <div v-if="likedItems.length" class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        <MangaCard
          v-for="manga in likedItems"
          :key="manga.id"
          :manga="manga"
          :hide-wishlist-button="true"
        />
      </div>
      <a-empty v-else :description="$t('wishlistEmpty')" class="py-12" />
    </template>
  </a-card>
</template>
