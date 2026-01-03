<template>
  <GlassPage :title="$t('displaySettings')">
    <a-space direction="vertical" size="large" class="w-full">
      <GlassSurface :title="$t('libraryDisplaySettings')">
        <LibraryDisplaySettings />
      </GlassSurface>

      <GlassSurface :title="$t('managerUiAppearance')">
        <ManagerAppearanceSettings />
      </GlassSurface>
    </a-space>
  </GlassPage>
</template>

<script setup>
import LibraryDisplaySettings from '@/components/LibraryDisplaySettings.vue'
import ManagerAppearanceSettings from '@/components/glass/settings/ManagerAppearanceSettings.vue'
import GlassPage from '@/components/glass/ui/GlassPage.vue'
import GlassSurface from '@/components/glass/ui/GlassSurface.vue'
</script>

