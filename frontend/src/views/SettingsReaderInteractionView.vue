<template>
  <div class="p-4 md:p-8">
    <a-space direction="vertical" size="large" class="w-full">
      <a-typography-title :level="2" class="!mb-0">
        {{ $t('readerInteractionSettings') }}
      </a-typography-title>

      <a-card :title="$t('readerTapZonesConfigTitle')" :bordered="false">
        <ReaderTapZonesSettings />
      </a-card>
    </a-space>
  </div>
</template>

<script setup>
import ReaderTapZonesSettings from '@/components/ReaderTapZonesSettings.vue'
</script>

