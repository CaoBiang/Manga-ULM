<template>
  <GlassPage :title="$t('librarySettings')">
    <a-space direction="vertical" size="large" class="w-full">
      <ScannerSettings />

      <GlassSurface :title="$t('libraryBrowseSettings')">
        <LibraryBrowseSettings />
      </GlassSurface>

      <GlassSurface :title="$t('renameSettings')">
        <RenameTemplateSettings />
      </GlassSurface>
    </a-space>
  </GlassPage>
</template>

<script setup>
import ScannerSettings from '@/components/ScannerSettings.vue'
import LibraryBrowseSettings from '@/components/LibraryBrowseSettings.vue'
import RenameTemplateSettings from '@/components/RenameTemplateSettings.vue'
import GlassPage from '@/components/glass/ui/GlassPage.vue'
import GlassSurface from '@/components/glass/ui/GlassSurface.vue'
</script>
