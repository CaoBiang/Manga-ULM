<script setup>
import { RouterLink } from 'vue-router'
</script>

<template>
  <header class="bg-white shadow-md">
    <nav class="container mx-auto px-6 py-3 flex justify-between items-center">
      <RouterLink to="/" class="text-3xl font-extrabold text-monet-blue tracking-tight hover:text-monet-green transition-colors duration-300" active-class="" exact-active-class="">Manga ULM</RouterLink>
      <div class="flex space-x-4">
        <RouterLink to="/" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-monet-blue hover:text-white">{{ $t('home') }}</RouterLink>
        <RouterLink to="/likes" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-monet-blue hover:text-white">{{ $t('wishlist') }}</RouterLink>
        <RouterLink to="/settings" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-monet-blue hover:text-white">{{ $t('settings') }}</RouterLink>
        <RouterLink to="/maintenance" class="px-3 py-2 rounded-md text-sm font-medium text-gray-700 hover:bg-monet-blue hover:text-white">{{ $t('maintenance') }}</RouterLink>
      </div>
    </nav>
  </header>
</template>

<style scoped>
.router-link-active {
  @apply bg-monet-blue text-white;
}
</style>