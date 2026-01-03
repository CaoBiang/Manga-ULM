<template>
  <a-space direction="vertical" size="large" class="w-full">
    <a-form layout="vertical" @submit.prevent>
      <a-form-item :label="$t('managerUiBlurEnabled')">
        <a-switch v-model:checked="formBlurEnabled" />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('managerUiBlurEnabledHelp') }}
        </div>
      </a-form-item>

      <a-form-item :label="$t('managerUiBlurRadiusPx')">
        <a-input-number
          v-model:value="formBlurRadiusPx"
          :min="0"
          :max="30"
          :step="1"
          style="max-width: 240px"
        />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('managerUiBlurRadiusPxHelp') }}
        </div>
      </a-form-item>

      <a-divider />

      <a-form-item :label="$t('managerUiSurfaceBgOpacity')">
        <a-input-number
          v-model:value="formSurfaceBgOpacity"
          :min="0.35"
          :max="0.95"
          :step="0.02"
          style="max-width: 240px"
        />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('managerUiSurfaceBgOpacityHelp') }}
        </div>
      </a-form-item>

      <a-form-item :label="$t('managerUiSurfaceBorderOpacity')">
        <a-input-number
          v-model:value="formSurfaceBorderOpacity"
          :min="0.06"
          :max="0.45"
          :step="0.02"
          style="max-width: 240px"
        />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('managerUiSurfaceBorderOpacityHelp') }}
        </div>
      </a-form-item>

      <a-divider />

      <a-form-item :label="$t('managerUiControlBgOpacity')">
        <a-input-number
          v-model:value="formControlBgOpacity"
          :min="0.18"
          :max="0.9"
          :step="0.02"
          style="max-width: 240px"
        />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('managerUiControlBgOpacityHelp') }}
        </div>
      </a-form-item>

      <a-form-item :label="$t('managerUiControlBorderOpacity')">
        <a-input-number
          v-model:value="formControlBorderOpacity"
          :min="0.06"
          :max="0.6"
          :step="0.02"
          style="max-width: 240px"
        />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('managerUiControlBorderOpacityHelp') }}
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
const formBlurEnabled = ref(appSettingsStore.managerUiBlurEnabled)
const formBlurRadiusPx = ref(appSettingsStore.managerUiBlurRadiusPx)
const formSurfaceBgOpacity = ref(appSettingsStore.managerUiSurfaceBgOpacity)
const formSurfaceBorderOpacity = ref(appSettingsStore.managerUiSurfaceBorderOpacity)
const formControlBgOpacity = ref(appSettingsStore.managerUiControlBgOpacity)
const formControlBorderOpacity = ref(appSettingsStore.managerUiControlBorderOpacity)

watch(
  () => appSettingsStore.managerUiBlurEnabled,
  value => {
    formBlurEnabled.value = value
  }
)
watch(
  () => appSettingsStore.managerUiBlurRadiusPx,
  value => {
    formBlurRadiusPx.value = value
  }
)
watch(
  () => appSettingsStore.managerUiSurfaceBgOpacity,
  value => {
    formSurfaceBgOpacity.value = value
  }
)
watch(
  () => appSettingsStore.managerUiSurfaceBorderOpacity,
  value => {
    formSurfaceBorderOpacity.value = value
  }
)
watch(
  () => appSettingsStore.managerUiControlBgOpacity,
  value => {
    formControlBgOpacity.value = value
  }
)
watch(
  () => appSettingsStore.managerUiControlBorderOpacity,
  value => {
    formControlBorderOpacity.value = value
  }
)

const save = async () => {
  saving.value = true
  try {
    await Promise.all([
      appSettingsStore.setManagerUiBlurEnabled(formBlurEnabled.value),
      appSettingsStore.setManagerUiBlurRadiusPx(formBlurRadiusPx.value),
      appSettingsStore.setManagerUiSurfaceBgOpacity(formSurfaceBgOpacity.value),
      appSettingsStore.setManagerUiSurfaceBorderOpacity(formSurfaceBorderOpacity.value),
      appSettingsStore.setManagerUiControlBgOpacity(formControlBgOpacity.value),
      appSettingsStore.setManagerUiControlBorderOpacity(formControlBorderOpacity.value),
    ])
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('保存管理器外观设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}

const resetToDefault = async () => {
  saving.value = true
  try {
    await Promise.all([
      appSettingsStore.setManagerUiBlurEnabled(true),
      appSettingsStore.setManagerUiBlurRadiusPx(10),
      appSettingsStore.setManagerUiSurfaceBgOpacity(0.72),
      appSettingsStore.setManagerUiSurfaceBorderOpacity(0.14),
      appSettingsStore.setManagerUiControlBgOpacity(0.6),
      appSettingsStore.setManagerUiControlBorderOpacity(0.14),
    ])
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('重置管理器外观设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}
</script>
