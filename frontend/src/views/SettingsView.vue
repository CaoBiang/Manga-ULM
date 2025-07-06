<template>
  <div class="space-y-8">
    <ScannerSettings />
    <FilenameTemplateManager />
    <TagManager />
  </div>
</template>

<script setup>
import ScannerSettings from '../components/ScannerSettings.vue';
import TagManager from '../components/TagManager.vue';
import FilenameTemplateManager from '../components/FilenameTemplateManager.vue';
</script> 