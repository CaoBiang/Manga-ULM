<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="bg-monet-cream min-h-screen text-gray-800">
    <header class="bg-white shadow-md">
      <nav class="container mx-auto px-6 py-3 flex justify-between items-center">
        <RouterLink to="/" class="text-2xl font-bold text-gray-800">Manga ULM</RouterLink>
        <div class="flex space-x-4">
          <RouterLink to="/" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-monet-blue hover:text-white">{{ $t('home') }}</RouterLink>
          <RouterLink to="/wishlist" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-monet-blue hover:text-white">{{ $t('wishlist') }}</RouterLink>
          <RouterLink to="/settings" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-monet-blue hover:text-white">{{ $t('settings') }}</RouterLink>
          <RouterLink to="/maintenance" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-monet-blue hover:text-white">{{ $t('maintenance') }}</RouterLink>
        </div>
      </nav>
    </header>
    
    <main class="container mx-auto p-6">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.router-link-active {
  @apply bg-monet-blue text-white;
}
</style> 