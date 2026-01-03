<template>
  <GlassPage :title="$t('readerInteractionSettings')">
    <a-space direction="vertical" size="large" class="w-full">
      <GlassSurface :title="$t('readerTapZonesConfigTitle')">
        <ReaderTapZonesSettings />
      </GlassSurface>
    </a-space>
  </GlassPage>
</template>

<script setup>
import ReaderTapZonesSettings from '@/components/ReaderTapZonesSettings.vue'
import GlassPage from '@/components/glass/ui/GlassPage.vue'
import GlassSurface from '@/components/glass/ui/GlassSurface.vue'
</script>
