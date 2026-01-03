<template>
  <GlassPage :title="$t('generalSettings')">
    <a-space direction="vertical" size="large" class="w-full">
      <GlassSurface :title="$t('language')">
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
      </GlassSurface>
    </a-space>
  </GlassPage>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useAppSettingsStore } from '@/store/appSettings'
import GlassPage from '@/components/glass/ui/GlassPage.vue'
import GlassSurface from '@/components/glass/ui/GlassSurface.vue'

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
