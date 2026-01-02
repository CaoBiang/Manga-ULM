<template>
  <div class="p-4 md:p-8">
    <a-space direction="vertical" size="large" class="w-full">
      <a-typography-title :level="2" class="!mb-0">
        {{ $t('taskManager') }}
      </a-typography-title>

      <TaskManager />
    </a-space>
  </div>
</template>

<script setup>
import TaskManager from '@/components/TaskManager.vue'
</script>

