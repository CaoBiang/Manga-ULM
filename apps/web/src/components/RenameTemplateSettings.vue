<template>
  <a-space direction="vertical" size="large" class="w-full">
    <a-form layout="vertical" @submit.prevent>
      <a-form-item :label="$t('renameFilenameTemplate')">
        <a-textarea
          v-model:value="template"
          :placeholder="$t('renameFilenameTemplatePlaceholder')"
          :auto-size="{ minRows: 2, maxRows: 6 }"
        />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('renameFilenameTemplateHelp') }}
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
const template = ref(appSettingsStore.renameFilenameTemplate)

watch(
  () => appSettingsStore.renameFilenameTemplate,
  value => {
    template.value = value
  }
)

const save = async () => {
  saving.value = true
  try {
    await appSettingsStore.setRenameFilenameTemplate(template.value)
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('保存重命名模板失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}

const resetToDefault = async () => {
  saving.value = true
  try {
    await appSettingsStore.setRenameFilenameTemplate('')
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('重置重命名模板失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}
</script>

