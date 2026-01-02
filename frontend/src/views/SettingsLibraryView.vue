<template>
  <div class="p-4 md:p-8">
    <a-space direction="vertical" size="large" class="w-full">
      <a-typography-title :level="2" class="!mb-0">
        {{ $t('librarySettings') }}
      </a-typography-title>

      <ScannerSettings />

      <a-card :title="$t('libraryBrowseSettings')" :bordered="false">
        <LibraryBrowseSettings />
      </a-card>

      <a-card :title="$t('renameSettings')" :bordered="false">
        <RenameTemplateSettings />
      </a-card>
    </a-space>
  </div>
</template>

<script setup>
import ScannerSettings from '@/components/ScannerSettings.vue'
import LibraryBrowseSettings from '@/components/LibraryBrowseSettings.vue'
import RenameTemplateSettings from '@/components/RenameTemplateSettings.vue'
</script>
