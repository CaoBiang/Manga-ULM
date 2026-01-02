<template>
  <div class="p-4 md:p-8">
    <a-space direction="vertical" size="large" class="w-full">
      <a-typography-title :level="2" class="!mb-0">
        {{ $t('displaySettings') }}
      </a-typography-title>

      <a-card :title="$t('libraryDisplaySettings')" :bordered="false">
        <LibraryDisplaySettings />
      </a-card>
    </a-space>
  </div>
</template>

<script setup>
import LibraryDisplaySettings from '@/components/LibraryDisplaySettings.vue'
</script>

