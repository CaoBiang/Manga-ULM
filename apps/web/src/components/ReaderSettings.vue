<template>
  <a-space direction="vertical" size="large" class="w-full">
    <a-form layout="vertical" @submit.prevent>
      <a-form-item :label="$t('readerPreloadAhead')">
        <a-input-number
          v-model:value="formPreloadAhead"
          :min="0"
          :max="20"
          :step="1"
          style="max-width: 240px"
        />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('readerPreloadAheadHelp') }}
        </div>
      </a-form-item>

      <a-form-item :label="$t('readerSplitViewDefaultEnabled')">
        <a-switch v-model:checked="formSplitDefaultEnabled" />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('readerSplitViewDefaultEnabledHelp') }}
        </div>
      </a-form-item>

      <a-form-item :label="$t('readerWideRatioThreshold')">
        <a-input-number
          v-model:value="formWideRatioThreshold"
          :min="1"
          :max="5"
          :step="0.05"
          style="max-width: 240px"
        />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('readerWideRatioThresholdHelp') }}
        </div>
      </a-form-item>

      <a-form-item :label="$t('readerToolbarAnimationMs')">
        <a-input-number
          v-model:value="formToolbarAnimationMs"
          :min="120"
          :max="600"
          :step="10"
          style="max-width: 240px"
        />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('readerToolbarAnimationMsHelp') }}
        </div>
      </a-form-item>

      <a-form-item :label="$t('readerToolbarBackgroundOpacity')">
        <a-input-number
          v-model:value="formToolbarBackgroundOpacity"
          :min="0.08"
          :max="0.8"
          :step="0.02"
          style="max-width: 240px"
        />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('readerToolbarBackgroundOpacityHelp') }}
        </div>
      </a-form-item>

      <a-divider />

      <a-typography-title :level="5" class="!mb-0">
        {{ $t('readerUiAppearance') }}
      </a-typography-title>

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
  </a-space>
</template>

<script setup>
import { ref, watch } from 'vue'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { useAppSettingsStore } from '@/store/appSettings'

const { t } = useI18n()
const appSettingsStore = useAppSettingsStore()

const saving = ref(false)
const formPreloadAhead = ref(appSettingsStore.readerPreloadAhead)
const formSplitDefaultEnabled = ref(appSettingsStore.readerSplitDefaultEnabled)
const formWideRatioThreshold = ref(appSettingsStore.readerWideRatioThreshold)
const formToolbarAnimationMs = ref(appSettingsStore.readerToolbarAnimationMs)
const formToolbarBackgroundOpacity = ref(appSettingsStore.readerToolbarBackgroundOpacity)
const formReaderUiBlurEnabled = ref(appSettingsStore.readerUiBlurEnabled)
const formReaderUiBlurRadiusPx = ref(appSettingsStore.readerUiBlurRadiusPx)
const formReaderUiControlBgOpacity = ref(appSettingsStore.readerUiControlBgOpacity)
const formReaderUiControlBorderOpacity = ref(appSettingsStore.readerUiControlBorderOpacity)

watch(
  () => appSettingsStore.readerPreloadAhead,
  value => {
    formPreloadAhead.value = value
  }
)
watch(
  () => appSettingsStore.readerSplitDefaultEnabled,
  value => {
    formSplitDefaultEnabled.value = value
  }
)
watch(
  () => appSettingsStore.readerWideRatioThreshold,
  value => {
    formWideRatioThreshold.value = value
  }
)
watch(
  () => appSettingsStore.readerToolbarAnimationMs,
  value => {
    formToolbarAnimationMs.value = value
  }
)
watch(
  () => appSettingsStore.readerToolbarBackgroundOpacity,
  value => {
    formToolbarBackgroundOpacity.value = value
  }
)

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
      appSettingsStore.setReaderPreloadAhead(formPreloadAhead.value),
      appSettingsStore.setReaderSplitDefaultEnabled(formSplitDefaultEnabled.value),
      appSettingsStore.setReaderWideRatioThreshold(formWideRatioThreshold.value),
      appSettingsStore.setReaderToolbarAnimationMs(formToolbarAnimationMs.value),
      appSettingsStore.setReaderToolbarBackgroundOpacity(formToolbarBackgroundOpacity.value),
      appSettingsStore.setReaderUiBlurEnabled(formReaderUiBlurEnabled.value),
      appSettingsStore.setReaderUiBlurRadiusPx(formReaderUiBlurRadiusPx.value),
      appSettingsStore.setReaderUiControlBgOpacity(formReaderUiControlBgOpacity.value),
      appSettingsStore.setReaderUiControlBorderOpacity(formReaderUiControlBorderOpacity.value)
    ])
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('保存阅读器设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}

const resetToDefault = async () => {
  saving.value = true
  try {
    await Promise.all([
      appSettingsStore.setReaderPreloadAhead(2),
      appSettingsStore.setReaderSplitDefaultEnabled(false),
      appSettingsStore.setReaderWideRatioThreshold(1.0),
      appSettingsStore.setReaderToolbarAnimationMs(240),
      appSettingsStore.setReaderToolbarBackgroundOpacity(0.72),
      appSettingsStore.setReaderUiBlurEnabled(true),
      appSettingsStore.setReaderUiBlurRadiusPx(12),
      appSettingsStore.setReaderUiControlBgOpacity(0.46),
      appSettingsStore.setReaderUiControlBorderOpacity(0.16)
    ])
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('重置阅读器设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}
</script>
