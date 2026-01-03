<template>
  <a-space direction="vertical" size="large" class="w-full">
    <a-form layout="vertical" @submit.prevent>
      <a-form-item :label="$t('defaultLibraryViewMode')">
        <a-select v-model:value="formViewMode" style="max-width: 240px">
          <a-select-option value="grid">{{ $t('viewGrid') }}</a-select-option>
          <a-select-option value="list">{{ $t('viewList') }}</a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item :label="$t('defaultItemsPerPage')">
        <a-select v-model:value="formPerPage" style="max-width: 240px">
          <a-select-option v-for="size in perPageOptions" :key="`perpage-${size}`" :value="size">
            {{ size }}
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item :label="$t('lazyLoadRootMargin')">
        <a-input-number
          v-model:value="formRootMarginPx"
          :min="0"
          :max="5000"
          :step="50"
          addon-after="px"
          style="max-width: 240px"
        />
        <div class="mt-1 text-xs text-gray-500">
          {{ $t('lazyLoadRootMarginHelp') }}
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

const perPageOptions = [20, 50, 100, 200]
const saving = ref(false)

const formViewMode = ref(appSettingsStore.libraryViewMode)
const formPerPage = ref(appSettingsStore.libraryPerPage)
const formRootMarginPx = ref(appSettingsStore.libraryLazyRootMarginPx)

watch(
  () => appSettingsStore.libraryViewMode,
  value => {
    formViewMode.value = value
  }
)
watch(
  () => appSettingsStore.libraryPerPage,
  value => {
    formPerPage.value = value
  }
)
watch(
  () => appSettingsStore.libraryLazyRootMarginPx,
  value => {
    formRootMarginPx.value = value
  }
)

const save = async () => {
  saving.value = true
  try {
    await Promise.all([
      appSettingsStore.setLibraryViewMode(formViewMode.value),
      appSettingsStore.setLibraryPerPage(formPerPage.value),
      appSettingsStore.setLibraryLazyRootMarginPx(formRootMarginPx.value)
    ])
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('保存图书馆浏览设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}

const resetToDefault = async () => {
  saving.value = true
  try {
    await Promise.all([
      appSettingsStore.setLibraryViewMode('grid'),
      appSettingsStore.setLibraryPerPage(50),
      appSettingsStore.setLibraryLazyRootMarginPx(600)
    ])
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('重置图书馆浏览设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}
</script>

