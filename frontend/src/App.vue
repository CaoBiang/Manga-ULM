<script setup>
import { RouterView } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
</script>

<template>
  <div class="bg-monet-cream min-h-screen text-gray-800">
    <PageHeader />
    
    <main class="container mx-auto p-6">
      <router-view v-slot="{ Component, route }">
        <keep-alive>
          <component :is="Component" :key="route.name" v-if="route.meta.keepAlive" />
        </keep-alive>
        <component :is="Component" :key="route.name" v-if="!route.meta.keepAlive" />
      </router-view>
    </main>
  </div>
</template>

<style scoped>
/* Styles for App.vue can be kept here if needed, or moved if they are specific to the header. */
/* The router-link-active style was moved to PageHeader.vue */
</style>