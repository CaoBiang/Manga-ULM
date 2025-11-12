<template>
  <div class="p-4 md:p-8">
    <a-space direction="vertical" size="large" class="w-full">
      <a-typography-title :level="2" class="!mb-0">
        {{ $t('libraryPathManagement') }}
      </a-typography-title>

      <a-card :title="$t('language')" :bordered="false">
        <a-form layout="vertical" @submit.prevent>
          <a-form-item :label="$t('language')">
            <a-select
              v-model:value="selectedLanguage"
              style="max-width: 240px"
              @change="changeLanguage"
            >
              <a-select-option value="en">{{ $t('english') }}</a-select-option>
              <a-select-option value="zh">{{ $t('chinese') }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-form>
      </a-card>

      <a-card :title="$t('library')" :bordered="false">
        <ScannerSettings />
      </a-card>

      <a-card :title="$t('taskManager')" :bordered="false">
        <TaskManager />
      </a-card>
    </a-space>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ScannerSettings from '@/components/ScannerSettings.vue'
import TaskManager from '@/components/TaskManager.vue'

const { locale } = useI18n()
const selectedLanguage = ref(locale.value)

const changeLanguage = () => {
  locale.value = selectedLanguage.value
  localStorage.setItem('lang', selectedLanguage.value)
}
</script>
