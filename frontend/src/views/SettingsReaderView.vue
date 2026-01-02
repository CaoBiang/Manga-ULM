<template>
  <div class="p-4 md:p-8">
    <a-space direction="vertical" size="large" class="w-full">
      <a-typography-title :level="2" class="!mb-0">
        {{ $t('readerSettings') }}
      </a-typography-title>

      <a-card :title="$t('readerSettings')" :bordered="false">
        <ReaderSettings />
      </a-card>
    </a-space>
  </div>
</template>

<script setup>
import ReaderSettings from '@/components/ReaderSettings.vue'
</script>

