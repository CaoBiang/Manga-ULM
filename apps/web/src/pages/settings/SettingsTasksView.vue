<template>
  <GlassPage>
    <a-space direction="vertical" size="large" class="w-full">
      <GlassSurface :title="$t('taskSettings')">
        <TaskSettings />
      </GlassSurface>
      <GlassSurface>
        <TaskManager />
      </GlassSurface>
    </a-space>
  </GlassPage>
</template>

<script setup>
import TaskManager from '@/components/TaskManager.vue'
import TaskSettings from '@/components/TaskSettings.vue'
import GlassPage from '@/components/glass/ui/GlassPage.vue'
import GlassSurface from '@/components/glass/ui/GlassSurface.vue'
</script>

