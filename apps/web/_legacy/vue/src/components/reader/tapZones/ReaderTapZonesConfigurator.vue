<template>
  <div v-if="open" class="reader-tap-zones-config" @click.stop>
    <div class="reader-tap-zones-config__backdrop" @click.stop></div>

    <div class="reader-tap-zones-config__canvas" @click.stop>
      <ReaderTapZonesPreview
        v-model="draftValue"
        v-model:selectedZone="selectedZone"
        :overlay="true"
        :show-labels="true"
      />
    </div>

    <div class="reader-tap-zones-config__panel" @click.stop>
      <div class="reader-tap-zones-config__panel-title">
        {{ t('readerTapZonesConfigTitle') }}
      </div>

      <div class="reader-tap-zones-config__panel-row">
        <div class="reader-tap-zones-config__panel-label">
          {{ zoneLabel(selectedZone) }}
        </div>
        <a-select
          v-model:value="selectedZoneAction"
          class="reader-tap-zones-config__select"
          :options="actionOptions"
          :dropdown-class-name="'reader-tap-zones-config__dropdown'"
        />
      </div>

      <div class="reader-tap-zones-config__panel-row reader-tap-zones-config__panel-row--sizes">
        <div class="reader-tap-zones-config__size">
          <div class="reader-tap-zones-config__size-label">{{ t('readerTapZoneLeft') }}</div>
          <div class="reader-tap-zones-config__size-value">{{ leftWidthText }}</div>
        </div>
        <div class="reader-tap-zones-config__size">
          <div class="reader-tap-zones-config__size-label">{{ t('readerTapZoneMiddle') }}</div>
          <div class="reader-tap-zones-config__size-value">{{ middleWidthText }}</div>
        </div>
        <div class="reader-tap-zones-config__size">
          <div class="reader-tap-zones-config__size-label">{{ t('readerTapZoneRight') }}</div>
          <div class="reader-tap-zones-config__size-value">{{ rightWidthText }}</div>
        </div>
      </div>

      <div class="reader-tap-zones-config__panel-row reader-tap-zones-config__panel-row--sliders">
        <div class="reader-tap-zones-config__slider-block">
          <div class="reader-tap-zones-config__slider-label">{{ t('readerTapZonesLeftWidth') }}</div>
          <a-slider v-model:value="leftWidthPercent" :min="8" :max="84" :step="1" :tooltip-open="false" />
        </div>
        <div class="reader-tap-zones-config__slider-block">
          <div class="reader-tap-zones-config__slider-label">{{ t('readerTapZonesRightWidth') }}</div>
          <a-slider v-model:value="rightWidthPercent" :min="8" :max="84" :step="1" :tooltip-open="false" />
        </div>
      </div>

      <div class="reader-tap-zones-config__panel-actions">
        <ReaderButton variant="ghost" :disabled="saving" @click="emit('close')">
          {{ t('cancel') }}
        </ReaderButton>
        <ReaderButton variant="ghost" :disabled="saving" @click="resetToDefault">
          {{ t('resetToDefault') }}
        </ReaderButton>
        <ReaderButton variant="primary" :disabled="saving" @click="emit('save', draftValue)">
          {{ t('save') }}
        </ReaderButton>
      </div>
    </div>

    <div class="reader-tap-zones-config__close">
      <ReaderButton
        shape="circle"
        size="lg"
        class="reader-tap-zones-config__close-button"
        :aria-label="t('close')"
        @click="emit('close')"
      >
        <template #icon>
          <CloseOutlined />
        </template>
      </ReaderButton>
    </div>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { CloseOutlined } from '@ant-design/icons-vue'
import ReaderButton from '@/components/reader/ui/ReaderButton.vue'
import ReaderTapZonesPreview from '@/components/reader/tapZones/ReaderTapZonesPreview.vue'
import { DEFAULT_READER_TAP_ZONES } from '@/store/appSettings'

const props = defineProps({
  open: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: Object,
    default: () => DEFAULT_READER_TAP_ZONES
  },
  saving: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:modelValue', 'close', 'save'])

const { t } = useI18n()

const selectedZone = ref('middle')

const draftValue = computed({
  get: () => props.modelValue || DEFAULT_READER_TAP_ZONES,
  set: value => emit('update:modelValue', value)
})

watch(
  () => props.open,
  value => {
    if (value) {
      selectedZone.value = 'middle'
    }
  }
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
  get: () => {
    const key = selectedZone.value
    return draftValue.value?.actions?.[key] ?? 'none'
  },
  set: value => {
    const next = {
      ...(draftValue.value || DEFAULT_READER_TAP_ZONES),
      actions: { ...(draftValue.value?.actions || DEFAULT_READER_TAP_ZONES.actions), [selectedZone.value]: value }
    }
    draftValue.value = next
  }
})

const leftRatio = computed(() => Number(draftValue.value?.boundaries?.left ?? DEFAULT_READER_TAP_ZONES.boundaries.left))
const rightRatio = computed(() => Number(draftValue.value?.boundaries?.right ?? DEFAULT_READER_TAP_ZONES.boundaries.right))

const widthTexts = computed(() => {
  const left = Math.round(leftRatio.value * 100)
  const middle = Math.round((rightRatio.value - leftRatio.value) * 100)
  const right = Math.round((1 - rightRatio.value) * 100)
  return { left, middle, right }
})

const leftWidthText = computed(() => `${widthTexts.value.left}%`)
const middleWidthText = computed(() => `${widthTexts.value.middle}%`)
const rightWidthText = computed(() => `${widthTexts.value.right}%`)

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

  draftValue.value = {
    ...(draftValue.value || DEFAULT_READER_TAP_ZONES),
    version: 1,
    boundaries: { left: normalizedLeft, right: normalizedRight },
    actions: { ...(draftValue.value?.actions || DEFAULT_READER_TAP_ZONES.actions) }
  }
}

const leftWidthPercent = computed({
  get: () => Math.round(leftRatio.value * 100),
  set: percent => {
    const nextLeft = clamp(Number(percent) / 100, 0.08, 0.92)
    setBoundaries(nextLeft, rightRatio.value)
  }
})

const rightWidthPercent = computed({
  get: () => Math.round((1 - rightRatio.value) * 100),
  set: percent => {
    const nextRight = 1 - clamp(Number(percent) / 100, 0.08, 0.92)
    setBoundaries(leftRatio.value, nextRight)
  }
})

const resetToDefault = () => {
  draftValue.value = {
    version: 1,
    boundaries: { ...DEFAULT_READER_TAP_ZONES.boundaries },
    actions: { ...DEFAULT_READER_TAP_ZONES.actions }
  }
}
</script>

<style scoped>
.reader-tap-zones-config {
  position: fixed;
  inset: 0;
  z-index: 60;
  color: rgba(255, 255, 255, 0.92);
}

.reader-tap-zones-config__backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.22);
}

.reader-tap-zones-config__canvas {
  position: absolute;
  inset: 0;
}

.reader-tap-zones-config__panel {
  position: absolute;
  left: 50%;
  bottom: 24px;
  transform: translateX(-50%);
  width: min(860px, calc(100vw - 32px));

  border-radius: 18px;
  border: 1px solid var(--reader-ui-control-border, rgba(255, 255, 255, 0.16));
  background: var(--reader-ui-control-bg, rgba(18, 18, 18, 0.42));
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.45);
  backdrop-filter: var(--reader-ui-control-backdrop-filter, blur(12px));
  -webkit-backdrop-filter: var(--reader-ui-control-backdrop-filter, blur(12px));

  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.reader-tap-zones-config__panel-title {
  font-weight: 700;
  letter-spacing: 0.02em;
}

.reader-tap-zones-config__panel-row {
  display: grid;
  grid-template-columns: 128px 1fr;
  align-items: center;
  gap: 12px;
}

.reader-tap-zones-config__panel-row--sizes {
  grid-template-columns: 1fr 1fr 1fr;
}

.reader-tap-zones-config__panel-row--sliders {
  grid-template-columns: 1fr 1fr;
}

.reader-tap-zones-config__panel-label {
  color: rgba(255, 255, 255, 0.78);
  font-size: 13px;
}

.reader-tap-zones-config__size {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
}

.reader-tap-zones-config__size-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
}

.reader-tap-zones-config__size-value {
  margin-top: 4px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.reader-tap-zones-config__slider-block {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.04);
}

.reader-tap-zones-config__slider-label {
  font-size: 12px;
  color: rgba(255, 255, 255, 0.7);
  margin-bottom: 6px;
}

.reader-tap-zones-config__panel-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.reader-tap-zones-config__close {
  position: absolute;
  top: 20px;
  right: 20px;
  z-index: 2;
}

.reader-tap-zones-config__close-button {
  --reader-ui-control-bg: rgba(18, 18, 18, 0.5);
}

.reader-tap-zones-config :deep(.ant-select-selector) {
  background: rgba(255, 255, 255, 0.06) !important;
  border-color: rgba(255, 255, 255, 0.14) !important;
  color: rgba(255, 255, 255, 0.9) !important;
  box-shadow: none !important;
}

.reader-tap-zones-config :deep(.ant-select-selection-item),
.reader-tap-zones-config :deep(.ant-select-selection-placeholder) {
  color: rgba(255, 255, 255, 0.9) !important;
}

.reader-tap-zones-config :deep(.ant-select-arrow) {
  color: rgba(255, 255, 255, 0.7);
}

.reader-tap-zones-config :deep(.ant-slider-rail) {
  background: rgba(255, 255, 255, 0.14);
}

.reader-tap-zones-config :deep(.ant-slider-track) {
  background: rgba(255, 255, 255, 0.5);
}

.reader-tap-zones-config :deep(.ant-slider-handle) {
  border-color: rgba(255, 255, 255, 0.7);
}

:deep(.reader-tap-zones-config__dropdown) {
  background: rgba(18, 18, 18, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

:deep(.reader-tap-zones-config__dropdown .ant-select-item-option) {
  color: rgba(255, 255, 255, 0.9);
}

:deep(.reader-tap-zones-config__dropdown .ant-select-item-option-selected) {
  background: rgba(255, 255, 255, 0.12);
}

:deep(.reader-tap-zones-config__dropdown .ant-select-item-option-active) {
  background: rgba(255, 255, 255, 0.08);
}
</style>
