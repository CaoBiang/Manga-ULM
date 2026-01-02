<template>
  <div class="p-4 md:p-8">
    <a-space direction="vertical" size="large" class="w-full">
      <a-typography-title :level="2" class="!mb-0">
        {{ $t('generalSettings') }}
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
    </a-space>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppSettingsStore } from '@/store/appSettings'

const { locale } = useI18n()
const appSettingsStore = useAppSettingsStore()
const selectedLanguage = ref(appSettingsStore.language)

watch(
  () => appSettingsStore.language,
  (value) => {
    if (!value) {
      return
    }
    selectedLanguage.value = value
  }
)

const changeLanguage = async () => {
  await appSettingsStore.setLanguage(selectedLanguage.value)
  locale.value = appSettingsStore.language
  if (typeof document !== 'undefined') {
    document.documentElement.lang = appSettingsStore.language
  }
}
</script>
