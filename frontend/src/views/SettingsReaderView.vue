<template>
  <GlassPage :title="$t('readerSettings')">
    <a-space direction="vertical" size="large" class="w-full">
      <GlassSurface :title="$t('readerSettings')">
        <ReaderSettings />
      </GlassSurface>
    </a-space>
  </GlassPage>
</template>

<script setup>
import ReaderSettings from '@/components/ReaderSettings.vue'
import GlassPage from '@/components/glass/ui/GlassPage.vue'
import GlassSurface from '@/components/glass/ui/GlassSurface.vue'
</script>

