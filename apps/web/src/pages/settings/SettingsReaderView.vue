<template>
  <GlassPage>
    <a-space direction="vertical" size="large" class="w-full">
      <GlassSurface :title="$t('readerBehaviorSettingsTitle')">
        <ReaderBehaviorSettings />
      </GlassSurface>

      <GlassSurface :title="$t('readerUiAppearance')">
        <ReaderUiAppearanceSettings />
      </GlassSurface>

      <GlassSurface :title="$t('readerTapZonesConfigTitle')">
        <ReaderTapZonesSettings />
      </GlassSurface>
    </a-space>
  </GlassPage>
</template>

<script setup>
import ReaderTapZonesSettings from '@/components/ReaderTapZonesSettings.vue'
import ReaderBehaviorSettings from '@/components/reader/settings/ReaderBehaviorSettings.vue'
import ReaderUiAppearanceSettings from '@/components/reader/settings/ReaderUiAppearanceSettings.vue'
import GlassPage from '@/components/glass/ui/GlassPage.vue'
import GlassSurface from '@/components/glass/ui/GlassSurface.vue'
</script>

