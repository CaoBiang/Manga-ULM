<template>
  <a-form layout="vertical" @submit.prevent>
    <a-form-item :label="$t('readerUiBlurEnabled')">
      <a-switch v-model:checked="formReaderUiBlurEnabled" />
      <div class="mt-1 text-xs text-gray-500">
        {{ $t('readerUiBlurEnabledHelp') }}
      </div>
    </a-form-item>

    <a-form-item :label="$t('readerUiBlurRadiusPx')">
      <a-input-number
        v-model:value="formReaderUiBlurRadiusPx"
        :min="0"
        :max="30"
        :step="1"
        style="max-width: 240px"
      />
      <div class="mt-1 text-xs text-gray-500">
        {{ $t('readerUiBlurRadiusPxHelp') }}
      </div>
    </a-form-item>

    <a-form-item :label="$t('readerUiControlBgOpacity')">
      <a-input-number
        v-model:value="formReaderUiControlBgOpacity"
        :min="0.12"
        :max="0.7"
        :step="0.02"
        style="max-width: 240px"
      />
      <div class="mt-1 text-xs text-gray-500">
        {{ $t('readerUiControlBgOpacityHelp') }}
      </div>
    </a-form-item>

    <a-form-item :label="$t('readerUiControlBorderOpacity')">
      <a-input-number
        v-model:value="formReaderUiControlBorderOpacity"
        :min="0.06"
        :max="0.4"
        :step="0.02"
        style="max-width: 240px"
      />
      <div class="mt-1 text-xs text-gray-500">
        {{ $t('readerUiControlBorderOpacityHelp') }}
      </div>
    </a-form-item>

    <a-space>
      <a-button type="primary" :loading="saving" @click="save">
        {{ $t('save') }}
      </a-button>
      <a-button :disabled="saving" @click="resetToDefault">
        {{ $t('resetToDefault') }}
      </a-button>
    </a-space>
  </a-form>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { useAppSettingsStore } from '@/store/appSettings'

const { t } = useI18n()
const appSettingsStore = useAppSettingsStore()

const saving = ref(false)
const formReaderUiBlurEnabled = ref(appSettingsStore.readerUiBlurEnabled)
const formReaderUiBlurRadiusPx = ref(appSettingsStore.readerUiBlurRadiusPx)
const formReaderUiControlBgOpacity = ref(appSettingsStore.readerUiControlBgOpacity)
const formReaderUiControlBorderOpacity = ref(appSettingsStore.readerUiControlBorderOpacity)

watch(
  () => appSettingsStore.readerUiBlurEnabled,
  value => {
    formReaderUiBlurEnabled.value = value
  }
)
watch(
  () => appSettingsStore.readerUiBlurRadiusPx,
  value => {
    formReaderUiBlurRadiusPx.value = value
  }
)
watch(
  () => appSettingsStore.readerUiControlBgOpacity,
  value => {
    formReaderUiControlBgOpacity.value = value
  }
)
watch(
  () => appSettingsStore.readerUiControlBorderOpacity,
  value => {
    formReaderUiControlBorderOpacity.value = value
  }
)

const save = async () => {
  saving.value = true
  try {
    await Promise.all([
      appSettingsStore.setReaderUiBlurEnabled(formReaderUiBlurEnabled.value),
      appSettingsStore.setReaderUiBlurRadiusPx(formReaderUiBlurRadiusPx.value),
      appSettingsStore.setReaderUiControlBgOpacity(formReaderUiControlBgOpacity.value),
      appSettingsStore.setReaderUiControlBorderOpacity(formReaderUiControlBorderOpacity.value)
    ])
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('保存阅读器外观设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}

const resetToDefault = async () => {
  saving.value = true
  try {
    await Promise.all([
      appSettingsStore.setReaderUiBlurEnabled(true),
      appSettingsStore.setReaderUiBlurRadiusPx(12),
      appSettingsStore.setReaderUiControlBgOpacity(0.46),
      appSettingsStore.setReaderUiControlBorderOpacity(0.16)
    ])
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('重置阅读器外观设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}
</script>

