<template>
  <a-space direction="vertical" size="large" class="w-full">
    <a-typography-paragraph type="secondary" class="!mb-0">
      {{ $t('readerTapZonesSettingsHelp') }}
    </a-typography-paragraph>

    <div class="reader-tap-zones-settings__preview">
      <ReaderTapZonesPreview
        v-model="draft"
        v-model:selectedZone="selectedZone"
        :overlay="false"
        :show-labels="true"
      />
    </div>

    <a-form layout="vertical" @submit.prevent>
      <a-form-item :label="zoneLabel(selectedZone)">
        <a-select
          v-model:value="selectedZoneAction"
          :options="actionOptions"
          style="max-width: 360px"
        />
      </a-form-item>

      <a-form-item :label="$t('readerTapZonesLeftWidth')">
        <a-slider v-model:value="leftWidthPercent" :min="8" :max="84" :step="1" :tooltip-open="false" />
        <div class="mt-1 text-xs text-gray-500">{{ leftWidthText }}</div>
      </a-form-item>

      <a-form-item :label="$t('readerTapZonesRightWidth')">
        <a-slider v-model:value="rightWidthPercent" :min="8" :max="84" :step="1" :tooltip-open="false" />
        <div class="mt-1 text-xs text-gray-500">{{ rightWidthText }}</div>
      </a-form-item>

      <a-form-item :label="$t('readerTapZonesCurrentSizes')">
        <a-space>
          <a-tag>{{ $t('readerTapZoneLeft') }}：{{ leftWidthText }}</a-tag>
          <a-tag>{{ $t('readerTapZoneMiddle') }}：{{ middleWidthText }}</a-tag>
          <a-tag>{{ $t('readerTapZoneRight') }}：{{ rightWidthText }}</a-tag>
        </a-space>
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
import { computed, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { message } from 'ant-design-vue'
import { useI18n } from 'vue-i18n'
import { useAppSettingsStore, DEFAULT_READER_TAP_ZONES } from '@/store/appSettings'
import ReaderTapZonesPreview from '@/components/reader/tapZones/ReaderTapZonesPreview.vue'

const { t } = useI18n()
const appSettingsStore = useAppSettingsStore()
const { readerTapZones } = storeToRefs(appSettingsStore)

const saving = ref(false)
const selectedZone = ref('middle')

const draft = ref(JSON.parse(JSON.stringify(readerTapZones.value || DEFAULT_READER_TAP_ZONES)))

watch(
  readerTapZones,
  value => {
    if (!saving.value) {
      draft.value = JSON.parse(JSON.stringify(value || DEFAULT_READER_TAP_ZONES))
    }
  },
  { deep: true }
)

const actionOptions = computed(() => [
  { value: 'prev_page', label: t('readerTapActionPrevPage') },
  { value: 'next_page', label: t('readerTapActionNextPage') },
  { value: 'toggle_toolbar', label: t('readerTapActionToggleToolbar') },
  { value: 'expand_toolbar', label: t('readerTapActionExpandToolbar') },
  { value: 'collapse_toolbar', label: t('readerTapActionCollapseToolbar') },
  { value: 'none', label: t('readerTapActionNone') }
])

const zoneLabel = zoneKey => {
  if (zoneKey === 'left') return t('readerTapZoneLeft')
  if (zoneKey === 'right') return t('readerTapZoneRight')
  return t('readerTapZoneMiddle')
}

const selectedZoneAction = computed({
  get: () => draft.value?.actions?.[selectedZone.value] ?? 'none',
  set: value => {
    draft.value = {
      ...(draft.value || DEFAULT_READER_TAP_ZONES),
      actions: { ...(draft.value?.actions || DEFAULT_READER_TAP_ZONES.actions), [selectedZone.value]: value }
    }
  }
})

const leftRatio = computed(() => Number(draft.value?.boundaries?.left ?? DEFAULT_READER_TAP_ZONES.boundaries.left))
const rightRatio = computed(() => Number(draft.value?.boundaries?.right ?? DEFAULT_READER_TAP_ZONES.boundaries.right))

const widths = computed(() => {
  const left = Math.round(leftRatio.value * 100)
  const middle = Math.round((rightRatio.value - leftRatio.value) * 100)
  const right = Math.round((1 - rightRatio.value) * 100)
  return { left, middle, right }
})

const leftWidthText = computed(() => `${widths.value.left}%`)
const middleWidthText = computed(() => `${widths.value.middle}%`)
const rightWidthText = computed(() => `${widths.value.right}%`)

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const setBoundaries = (left, right) => {
  const minZoneWidth = 0.08
  const normalizedLeft = clamp(left, minZoneWidth, 1 - minZoneWidth)
  const normalizedRight = clamp(right, minZoneWidth, 1 - minZoneWidth)
  if (normalizedLeft >= normalizedRight) {
    return
  }
  if (
    normalizedLeft < minZoneWidth ||
    1 - normalizedRight < minZoneWidth ||
    normalizedRight - normalizedLeft < minZoneWidth
  ) {
    return
  }

  draft.value = {
    ...(draft.value || DEFAULT_READER_TAP_ZONES),
    version: 1,
    boundaries: { left: normalizedLeft, right: normalizedRight },
    actions: { ...(draft.value?.actions || DEFAULT_READER_TAP_ZONES.actions) }
  }
}

const leftWidthPercent = computed({
  get: () => widths.value.left,
  set: percent => {
    setBoundaries(clamp(Number(percent) / 100, 0.08, 0.92), rightRatio.value)
  }
})

const rightWidthPercent = computed({
  get: () => widths.value.right,
  set: percent => {
    setBoundaries(leftRatio.value, 1 - clamp(Number(percent) / 100, 0.08, 0.92))
  }
})

const save = async () => {
  saving.value = true
  try {
    await appSettingsStore.setReaderTapZones(draft.value)
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('保存阅读器点击区域设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}

const resetToDefault = async () => {
  saving.value = true
  try {
    const next = {
      version: 1,
      boundaries: { ...DEFAULT_READER_TAP_ZONES.boundaries },
      actions: { ...DEFAULT_READER_TAP_ZONES.actions }
    }
    draft.value = next
    await appSettingsStore.setReaderTapZones(next)
    message.success(t('settingsSavedSuccessfully'))
  } catch (error) {
    console.error('重置阅读器点击区域设置失败：', error)
    message.error(t('failedToSaveSettings'))
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.reader-tap-zones-settings__preview {
  width: 100%;
  height: 260px;
  border-radius: 16px;
  overflow: hidden;
  background: #000;
  border: 1px solid rgba(0, 0, 0, 0.08);
}
</style>
