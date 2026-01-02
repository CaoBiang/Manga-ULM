<template>
  <div ref="previewRef" class="reader-tap-zones-preview" :class="{ 'is-overlay': overlay }">
    <div
      class="reader-tap-zones-preview__zone reader-tap-zones-preview__zone--left"
      :class="{ 'is-selected': resolvedSelectedZone === 'left' }"
      :style="leftZoneStyle"
      @click.stop="emit('update:selectedZone', 'left')"
    >
      <div v-if="showLabels" class="reader-tap-zones-preview__label">
        <div class="reader-tap-zones-preview__label-title">{{ t('readerTapZoneLeft') }}</div>
        <div class="reader-tap-zones-preview__label-sub">{{ actionLabel(leftAction) }}</div>
      </div>
    </div>

    <div
      class="reader-tap-zones-preview__zone reader-tap-zones-preview__zone--middle"
      :class="{ 'is-selected': resolvedSelectedZone === 'middle' }"
      :style="middleZoneStyle"
      @click.stop="emit('update:selectedZone', 'middle')"
    >
      <div v-if="showLabels" class="reader-tap-zones-preview__label">
        <div class="reader-tap-zones-preview__label-title">{{ t('readerTapZoneMiddle') }}</div>
        <div class="reader-tap-zones-preview__label-sub">{{ actionLabel(middleAction) }}</div>
      </div>
    </div>

    <div
      class="reader-tap-zones-preview__zone reader-tap-zones-preview__zone--right"
      :class="{ 'is-selected': resolvedSelectedZone === 'right' }"
      :style="rightZoneStyle"
      @click.stop="emit('update:selectedZone', 'right')"
    >
      <div v-if="showLabels" class="reader-tap-zones-preview__label">
        <div class="reader-tap-zones-preview__label-title">{{ t('readerTapZoneRight') }}</div>
        <div class="reader-tap-zones-preview__label-sub">{{ actionLabel(rightAction) }}</div>
      </div>
    </div>

    <div
      class="reader-tap-zones-preview__handle reader-tap-zones-preview__handle--left"
      :style="{ left: `${leftPercent}%` }"
      @pointerdown="handlePointerDown('left', $event)"
    >
      <div class="reader-tap-zones-preview__handle-line"></div>
      <div class="reader-tap-zones-preview__handle-knob"></div>
    </div>

    <div
      class="reader-tap-zones-preview__handle reader-tap-zones-preview__handle--right"
      :style="{ left: `${rightPercent}%` }"
      @pointerdown="handlePointerDown('right', $event)"
    >
      <div class="reader-tap-zones-preview__handle-line"></div>
      <div class="reader-tap-zones-preview__handle-knob"></div>
    </div>
  </div>
</template>

<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { DEFAULT_READER_TAP_ZONES } from '@/store/appSettings'

const MIN_ZONE_WIDTH_RATIO = 0.08

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => DEFAULT_READER_TAP_ZONES
  },
  selectedZone: {
    type: String,
    default: 'middle'
  },
  overlay: {
    type: Boolean,
    default: false
  },
  showLabels: {
    type: Boolean,
    default: true
  }
})

const emit = defineEmits(['update:modelValue', 'update:selectedZone'])

const { t } = useI18n()

const previewRef = ref(null)
const dragState = ref(null)

const resolvedSelectedZone = computed(() => {
  const value = String(props.selectedZone || '').trim().toLowerCase()
  return ['left', 'middle', 'right'].includes(value) ? value : 'middle'
})

const boundaries = computed(() => props.modelValue?.boundaries ?? DEFAULT_READER_TAP_ZONES.boundaries)
const actions = computed(() => props.modelValue?.actions ?? DEFAULT_READER_TAP_ZONES.actions)

const leftRatio = computed(() => Number(boundaries.value?.left ?? DEFAULT_READER_TAP_ZONES.boundaries.left))
const rightRatio = computed(() => Number(boundaries.value?.right ?? DEFAULT_READER_TAP_ZONES.boundaries.right))

const leftPercent = computed(() => Math.round(leftRatio.value * 100))
const rightPercent = computed(() => Math.round(rightRatio.value * 100))

const leftAction = computed(() => actions.value?.left ?? DEFAULT_READER_TAP_ZONES.actions.left)
const middleAction = computed(() => actions.value?.middle ?? DEFAULT_READER_TAP_ZONES.actions.middle)
const rightAction = computed(() => actions.value?.right ?? DEFAULT_READER_TAP_ZONES.actions.right)

const leftZoneStyle = computed(() => ({
  left: '0%',
  width: `${Math.max(0, leftRatio.value) * 100}%`
}))

const middleZoneStyle = computed(() => ({
  left: `${Math.max(0, leftRatio.value) * 100}%`,
  width: `${Math.max(0, rightRatio.value - leftRatio.value) * 100}%`
}))

const rightZoneStyle = computed(() => ({
  left: `${Math.max(0, rightRatio.value) * 100}%`,
  width: `${Math.max(0, 1 - rightRatio.value) * 100}%`
}))

const actionLabel = action => {
  const key = String(action || '').trim().toLowerCase()
  if (key === 'prev_page') return t('readerTapActionPrevPage')
  if (key === 'next_page') return t('readerTapActionNextPage')
  if (key === 'toggle_toolbar') return t('readerTapActionToggleToolbar')
  if (key === 'expand_toolbar') return t('readerTapActionExpandToolbar')
  if (key === 'collapse_toolbar') return t('readerTapActionCollapseToolbar')
  return t('readerTapActionNone')
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value))

const updateBoundaries = (nextLeft, nextRight) => {
  const left = clamp(nextLeft, MIN_ZONE_WIDTH_RATIO, 1 - MIN_ZONE_WIDTH_RATIO)
  const right = clamp(nextRight, MIN_ZONE_WIDTH_RATIO, 1 - MIN_ZONE_WIDTH_RATIO)
  if (left >= right) {
    return
  }
  if (left < MIN_ZONE_WIDTH_RATIO || 1 - right < MIN_ZONE_WIDTH_RATIO || right - left < MIN_ZONE_WIDTH_RATIO) {
    return
  }
  emit('update:modelValue', {
    ...(props.modelValue || DEFAULT_READER_TAP_ZONES),
    version: 1,
    boundaries: { left, right },
    actions: { ...(actions.value || DEFAULT_READER_TAP_ZONES.actions) }
  })
}

const cleanupDragListeners = () => {
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  dragState.value = null
}

const handlePointerMove = event => {
  const host = previewRef.value
  if (!dragState.value || !host || typeof host.getBoundingClientRect !== 'function') {
    return
  }
  const rect = host.getBoundingClientRect()
  if (!rect.width) {
    return
  }
  const dxRatio = (event.clientX - dragState.value.startX) / rect.width
  if (dragState.value.handle === 'left') {
    updateBoundaries(dragState.value.startLeft + dxRatio, dragState.value.startRight)
  } else {
    updateBoundaries(dragState.value.startLeft, dragState.value.startRight + dxRatio)
  }
}

const handlePointerUp = () => cleanupDragListeners()

const handlePointerDown = (handle, event) => {
  event.preventDefault()
  event.stopPropagation()

  dragState.value = {
    handle,
    startX: event.clientX,
    startLeft: leftRatio.value,
    startRight: rightRatio.value
  }

  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
}

onBeforeUnmount(() => {
  cleanupDragListeners()
})
</script>

<style scoped>
.reader-tap-zones-preview {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
  touch-action: none;
}

.reader-tap-zones-preview__zone {
  position: absolute;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    background 120ms ease,
    box-shadow 120ms ease;
}

.reader-tap-zones-preview__zone--left {
  background: rgba(255, 255, 255, 0.04);
}

.reader-tap-zones-preview__zone--middle {
  background: rgba(255, 255, 255, 0.02);
}

.reader-tap-zones-preview__zone--right {
  background: rgba(255, 255, 255, 0.04);
}

.reader-tap-zones-preview.is-overlay .reader-tap-zones-preview__zone--left,
.reader-tap-zones-preview.is-overlay .reader-tap-zones-preview__zone--middle,
.reader-tap-zones-preview.is-overlay .reader-tap-zones-preview__zone--right {
  background: rgba(255, 255, 255, 0.06);
}

.reader-tap-zones-preview__zone.is-selected {
  box-shadow: inset 0 0 0 2px rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.08);
}

.reader-tap-zones-preview__label {
  padding: 10px 12px;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(18, 18, 18, 0.45);
  backdrop-filter: var(--reader-ui-control-backdrop-filter, blur(10px));
  -webkit-backdrop-filter: var(--reader-ui-control-backdrop-filter, blur(10px));
  color: rgba(255, 255, 255, 0.92);
  text-align: center;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.38);
  max-width: min(240px, 80%);
}

.reader-tap-zones-preview__label-title {
  font-weight: 700;
  font-size: 13px;
  letter-spacing: 0.02em;
}

.reader-tap-zones-preview__label-sub {
  margin-top: 4px;
  font-size: 12px;
  color: rgba(255, 255, 255, 0.74);
}

.reader-tap-zones-preview__handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40px;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: ew-resize;
}

.reader-tap-zones-preview__handle-line {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.35);
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.35);
}

.reader-tap-zones-preview__handle-knob {
  width: 20px;
  height: 44px;
  border-radius: 12px;
  background: rgba(18, 18, 18, 0.55);
  border: 1px solid rgba(255, 255, 255, 0.2);
  box-shadow: 0 10px 22px rgba(0, 0, 0, 0.4);
  backdrop-filter: var(--reader-ui-control-backdrop-filter, blur(10px));
  -webkit-backdrop-filter: var(--reader-ui-control-backdrop-filter, blur(10px));
}
</style>

